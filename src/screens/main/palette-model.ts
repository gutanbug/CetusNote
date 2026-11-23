import { displayTitle } from "@/features/pages/title";
import { buildPageTree } from "@/features/pages/tree";
import type { SearchIndex } from "@/features/search";
import { isChoseong, toChoseong } from "@/lib/hangul";
import type { Page } from "@/lib/storage";

/**
 * 보이는 페이지 id(휴지통 · 휴지통에 넣은 폴더 안은 빠진다).
 * 트리는 컬렉션의 레코드(보드 카드)를 그리지 않지만, 레코드도 문서다 —
 * 컬렉션이 보이고 레코드가 휴지통에 없으면 보이는 것으로 넣는다(검색·멘션·할 일·태그·페이지로 열기).
 */
export function visibleIds(pages: Record<string, Page>): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: ReturnType<typeof buildPageTree>) =>
    nodes.forEach((n) => {
      ids.add(n.id);
      if (n.children) walk(n.children);
    });
  walk(buildPageTree(Object.values(pages)));
  for (const p of Object.values(pages)) {
    const parent = p.parentId ? pages[p.parentId] : undefined;
    if (p.kind === "page" && !p.trashedAt && parent?.kind === "collection" && ids.has(parent.id))
      ids.add(p.id);
  }
  return ids;
}

/** 최근 항목 — 문서·컬렉션·컬렉션의 레코드(보드 카드). 폴더와 보이지 않는 것은 뺀다 */
export function recentPages(ids: string[], pages: Record<string, Page>, visible: Set<string>) {
  return ids
    .map((id) => pages[id])
    .filter((p): p is Page => !!p && p.kind !== "folder" && visible.has(p.id));
}

/** "업무 / 회의" — 부모들 (가까운 것이 오른쪽) */
export function pagePath(page: Page, pages: Record<string, Page>): string {
  const names: string[] = [];
  const seen = new Set([page.id]);
  for (let p = page.parentId ? pages[page.parentId] : undefined; p && !seen.has(p.id);) {
    seen.add(p.id);
    names.unshift(displayTitle(p));
    p = p.parentId ? pages[p.parentId] : undefined;
  }
  return names.join(" / ");
}

export type PaletteItem = {
  id: string;
  title: string;
  icon: string | null;
  path: string;
  snippet: string;
  /** snippet 안 강조 범위 */
  highlights: [number, number][];
  /** title 안 강조 범위 */
  titleHighlights: [number, number][];
};

const RECENT_LIMIT = 8;
const RESULT_LIMIT = 30;

/** 같은 길이로 비교 가능한 글자에서 검색어 위치 (NFC + 소문자, 한글 초성 포함) */
function titleRanges(title: string, query: string): [number, number][] {
  const norm = title.normalize("NFC").toLowerCase();
  if (norm.length !== title.length) return [];
  const cho = toChoseong(norm);
  const out: [number, number][] = [];
  for (const t of new Set(query.normalize("NFC").toLowerCase().split(/\s+/).filter(Boolean))) {
    // 초성만 친 낱말(ㅁㅅ)은 제목의 초성에서 찾는다 — 글자 그대로 맞는 곳이 있으면 그쪽
    const hay = isChoseong(t) && !norm.includes(t) ? cho : norm;
    for (let i = hay.indexOf(t); i !== -1; i = hay.indexOf(t, i + t.length))
      out.push([i, i + t.length]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/** ⌘K 목록: 검색어가 없으면 최근에 고친 문서, 있으면 검색 결과(보이는 문서만) */
export function paletteItems(
  query: string,
  pages: Record<string, Page>,
  index: Pick<SearchIndex, "search">,
): PaletteItem[] {
  const visible = visibleIds(pages);
  const q = query.trim();
  if (!q) {
    return Object.values(pages)
      .filter((p) => p.kind !== "folder" && visible.has(p.id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, RECENT_LIMIT)
      .map((p) => ({
        id: p.id,
        title: displayTitle(p),
        icon: p.icon,
        path: pagePath(p, pages),
        snippet: "",
        highlights: [],
        titleHighlights: [],
      }));
  }
  // 휴지통 폴더 안의 문서는 인덱스에는 있지만 보이지 않으므로 넉넉히 찾고 거른다
  return index
    .search(q, { limit: RESULT_LIMIT * 2 })
    .filter((r) => visible.has(r.id) && pages[r.id])
    .slice(0, RESULT_LIMIT)
    .map((r) => ({
      id: r.id,
      title: r.title || displayTitle(pages[r.id]!),
      icon: r.icon,
      path: pagePath(pages[r.id]!, pages),
      snippet: r.snippet,
      highlights: r.highlights,
      titleHighlights: titleRanges(r.title, q),
    }));
}

/** `>`로 시작하면 명령만 찾는다 (SRCH-02, 편집기들의 관례) */
export function isCommandQuery(query: string): boolean {
  return query.trimStart().startsWith(">");
}

const fold = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

/** 명령 거르기: 이름·다른 이름에 띄어 쓴 낱말이 모두 들어 있으면 맞다. 빈 검색어는 전부 */
export function matchCommands<T extends { title: string; keywords?: string[] }>(
  query: string,
  commands: T[],
): T[] {
  const terms = fold(query.trimStart().replace(/^>/, "")).split(" ").filter(Boolean);
  if (!terms.length) return commands;
  return commands.filter((c) => {
    const hay = fold([c.title, ...(c.keywords ?? [])].join(" "));
    return terms.every((t) => hay.includes(t));
  });
}
