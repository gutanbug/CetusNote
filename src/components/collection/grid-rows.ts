import { windowRange } from "@/components/shell/page-tree-rows";

/**
 * CL-GridView 행 창 계산 (React 없음, SYS-11). 행은 `h-9`(36px)로 높이가 고정이라 높이를 재지 않는다.
 * 스크롤 영역 안에서 tbody가 있는 위치(offset)를 빼고 보이는 구간을 구한다.
 */

/** 행 높이(px). CL-GridView 행의 `h-9`와 같아야 한다 */
export const GRID_ROW_HEIGHT = 36;

export type GridView = {
  /** 스크롤 위치 */
  top: number;
  /** 스크롤 영역의 보이는 높이 */
  height: number;
  /** tbody 맨 위가 스크롤 내용에서 있는 위치 */
  offset: number;
};

/**
 * 그릴 행 구간 [first, last). 보이는 구간 + 위아래 여유 행만 그린다. 활성 행을 억지로 넣지 않는다 —
 * 활성 행이 구간 밖이면 키보드로 옮길 때 먼저 스크롤해 구간 안에 들인다(grid-view.tsx revealRow).
 * 보이는 높이를 아직 못 잰 때(0)는 앞쪽 `fallbackRows`개만 그린다.
 */
export function gridRowRange(
  view: GridView,
  count: number,
  { overscan = 8, fallbackRows = 40 } = {},
): { first: number; last: number } {
  return windowRange(view.top - view.offset, view.height, count, {
    rowHeight: GRID_ROW_HEIGHT,
    overscan,
    fallbackRows,
  });
}
