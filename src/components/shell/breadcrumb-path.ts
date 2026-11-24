/**
 * 경로 생략 규칙 (SH-Breadcrumb · ED-Breadcrumb 공용).
 * 맨 위 항목 + "more"(…) + 마지막 (maxItems-2)개를 보이고, 가운데는 숨긴다.
 * maxItems는 최소 3으로 올린다(처음·…·현재가 항상 있어야 하므로).
 */
export type CollapsedPath<T> = {
  shown: (T | "more")[];
  hidden: T[];
};

export function collapsePath<T>(items: readonly T[], maxItems = 4): CollapsedPath<T> {
  const limit = Math.max(3, maxItems);
  if (items.length <= limit) return { shown: [...items], hidden: [] };
  const keepTail = limit - 2;
  return {
    shown: [items[0], "more", ...items.slice(items.length - keepTail)],
    hidden: items.slice(1, items.length - keepTail),
  };
}
