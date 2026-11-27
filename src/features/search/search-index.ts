import { findHangul, hangulPatterns, type HangulPattern, type Span } from "@/lib/hangul";
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
    // 파일 첨부는 파일 이름으로 찾는다 (EDIT-31~33)
    else if (n.type === "attachment") parts.push(String(n.attrs?.name ?? ""), "\n");
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

/** 글자 그대로 낱말이 몇 번 있는지 (cap까지만 센다) */
function countWord(text: string, word: string, cap = 50): number {
  let n = 0;
  for (let i = text.indexOf(word); i !== -1 && n < cap; i = text.indexOf(word, i + word.length))
    n++;
  return n;
}

/** 패턴이 본문에 몇 번 맞는지 (cap까지만 센다). 글자 그대로 낱말은 indexOf가 더 빠르다 */
function countOf(text: string, p: HangulPattern, cap = 50): number {
  if (p.literal) return countWord(text, p.word, cap);
  let n = 0;
  const all = text.matchAll(p.g);
  while (n < cap && !all.next().done) n++;
  return n;
}

export function createSearchIndex() {
  const entries = new Map<string, Entry>();
  /**
   * 아직 본문을 색인하지 않은 페이지 (SYS-11). 고칠 때마다 본문 전체를 낱말로 쪼개면 긴 문서에서 입력이 느려지므로,
   * upsert는 페이지만 맡아 두고 찾기·개수 확인·flush 때 한 번에 만든다. 같은 페이지를 여러 번 고쳐도 마지막 것만 만든다.
   */
  const pending = new Map<string, Page>();
  /**
   * 본문을 아직 안 읽은 페이지의 제목만 바뀐 것 (SYS-10, ADR-022). 본문 색인은 그대로 두고 제목만 고친다 —
   * 자리 값 본문으로 다시 만들면 본문 검색이 사라진다.
   */
  const titleOnly = new Set<string>();

  const toEntry = (page: Page): Entry => {
    const body = display(docText(page.content));
    // 소문자로 바꿔 길이가 달라지는 드문 글자(İ 등)는 위치 계산이 어긋나므로 보여 주기용을 비교용과 맞춘다
    const bodyNorm = normalize(body);
    return {
      id: page.id,
      title: page.title,
      icon: page.icon,
      titleNorm: normalize(page.title),
      body: bodyNorm.length === body.length ? body : bodyNorm,
      bodyNorm,
      updatedAt: page.updatedAt,
      // 템플릿(PAGE-14)은 휴지통처럼 일반 검색에서 뺀다
      trashed: page.trashedAt !== null || page.template !== null,
    };
  };

  const flush = () => {
    if (pending.size === 0) return;
    for (const page of pending.values()) {
      if (page.kind === "folder") entries.delete(page.id);
      else {
        const entry = toEntry(page);
        const prev = entries.get(page.id);
        if (titleOnly.has(page.id) && prev) {
          entry.body = prev.body;
          entry.bodyNorm = prev.bodyNorm;
        }
        entries.set(page.id, entry);
      }
    }
    pending.clear();
    titleOnly.clear();
  };

  return {
    /** 처음 한 번: 모든 페이지로 다시 만든다 (본문이 없는 페이지는 제목만 찾인다) */
    build(pages: Iterable<Page>) {
      pending.clear();
      titleOnly.clear();
      entries.clear();
      for (const p of pages) if (p.kind !== "folder") entries.set(p.id, toEntry(p));
    },
    /** 폴더는 찾지 않는다(본문이 없다, SHELL-14). 본문 색인은 다음 찾기·flush 때 한다 */
    upsert(page: Page) {
      pending.set(page.id, page);
      titleOnly.delete(page.id);
    },
    /** 본문을 아직 안 읽은 페이지: 제목·아이콘만 고치고 이전 본문 색인은 남긴다 */
    upsertTitle(page: Page) {
      pending.set(page.id, page);
      titleOnly.add(page.id);
    },
    remove(id: string) {
      pending.delete(id);
      titleOnly.delete(id);
      entries.delete(id);
    },
    /** 밀린 페이지를 지금 색인한다(유휴 시간에 부른다). 찾기는 스스로 먼저 부른다 */
    flush,
    get size() {
      flush();
      return entries.size;
    },
    /**
     * 찾기. 순위: 제목이 검색어와 같음 → 제목에 모두 있음 → 제목이 검색어로 시작 → 본문에서 맞은 횟수 → 최근에 고친 순.
     * 초성만 친 낱말(ㅁㅅ)은 제목의 초성과도 맞춘다(본문은 글자 그대로만).
     * 휴지통 페이지는 빼고 찾는다(includeTrashed로 포함).
     */
    search(query: string, { limit = 50, includeTrashed = false } = {}): SearchResult[] {
      flush();
      const whole = normalize(query);
      const pats = hangulPatterns(query);
      if (!pats.length) return [];
      const first = pats[0]!;
      const wholePrefix = hangulPatterns(query, { prefix: true })[0]!;
      // 제목 전체가 검색어와 맞는지(초성·입력 중 규칙 포함) — 글자 그대로 같은 것보다는 한 단계 아래
      const wholeExact = new RegExp(`${wholePrefix.re.source}$`, "u");
      const firstPrefix = hangulPatterns(first.word, { prefix: true })[0]!;
      const scored: { e: Entry; score: number; inTitle: boolean }[] = [];
      for (const e of entries.values()) {
        if (e.trashed && !includeTrashed) continue;
        // 글자 그대로 모두 맞으면 inTitleLit, 초성·입력 중 규칙까지 쓰면 inTitle
        let inTitle = true;
        let inTitleLit = true;
        let ok = true;
        let bodyHits = 0;
        for (const p of pats) {
          const t1 = p.re.test(e.titleNorm);
          if (!t1) inTitle = false;
          if (!(p.exact && e.titleNorm.includes(p.word))) inTitleLit = false;
          const b = countOf(e.bodyNorm, p);
          if (!t1 && !b) {
            ok = false;
            break;
          }
          // 본문은 글자 그대로 맞은 횟수만 순위에 쓴다 (초성으로만 맞은 본문은 맨 뒤)
          if (p.exact) bodyHits += p.literal ? b : countWord(e.bodyNorm, p.word);
        }
        if (!ok) continue;
        const score =
          (e.titleNorm === whole ? 20_000 : wholeExact.test(e.titleNorm) ? 15_000 : 0) +
          (inTitleLit ? 10_000 : inTitle ? 6_000 : 0) +
          (e.titleNorm.startsWith(whole) ? 2_000 : wholePrefix.re.test(e.titleNorm) ? 1_000 : 0) +
          (first.exact
            ? e.titleNorm.startsWith(first.word)
              ? 5_000
              : 0
            : firstPrefix.re.test(e.titleNorm)
              ? 2_500
              : 0) +
          Math.min(bodyHits, 999);
        scored.push({ e, score, inTitle });
      }
      scored.sort((a, b) => b.score - a.score || b.e.updatedAt.localeCompare(a.e.updatedAt));
      return scored.slice(0, limit).map(({ e, inTitle }) => {
        const spans = findHangul(e.bodyNorm, pats);
        const firstAt = spans[0]?.[0] ?? -1;
        const start = firstAt >= 0 ? Math.max(0, firstAt - SNIPPET_BEFORE) : 0;
        const end = Math.min(e.body.length, start + SNIPPET_LENGTH);
        // 단어 중간에서 자르지 않게 가까운 공백까지만 넓힌다(멀리 있으면 그 자리에서 자른다)
        const space = start > 0 ? e.body.lastIndexOf(" ", start) : -1;
        const from = start === 0 ? 0 : space >= start - SNIPPET_WORD_REACH ? space + 1 : start;
        const prefix = from > 0 ? "…" : "";
        const suffix = end < e.body.length ? "…" : "";
        const snippet = prefix + e.body.slice(from, end) + suffix;
        // 강조: 조각 안에 온전히 든 맞은 곳만, 조각 기준 위치로
        const highlights = spans
          .filter(([a, b]: Span) => a >= from && b <= end)
          .map(
            ([a, b]: Span) =>
              [a - from + prefix.length, b - from + prefix.length] as [number, number],
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
