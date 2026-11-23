import type { MentionTarget } from "@/components/editor/page-mention";
import { normalize } from "@/features/search";
import { displayTitle } from "@/features/pages/title";
import type { Page } from "@/lib/storage";
import type { PageMeta } from "@/features/pages";
import { visibleIds } from "./palette-model";

const LIMIT = 8;

/** 멘션할 수 있는 페이지 — 휴지통·폴더·지금 페이지는 빼고 */
function candidates(pages: Record<string, Page>, exceptId?: string): Page[] {
  return [...visibleIds(pages)]
    .map((id) => pages[id]!)
    .filter((p) => p.kind !== "folder" && p.id !== exceptId);
}

// 이름 없는 컬렉션 등도 멘션에 같은 이름으로 보인다
const toTarget = (p: PageMeta): MentionTarget => ({
  id: p.id,
  title: displayTitle(p),
  icon: p.icon,
});

/**
 * `@` 제안 (EDIT-13). 검색어가 없으면 최근에 연 순서 → 최근에 고친 순.
 * 있으면 `rankTitles`(검색 인덱스 — ⌘K와 같은 순위, SRCH-04)가 준 순서대로 고른다.
 * 순위 계산은 features/search가 맡고, 여기서는 멘션 대상만 거른다(폴더·휴지통·지금 페이지 제외).
 */
export function searchMentions(
  pages: Record<string, Page>,
  query: string,
  {
    exceptId,
    recent = [],
    rankTitles,
  }: {
    exceptId?: string;
    recent?: string[];
    /** 검색어에 맞는 페이지 id를 순위대로 (제목에 검색어가 모두 들어 있는 것만) */
    rankTitles: (query: string) => string[];
  },
): MentionTarget[] {
  const list = candidates(pages, exceptId);
  const rank = (p: Page) => {
    const r = recent.indexOf(p.id);
    return r === -1 ? Number.MAX_SAFE_INTEGER : r;
  };
  const byRecent = (a: Page, b: Page) =>
    rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt);
  if (!normalize(query)) return list.sort(byRecent).slice(0, LIMIT).map(toTarget);
  const byId = new Map(list.map((p) => [p.id, p]));
  return rankTitles(query)
    .map((id) => byId.get(id))
    .filter((p): p is Page => p !== undefined)
    .slice(0, LIMIT)
    .map(toTarget);
}

/** 멘션 대상 — 지워졌거나 휴지통(조상 포함)이면 null(깨진 링크) */
export function resolveMention(pages: Record<string, PageMeta>, id: string): MentionTarget | null {
  const p = pages[id];
  if (!p || p.kind === "folder" || p.trashedAt || p.template) return null;
  for (let at = p.parentId; at; at = pages[at]?.parentId ?? null)
    if (!pages[at] || pages[at]!.trashedAt) return null;
  return toTarget(p);
}

/** Markdown 내보내기용 — 멘션을 지금 제목으로 */
export function mentionTitleOf(pages: Record<string, Page>) {
  return (id: string) => {
    const t = resolveMention(pages, id);
    return t ? t.title || "제목 없음" : undefined;
  };
}
