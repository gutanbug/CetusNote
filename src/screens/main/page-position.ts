import type { Editor } from "@tiptap/core";
import { Selection, TextSelection } from "@tiptap/pm/state";
import * as React from "react";
import {
  blockStartFor,
  clampSelection,
  isDefaultPosition,
  pickRestore,
  wasJumpedTo,
  ratioOf,
  scrollTopFor,
  sessionStore,
  type PagePosition,
} from "@/features/session";

/**
 * 읽던 위치 (PAGE-15) — 화면 쪽. 계산 규칙은 features/session/page-position.ts.
 * 여기서는 DOM을 읽고 쓰고, 저장 시점(떠날 때·멈춘 뒤·창 밖으로 나갈 때)을 맡는다.
 */

type BlockDom = { pos: number; dom: HTMLElement };

/** 최상위 블록(문서 위치, DOM) 목록 — 화면에 그려진 것만 */
function topBlocks(editor: Editor): BlockDom[] {
  const out: BlockDom[] = [];
  editor.state.doc.forEach((_node, offset) => {
    const dom = editor.view.nodeDOM(offset);
    if (dom instanceof HTMLElement) out.push({ pos: offset, dom });
  });
  return out;
}

/** 스크롤 영역 맨 위 선에 걸친 블록과 비율을 읽는다 */
export function captureScroll(
  editor: Editor,
  scroller: HTMLElement,
): { block: number; ratio: number } | null {
  const blocks = topBlocks(editor);
  if (!blocks.length) return null;
  const line = scroller.getBoundingClientRect().top;
  // 윗변이 맨 위 선 이하인 마지막 블록 — 그 블록 안에 선이 걸쳐 있다. 없으면(머리 영역) 첫 블록
  let pick = blocks[0]!;
  for (const b of blocks) {
    if (b.dom.getBoundingClientRect().top <= line + 0.5) pick = b;
    else break;
  }
  const r = pick.dom.getBoundingClientRect();
  return { block: pick.pos, ratio: ratioOf(line - r.top, r.height) };
}

/** 저장된 블록·비율로 스크롤을 맞춘다. 블록이 없으면 false */
export function applyScroll(
  editor: Editor,
  scroller: HTMLElement,
  pos: { block: number; ratio: number },
): boolean {
  const starts: number[] = [];
  editor.state.doc.forEach((_node, offset) => starts.push(offset));
  const at = blockStartFor(starts, pos.block);
  if (at === null) return false;
  const dom = editor.view.nodeDOM(at);
  if (!(dom instanceof HTMLElement)) return false;
  // 블록의 콘텐츠 기준 윗변: 지금 스크롤 값과 무관하게 같다
  const line = scroller.getBoundingClientRect().top;
  const r = dom.getBoundingClientRect();
  const contentTop = r.top - line + scroller.scrollTop;
  scroller.scrollTop = scrollTopFor(contentTop, pos.ratio, r.height);
  return true;
}

/** 저장된 선택 범위를 문서 크기에 맞춰 놓는다. 글자 칸이 아니면 가까운 글자 칸으로 */
export function applySelection(editor: Editor, pos: { anchor: number; head: number }) {
  const { doc } = editor.state;
  const c = clampSelection(pos, doc.content.size);
  const $a = doc.resolve(c.anchor);
  const $h = doc.resolve(c.head);
  const sel =
    $a.parent.inlineContent && $h.parent.inlineContent
      ? TextSelection.create(doc, c.anchor, c.head)
      : Selection.near($a);
  editor.view.dispatch(editor.state.tr.setSelection(sel));
}

/**
 * 위치 기억 + 복원 훅. PageView가 편집기를 받은 뒤에 붙는다.
 * - 열 때: 편집기가 준비되면 한 번 복원한다(pickRestore). 이미지·표가 늦게 그려져 높이가 바뀌면
 *   사용자가 스크롤·입력하기 전까지(최대 2초) 블록 기준으로 다시 맞춘다.
 * - 저장: 스크롤은 500ms 멈춘 뒤, 캐럿은 바뀐 뒤 500ms, 떠날 때(언마운트), 창 포커스를 잃을 때, 닫을 때.
 */
export function usePagePosition({
  pageId,
  blank,
  editor,
  scrollerRef,
}: {
  pageId: string;
  blank: boolean;
  editor: Editor | null;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const restored = React.useRef(false);
  const ready = React.useRef(false);
  const editorRef = React.useRef<Editor | null>(null);

  // 1) 복원 — 편집기가 준비된 뒤 한 번
  React.useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!editor || editor.isDestroyed || !scroller || restored.current) return;
    restored.current = true;
    editorRef.current = editor;
    const saved = pickRestore({
      jumped: wasJumpedTo(pageId),
      blank,
      saved: sessionStore.getState().positionOf(pageId),
    });
    ready.current = true;
    if (!saved) return;
    applySelection(editor, saved);
    // 캐럿이 있는 곳에 포커스를 두되 화면을 옮기지 않는다(스크롤은 아래에서 맞춘다)
    editor.view.focus();
    applyScroll(editor, scroller, saved);

    // 늦게 그려지는 이미지·임베드는 높이를 바꾼다 — 사용자가 손대기 전까지 다시 맞춘다
    let settled = false;
    const userTook = () => finish();
    const finish = () => {
      if (settled) return;
      settled = true;
      ro.disconnect();
      window.clearTimeout(timer);
      for (const ev of INPUT_EVENTS) scroller.removeEventListener(ev, userTook);
    };
    const ro = new ResizeObserver(() => {
      if (!settled && !editor.isDestroyed) applyScroll(editor, scroller, saved);
    });
    ro.observe(editor.view.dom);
    const timer = window.setTimeout(finish, 2000);
    for (const ev of INPUT_EVENTS) scroller.addEventListener(ev, userTook, { passive: true });
    return finish;
  }, [editor, pageId, blank, scrollerRef]);

  // 2) 저장
  React.useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!editor || !scroller) return;
    editorRef.current = editor;
    let timer: number | undefined;

    const save = () => {
      const ed = editorRef.current;
      if (!ready.current || !ed || ed.isDestroyed) return;
      const cap = captureScroll(ed, scroller);
      if (!cap) return;
      const { anchor, head } = ed.state.selection;
      if (isDefaultPosition({ atTop: scroller.scrollTop <= 0, anchor, head })) {
        sessionStore.getState().forgetPositions([pageId]);
      } else {
        const pos: PagePosition = { ...cap, anchor, head };
        sessionStore.getState().remember(pageId, pos);
      }
    };
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(save, 500);
    };
    const flushNow = () => {
      window.clearTimeout(timer);
      save();
      void sessionStore.getState().flush();
    };

    scroller.addEventListener("scroll", later, { passive: true });
    editor.on("selectionUpdate", later);
    window.addEventListener("blur", flushNow);
    window.addEventListener("beforeunload", flushNow);
    return () => {
      scroller.removeEventListener("scroll", later);
      editor.off("selectionUpdate", later);
      window.removeEventListener("blur", flushNow);
      window.removeEventListener("beforeunload", flushNow);
      // 떠날 때 — 이 시점에는 아직 화면과 편집기가 살아 있다(레이아웃 정리 단계)
      save();
      window.clearTimeout(timer);
    };
  }, [editor, pageId, scrollerRef]);
}

/** 사용자가 직접 움직였다는 신호 — 이후에는 복원을 다시 맞추지 않는다 */
const INPUT_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
