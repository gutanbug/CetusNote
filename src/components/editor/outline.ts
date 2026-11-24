import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

export type Heading = {
  /** 제목 블록의 문서 위치 */
  pos: number;
  /** 1–3 */
  level: number;
  text: string;
};

/** 목차에 넣는 제목 수준 */
const MAX_LEVEL = 3;

/** 본문의 제목(H1–H3)을 문서 순서대로 (PAGE-12). 토글·콜아웃 안의 제목도 넣는다. 빈 제목은 뺀다 */
export function getHeadings(editor: Editor): Heading[] {
  const out: Heading[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      const level = Number(node.attrs.level) || 1;
      const text = node.textContent.trim();
      if (level <= MAX_LEVEL && text) out.push({ pos, level, text });
      return false;
    }
    // 코드 블록·표 안에는 제목이 없다
    return !node.isTextblock;
  });
  return out;
}

/**
 * 지금 보고 있는 제목: 스크롤 영역 위쪽 1/4 선을 지난 마지막 제목. 첫 제목보다 위면 -1.
 * scroller가 없거나 그려지지 않은 제목은 건너뛴다.
 */
export function currentHeading(editor: Editor, headings: Heading[], scroller: Element | null) {
  if (!scroller || editor.isDestroyed) return -1;
  // 끝까지 내려간 문서는 1/4 선을 넘는 제목이 없을 수 있다(짧은 문서). 그때는 마지막 제목이 지금 보는 제목
  if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 1)
    return headings.length - 1;
  const box = scroller.getBoundingClientRect();
  const line = box.top + box.height / 4;
  let current = -1;
  headings.forEach((h, i) => {
    const dom = editor.view.nodeDOM(h.pos);
    if (dom instanceof Element && dom.getBoundingClientRect().top <= line) current = i;
  });
  return current;
}

/**
 * 제목으로 간다: 제목 끝에 캐럿을 두고 그 제목을 스크롤 영역 맨 위로.
 * smooth면 부드럽게(목차 블록, ED-TableOfContents). 기본은 바로 — 모션 줄이기는 호출한 쪽이 정한다.
 */
export function goToHeading(editor: Editor, heading: Heading, options: { smooth?: boolean } = {}) {
  if (editor.isDestroyed) return;
  const node = editor.state.doc.nodeAt(heading.pos);
  if (node?.type.name !== "heading") return;
  const end = heading.pos + node.nodeSize - 1;
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, end)));
  editor.view.focus();
  const dom = editor.view.nodeDOM(heading.pos);
  if (dom instanceof Element)
    dom.scrollIntoView({ block: "start", behavior: options.smooth ? "smooth" : "auto" });
}
