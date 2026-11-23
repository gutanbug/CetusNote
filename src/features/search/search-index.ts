import { isChoseong, toChoseong } from "@/lib/hangul";
import type { Page } from "@/lib/storage";

/**
 * 메모리 검색 인덱스 (ADR-003, 2026-11-19 사용자 결정: 부분 문자열 검색).
 * 라이브러리 없이 "포함 여부"로 찾는다 — 한국어 조사·단어 중간도 맞는다.
 * 띄어 쓴 검색어는 모두 들어 있어야 나온다(AND). 5,000페이지 × 10,000자에서 한 번에 13ms 이하(측정).
 */

type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: Node[] };

const BLOCK_SEP = new Set([
  "paragraph",
  "heading",
  "codeBlock",
  "blockMath",
  "listItem",
  "taskItem",
  "tableCell",
  "tableHeader",
  "detailsSummary",
  "image", // 캡션
]);

/** Tiptap JSON에서 검색할 글자만 뽑는다. 블록 사이는 줄바꿈 */
export function docText(doc: unknown): string {
  const parts: string[] = [];
  const walk = (n: Node) => {
    if (n.type === "text") parts.push(n.text ?? "");
    else if (n.type === "hardBreak") parts.push(" ");
    else if (n.type === "inlineMath" || n.type === "blockMath")
      parts.push(String(n.attrs?.latex ?? ""));
    else if (n.type === "pageMention") parts.push(String(n.attrs?.label ?? ""));
    n.content?.forEach(walk);
    if (n.type && BLOCK_SEP.has(n.type)) parts.push("\n");
  };
  if (doc && typeof doc === "object") walk(doc as Node);
  return parts
    .join("")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** 비교용: 유니코드 정규화(NFC) + 소문자 + 공백 한 칸 */
export function normalize(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** 보여 주기용: 공백만 한 칸으로 (normalize와 글자 위치가 같다) */
function display(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

type Entry = {
  id: string;
  title: string;
  icon: string | null;
  titleNorm: string;
  /** titleNorm의 초성 (같은 길이) */
  titleCho: string;
  body: string;
  bodyNorm: string;
  updatedAt: string;
  trashed: boolean;
};

export type SearchResult = {
  id: string;
  title: string;
  icon: string | null;
  /** 본문에서 처음 맞은 곳 앞뒤. 제목에서만 맞으면 본문 첫머리 */
  snippet: string;
  /** snippet 안에서 검색어가 맞은 범위 [시작, 끝) — 강조 표시용 */
  highlights: [number, number][];
  /** 제목에 모든 검색어가 들어 있으면 title */
  matchIn: "title" | "body";
};

const SNIPPET_BEFORE = 24;
const SNIPPET_LENGTH = 96;
/** 앞쪽 공백을 찾아 넓힐 최대 글자 수 */
const SNIPPET_WORD_REACH = 12;

function ranges(text: string, terms: string[]): [number, number][] {
  const out: [number, number][] = [];
  for (const t of terms) {
    for (let i = text.indexOf(t); i !== -1; i = text.indexOf(t, i + t.length))
      out.push([i, i + t.length]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

function countOf(text: string, term: string, cap = 50): number {
  let n = 0;
  for (let i = text.indexOf(term); i !== -1 && n < cap; i = text.indexOf(term, i + term.length))
    n++;
  return n;
}

export function createSearchIndex() {
  const entries = new Map<string, Entry>();

  const toEntry = (page: Page): Entry => {
    const body = display(docText(page.content));
    // 소문자로 바꿔 길이가 달라지는 드문 글자(İ 등)는 위치 계산이 어긋나므로 보여 주기용을 비교용과 맞춘다
    const bodyNorm = normalize(body);
    return {
      id: page.id,
      title: page.title,
      icon: page.icon,
      titleNorm: normalize(page.title),
      titleCho: toChoseong(normalize(page.title)),
      body: bodyNorm.length === body.length ? body : bodyNorm,
      bodyNorm,
      updatedAt: page.updatedAt,
      // 템플릿(PAGE-14)은 휴지통처럼 일반 검색에서 뺀다
      trashed: page.trashedAt !== null || page.template !== null,
    };
  };

  return {
    /** 처음 한 번: 모든 페이지로 다시 만든다 */
    build(pages: Iterable<Page>) {
      entries.clear();
      for (const p of pages) if (p.kind !== "folder") entries.set(p.id, toEntry(p));
    },
    /** 폴더는 찾지 않는다(본문이 없다, SHELL-14) */
    upsert(page: Page) {
      if (page.kind === "folder") entries.delete(page.id);
      else entries.set(page.id, toEntry(page));
    },
    remove(id: string) {
      entries.delete(id);
    },
    get size() {
      return entries.size;
    },
    /**
     * 찾기. 순위: 제목이 검색어와 같음 → 제목에 모두 있음 → 제목이 검색어로 시작 → 본문에서 맞은 횟수 → 최근에 고친 순.
     * 초성만 친 낱말(ㅁㅅ)은 제목의 초성과도 맞춘다(본문은 글자 그대로만).
     * 휴지통 페이지는 빼고 찾는다(includeTrashed로 포함).
     */
    search(query: string, { limit = 50, includeTrashed = false } = {}): SearchResult[] {
      const whole = normalize(query);
      const terms = [...new Set(whole.split(" ").filter(Boolean))];
      const cho = new Set(terms.filter(isChoseong));
      if (!terms.length) return [];
      const scored: { e: Entry; score: number; inTitle: boolean }[] = [];
      for (const e of entries.values()) {
        if (e.trashed && !includeTrashed) continue;
        let inTitle = true;
        let ok = true;
        let bodyHits = 0;
        for (const t of terms) {
          const t1 = e.titleNorm.includes(t) || (cho.has(t) && e.titleCho.includes(t));
          const b = countOf(e.bodyNorm, t);
          if (!t1) inTitle = false;
          if (!t1 && !b) {
            ok = false;
            break;
          }
          bodyHits += b;
        }
        if (!ok) continue;
        const first = terms[0]!;
        const score =
          (e.titleNorm === whole || (cho.size > 0 && e.titleCho === whole) ? 20_000 : 0) +
          (inTitle ? 10_000 : 0) +
          // 글자 그대로 맞으면 초성으로 맞은 것보다 조금 앞
          (e.titleNorm.startsWith(whole) ? 2_000 : 0) +
          (cho.size > 0 && e.titleCho.startsWith(whole) ? 1_000 : 0) +
          (e.titleNorm.startsWith(first) || (cho.has(first) && e.titleCho.startsWith(first))
            ? 5_000
            : 0) +
          Math.min(bodyHits, 999);
        scored.push({ e, score, inTitle });
      }
      scored.sort((a, b) => b.score - a.score || b.e.updatedAt.localeCompare(a.e.updatedAt));
      return scored.slice(0, limit).map(({ e, inTitle }) => {
        const first = Math.min(...terms.map((t) => e.bodyNorm.indexOf(t)).filter((i) => i >= 0));
        const start = Number.isFinite(first) ? Math.max(0, first - SNIPPET_BEFORE) : 0;
        const end = Math.min(e.body.length, start + SNIPPET_LENGTH);
        // 단어 중간에서 자르지 않게 가까운 공백까지만 넓힌다(멀리 있으면 그 자리에서 자른다)
        const space = start > 0 ? e.body.lastIndexOf(" ", start) : -1;
        const from = start === 0 ? 0 : space >= start - SNIPPET_WORD_REACH ? space + 1 : start;
        const prefix = from > 0 ? "…" : "";
        const suffix = end < e.body.length ? "…" : "";
        const snippet = prefix + e.body.slice(from, end) + suffix;
        const shift = prefix.length - from;
        const highlights = ranges(e.bodyNorm.slice(from, end), terms).map(
          ([a, b]) => [a + from + shift, b + from + shift] as [number, number],
        );
        return {
          id: e.id,
          title: e.title,
          icon: e.icon,
          snippet,
          highlights,
          matchIn: inTitle ? "title" : "body",
        };
      });
    },
  };
}

export type SearchIndex = ReturnType<typeof createSearchIndex>;
