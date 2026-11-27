/**
 * 표 고정 칸 계산 (COLL-02). 칸 색인 0은 제목, 1부터는 제목 뒤 속성 칸이다.
 * 고정 칸 수 `pinned`는 "보이는 속성 칸 가운데 앞에서 N개"이고, 제목은 항상 고정이다.
 */

/** 고정 칸 수를 보이는 속성 칸 수 안의 정수로 맞춘다 */
export function clampPinned(pinned: number, columnCount: number): number {
  if (!Number.isFinite(pinned)) return 0;
  return Math.max(0, Math.min(Math.floor(pinned), columnCount));
}

/** 색인 index 칸이 고정인지 (0 = 제목은 늘 고정) */
export function isPinnedIndex(index: number, pinned: number): boolean {
  return index <= pinned;
}

/** 고정 구역의 맨 끝 칸인지 — 가로 스크롤 때 구분선을 긋는 칸 (0이면 제목) */
export function isPinEdgeIndex(index: number, pinned: number): boolean {
  return index === pinned;
}

/**
 * 색인 index 칸의 sticky left(px). 앞 칸들의 너비 합이라서 고정 칸은 앞 칸 뒤에 차곡차곡 쌓인다.
 * widths는 제목을 맨 앞에 둔 칸 너비 목록(px)이다. 고정이 아닌 칸에는 쓰지 않는다.
 */
export function stickyLeft(widths: readonly number[], index: number): number {
  let left = 0;
  for (let i = 0; i < index && i < widths.length; i++) left += widths[i] ?? 0;
  return left;
}
