import type { Editor } from "@tiptap/core";

/** 떠 있는 바가 가장자리에서 떨어져 있을 간격 (--s2 토큰) */
const EDGE_GAP = "--s2";

/** 토큰(CSS 변수)의 px 값. 읽을 수 없으면 0 */
function tokenPx(name: string): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : 0;
}

/** 에디터 본문을 감싸는 가장 가까운 세로 스크롤 요소. 없으면 null */
function editorScrollParent(editor: Editor): HTMLElement | null {
  let el: HTMLElement | null;
  try {
    el = editor.view.dom.parentElement;
  } catch {
    return null;
  }
  while (el) {
    const oy = getComputedStyle(el).overflowY;
    if (oy === "auto" || oy === "scroll") return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * 떠 있는 바(서식·표 도구)의 flip/shift 경계.
 * 뷰포트 대신 에디터 스크롤 영역을 쓰고, 상단 바(--topbar-h)가 그 영역을 덮는 만큼 위쪽 여백을 더한다.
 */
export function floatingBounds(editor: Editor) {
  const scroller = editorScrollParent(editor);
  const gap = tokenPx(EDGE_GAP);
  let topInset = 0;
  if (scroller) {
    const top = tokenPx("--topbar-h");
    const rect = scroller.getBoundingClientRect();
    topInset = Math.max(0, top - rect.top);
  }
  const boundary: HTMLElement | "clippingAncestors" = scroller ?? "clippingAncestors";
  const padding = { top: topInset + gap, right: gap, bottom: gap, left: gap };
  return {
    scrollTarget: scroller ?? undefined,
    flip: { boundary, padding },
    shift: { boundary, padding },
  };
}

/** 선택이 들어 있는 표 요소 (표 편집 바의 기준 사각형). 없으면 null */
export function currentTableElement(editor: Editor): HTMLElement | null {
  try {
    const { node } = editor.view.domAtPos(editor.state.selection.anchor);
    const el = node instanceof HTMLElement ? node : node.parentElement;
    return el?.closest("table") ?? null;
  } catch {
    return null;
  }
}
