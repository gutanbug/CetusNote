import type { Editor } from "@tiptap/core";

/** 스토리 play 전용: 견본 안 에디터 인스턴스 (Tiptap이 view.dom.editor에 달아 둔다) */
export function getEditor(root: HTMLElement): Editor {
  const dom = root.querySelector<HTMLElement & { editor?: Editor }>(".ProseMirror");
  if (!dom?.editor) throw new Error("에디터를 찾지 못했어요");
  return dom.editor;
}

/** 블록 요소 가운데에 마우스를 올린다 (블록 핸들은 좌표로 블록을 찾는다) */
export function hoverBlock(el: Element) {
  const r = el.getBoundingClientRect();
  const init = { bubbles: true, clientX: r.left + 8, clientY: r.top + r.height / 2 };
  el.dispatchEvent(new MouseEvent("mouseover", init));
  el.dispatchEvent(new MouseEvent("mousemove", init));
}
