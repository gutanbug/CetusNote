import type * as React from "react";

/**
 * 라디오 그룹·세로 탭 목록의 방향키 이동. 키를 처리했으면 다음 값을 돌려준다.
 * 가로·세로 방향키를 모두 받고 Home/End로 처음·끝으로 간다.
 */
export function rovingKey<T>(
  e: React.KeyboardEvent,
  values: readonly T[],
  current: T,
  /** vertical = 세로 탭 목록(↑↓만). both = 라디오 그룹(가로·세로 모두) */
  orientation: "vertical" | "both" = "both",
): T | undefined {
  const i = values.indexOf(current);
  const fwd = e.key === "ArrowDown" || (orientation === "both" && e.key === "ArrowRight");
  const back = e.key === "ArrowUp" || (orientation === "both" && e.key === "ArrowLeft");
  const next = fwd
    ? values[(i + 1) % values.length]
    : back
      ? values[(i - 1 + values.length) % values.length]
      : e.key === "Home"
        ? values[0]
        : e.key === "End"
          ? values[values.length - 1]
          : undefined;
  if (next === undefined) return undefined;
  e.preventDefault();
  // 포커스를 새 값의 요소로 옮긴다 (같은 그룹 안의 [data-value])
  const group = (e.currentTarget as HTMLElement).closest("[data-roving]");
  requestAnimationFrame(() =>
    group?.querySelector<HTMLElement>(`[data-value="${String(next)}"]`)?.focus(),
  );
  return next;
}
