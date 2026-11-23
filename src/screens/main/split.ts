import { pagesStore } from "@/features/pages";
import { sessionStore, useSession } from "@/features/session";
import { toast } from "@/components/ui/toast";
import { openPage } from "./actions";
import { resolveMention } from "./mention-model";
import {
  canSplit,
  clampPaneWidth,
  closePane,
  isPaneable,
  openInPane,
  PANE_STEP,
  resetPane,
  resizePane,
  swapSides,
  type Side,
  type SplitState,
} from "./split-model";
import { useMainUi } from "./ui-store";

/**
 * 분할 화면 동작 (SHELL-19). 오른쪽 패널은 페이지 하나이고, 값은 session(워크스페이스마다)에 저장한다.
 * 주 화면의 페이지는 기존 activeId가 그대로 쥔다. 탭(SHELL-11)과는 따로 움직인다.
 */

const read = (): SplitState => {
  const s = sessionStore.getState();
  return { pageId: s.splitId, width: s.splitWidth };
};
const write = (state: SplitState) => sessionStore.getState().setSplit(state);
const mainId = () => sessionStore.getState().activeId;

/** 패널이 지금 보이는가 — 집중 모드·좁은 창이면 상태는 남기고 숨긴다 */
export function paneShown(): boolean {
  const ui = useMainUi.getState();
  return read().pageId !== null && !ui.focusMode && canSplit(ui.splitArea);
}

/** 지금 포커스가 있는 쪽(숨은 패널이면 주 화면) */
export function activeSideNow(): Side {
  return useMainUi.getState().activeSide === "pane" && paneShown() ? "pane" : "main";
}

/**
 * 이 쪽을 흐리게 할지 (SHELL-19). 패널이 보이고 포커스가 다른 쪽에 있을 때만 true.
 * 패널이 없으면 항상 false라 주 화면 상단 바는 그대로다.
 */
export function useInactiveSide(side: Side): boolean {
  const activeSide = useMainUi((s) => s.activeSide);
  const splitId = useSession((s) => s.splitId);
  const focusMode = useMainUi((s) => s.focusMode);
  const splitArea = useMainUi((s) => s.splitArea);
  const shown = splitId !== null && !focusMode && canSplit(splitArea);
  return shown && activeSide !== side;
}

/** 쪽에 보이는 페이지 id */
export function pageIdOf(side: Side): string | null {
  return side === "pane" ? read().pageId : mainId();
}

/** 페이지를 오른쪽에 연다. 같은 페이지가 주 화면에 있으면 주 화면에 포커스만 준다 (SHELL-19) */
export function openInRightPane(id: string) {
  const page = pagesStore.getState().pages[id];
  if (!page || !isPaneable(page.kind, !!page.template)) {
    toast("이 페이지는 오른쪽에 열 수 없어요", { id: "split" });
    return;
  }
  const ui = useMainUi.getState();
  if (!canSplit(ui.splitArea)) {
    toast("창이 좁아 오른쪽에 열 수 없어요", { id: "split" });
    return;
  }
  // 집중 모드에서 열면 집중 모드를 끈다(패널이 보여야 한다)
  if (ui.focusMode) ui.setFocusMode(false);
  const r = openInPane(mainId(), read(), id);
  const prev = read().pageId;
  if (r.focus === "pane" && prev && prev !== id) void pagesStore.getState().flushPage(prev);
  write(r.split);
  ui.setActiveSide(r.focus);
}

/** 주 화면과 패널의 페이지를 맞바꾼다 (주 화면과 바꾸기) */
export function swapSplit() {
  const before = read();
  if (!before.pageId) return;
  const r = swapSides(mainId(), before);
  // 패널을 먼저 고쳐 두면 주 화면을 바꿀 때 "패널 페이지를 주 화면에서 열기" 규칙이 걸리지 않는다
  write(r.split);
  if (r.main) openPage(r.main);
  else sessionStore.getState().open(null);
}

/** 패널을 닫는다. 포커스는 주 화면으로 */
export function closeSplit() {
  const before = read();
  if (before.pageId) void pagesStore.getState().flushPage(before.pageId);
  write(closePane(before));
  useMainUi.getState().setActiveSide("main");
  // 패널이 사라지면 포커스가 body로 빠진다. 주 화면 제목으로 돌린다 (키보드·마우스 공통)
  // rAF는 창이 뒤에 있으면 멈추므로 setTimeout으로 (use-restore-focus와 같은 이유)
  setTimeout(() => document.querySelector<HTMLElement>('[aria-label="페이지 제목"]')?.focus(), 0);
}

/** 드래그·키보드로 패널 폭을 바꾼다 (영역 안으로 맞춘다) */
export function resizeSplit(width: number) {
  write(resizePane(read(), width, useMainUi.getState().splitArea));
}

/** 현재 보이는 폭 (상태가 null이면 절반) */
export function currentPaneWidth(): number {
  return clampPaneWidth(read().width, useMainUi.getState().splitArea);
}

/** 키보드 ←(패널 넓게) · →(패널 좁게) */
export function nudgeSplit(dir: -1 | 1) {
  resizeSplit(currentPaneWidth() - dir * PANE_STEP);
}

/** 두 번 눌러 기본 폭 */
export function resetSplitWidth() {
  write(resetPane(read()));
}

/**
 * 주 화면이 패널의 페이지를 열면(사이드바·탭·링크) 두 쪽에 같은 페이지가 생기므로 자리를 맞바꾼다.
 * 패널이 가리키던 페이지는 주 화면에서 밀려난다. 빈 주 화면이면 패널을 닫는다.
 */
function onMainOpened(prevMain: string | null, nowMain: string | null) {
  const split = read();
  if (!split.pageId || nowMain !== split.pageId) return;
  const pages = pagesStore.getState().pages;
  const movable = prevMain && resolveMention(pages, prevMain) && isPaneable(pages[prevMain]?.kind);
  if (prevMain && movable) write({ pageId: prevMain, width: split.width });
  else write(closePane(split));
}

/**
 * 화면 동기화 — 주 화면 페이지가 패널과 겹치면 맞바꾼다(지워진 패널은 main-screen이 닫는다).
 * 워크스페이스를 바꾸는 중에는 건드리지 않는다(initTabs가 여는 첫 페이지는 겹치지 않는다).
 * MainScreen이 한 번 건다. 등록을 풀 함수를 돌려준다.
 */
export function installSplitSync(): () => void {
  let prevMain = sessionStore.getState().activeId;
  let prevWorkspace = sessionStore.getState().workspace;
  const offSession = sessionStore.subscribe((s) => {
    const nowMain = s.activeId;
    const sameWorkspace = s.workspace === prevWorkspace;
    if (sameWorkspace && prevMain && nowMain !== prevMain && nowMain === s.splitId) {
      onMainOpened(prevMain, nowMain);
    }
    prevMain = nowMain;
    prevWorkspace = s.workspace;
  });
  return () => {
    offSession();
  };
}
