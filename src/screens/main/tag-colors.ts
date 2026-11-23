import { SOFT_COLORS, type SoftColor } from "@/components/ui/tag-chip";

/** 저장된 색 이름을 칩 색으로 (모르는 값은 회색) */
export function tagColor(color: string | undefined): SoftColor {
  return (SOFT_COLORS as readonly string[]).includes(color ?? "") ? (color as SoftColor) : "gray";
}

/** 새 태그 색 — 회색을 뺀 8색을 차례로 돌린다 */
export function nextTagColor(existing: number): SoftColor {
  const palette = SOFT_COLORS.filter((c) => c !== "gray");
  return palette[existing % palette.length]!;
}

/** 문서마다 붙은 태그 → [태그, 페이지 수] (휴지통·폴더는 부르는 쪽이 뺀다). 많은 순, 같으면 이름순 */
export function countTags(docs: Iterable<{ props: { tags: string[] } }>): [string, number][] {
  const counts = new Map<string, number>();
  for (const p of docs)
    for (const t of new Set(p.props.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
}
