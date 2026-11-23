/**
 * 분할 화면 (SHELL-19) 순수 로직 — 오른쪽 패널 한 개의 페이지, 폭, 포커스 자리.
 * 화면·저장과 떨어져 있어 단위 테스트로 상태 전이를 확인한다.
 */

/** 두 쪽 — 왼쪽(주 화면)과 오른쪽 패널 */
export type Side = "main" | "pane";

/** 오른쪽 패널 폭의 하한·상한 (px). 상한은 넓이의 60%이고 주 화면은 MAIN_MIN 아래로 줄지 않는다 */
export const PANE_MIN = 320;
export const PANE_MAX_RATIO = 0.6;
export const MAIN_MIN = 360;
/** 이보다 좁은 영역에서는 패널을 숨긴다(상태는 남긴다) */
export const SPLIT_MIN_AREA = PANE_MIN + MAIN_MIN;
/** 키보드 ←→ 한 번에 움직이는 폭 (px) */
export const PANE_STEP = 16;

export type { SplitState } from "@/features/session/split-state";
import type { SplitState } from "@/features/session/split-state";

/** 패널 폭을 영역 안에서 허용되는 값으로 맞춘다. width가 null이면 절반 */
export function paneMax(area: number): number {
  return Math.max(PANE_MIN, Math.min(area * PANE_MAX_RATIO, area - MAIN_MIN));
}

export function clampPaneWidth(width: number | null, area: number): number {
  const max = paneMax(area);
  if (width === null || !Number.isFinite(width)) return Math.round(clamp(area / 2, PANE_MIN, max));
  return Math.round(clamp(width, PANE_MIN, max));
}

/** 영역이 분할을 보일 만큼 넓은지 */
export const canSplit = (area: number) => area >= SPLIT_MIN_AREA;

/** 페이지를 오른쪽에 연다. 주 화면과 같은 페이지면 주 화면에 포커스만 준다(중복 편집기를 만들지 않는다) */
export function openInPane(
  mainId: string | null,
  state: SplitState,
  pageId: string,
): { main: string | null; split: SplitState; focus: Side } {
  if (pageId === mainId) return { main: mainId, split: state, focus: "main" };
  return { main: mainId, split: { pageId, width: state.width }, focus: "pane" };
}

/** 주 화면과 패널의 페이지를 맞바꾼다. 패널이 비었으면 그대로 */
export function swapSides(
  mainId: string | null,
  state: SplitState,
): { main: string | null; split: SplitState } {
  if (!state.pageId) return { main: mainId, split: state };
  return { main: state.pageId, split: { pageId: mainId, width: state.width } };
}

/** 패널을 닫는다. 폭은 기억한다(다시 열 때 같은 폭) */
export const closePane = (state: SplitState): SplitState => ({ pageId: null, width: state.width });

/** 키보드·드래그로 폭을 바꾼 결과 (px, 영역 안으로 맞춘다) */
export function resizePane(state: SplitState, width: number, area: number): SplitState {
  return { ...state, width: clampPaneWidth(width, area) };
}

/** 두 번 눌러 기본 폭(절반)으로 */
export const resetPane = (state: SplitState): SplitState => ({ ...state, width: null });

/** 패널에 올릴 수 있는 페이지인지 — 문서만(컬렉션·폴더·템플릿 제외. 보수적 선택, features.md SHELL-19 비고) */
export const isPaneable = (kind: string | undefined, template?: boolean) =>
  kind === "page" && !template;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}
