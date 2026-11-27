import type { Editor } from "@tiptap/core";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { msg } from "@/lib/i18n";

export type Heading = {
  /** 제목 블록의 문서 위치 */
  pos: number;
  /** 1–3 */
  level: number;
  text: string;
};

/** 목차에 넣는 제목 수준 */
const MAX_LEVEL = 3;

/**
 * 제목 글자: 글자 + 인라인 덩어리(페이지 멘션 등)의 label. toc.ts의 plainText와 같은 규칙이다.
 * 덩어리가 들어 있으면 글자가 없어도 제목이 있는 것으로 본다(EDIT-27 목차에서 빠지지 않게).
 */
function headingText(node: PMNode): { text: string; hasInline: boolean } {
  let text = "";
  let hasInline = false;
  node.descendants((child) => {
    if (child.isText) text += child.text;
    else if (child.isInline) {
      hasInline = true;
      text += String(child.attrs.label ?? "");
    }
    return true;
  });
  return { text: text.trim(), hasInline };
}

/** 본문의 제목(H1–H3)을 문서 순서대로 (PAGE-12). 토글·콜아웃 안의 제목도 넣는다. 글자도 덩어리도 없는 제목만 뺀다 */
export function getHeadings(editor: Editor): Heading[] {
  const out: Heading[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      const level = Number(node.attrs.level) || 1;
      const { text, hasInline } = headingText(node);
      if (level <= MAX_LEVEL && (text || hasInline))
        out.push({ pos, level, text: text || msg().editor.untitled });
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

/** 제목을 감싸는 접힌 토글(details)들의 위치 (바깥 → 안). 접힌 내용은 화면에 없어 스크롤이 닿지 않는다 */
export function closedToggleAncestors(doc: PMNode, pos: number): number[] {
  const $pos = doc.resolve(pos);
  const out: number[] = [];
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "details" && !node.attrs.open) out.push($pos.before(depth));
  }
  return out.reverse();
}

/**
 * 제목 위치를 보이게 할 트랜잭션: 접힌 토글 ancestors를 펼치고(토글의 open 속성), 제목 끝에 캐럿을 둔다.
 * 펼치기는 노드 크기를 바꾸지 않으므로 제목 위치는 그대로다. 제목이 아니면 null.
 */
export function revealHeading(state: EditorState, pos: number): Transaction | null {
  const node = state.doc.nodeAt(pos);
  if (node?.type.name !== "heading") return null;
  const tr = state.tr;
  for (const togglePos of closedToggleAncestors(state.doc, pos)) {
    const toggle = state.doc.nodeAt(togglePos)!;
    tr.setNodeMarkup(togglePos, undefined, { ...toggle.attrs, open: true });
  }
  return tr.setSelection(TextSelection.create(tr.doc, pos + node.nodeSize - 1));
}

/**
 * 제목으로 간다: 접힌 토글을 펼치고, 캐럿을 두고, 그 제목을 스크롤 영역 맨 위로.
 * smooth면 부드럽게(목차 블록, ED-TableOfContents). 기본은 바로 — 모션 줄이기는 호출한 쪽이 정한다.
 */
export function goToHeading(editor: Editor, heading: Heading, options: { smooth?: boolean } = {}) {
  if (editor.isDestroyed) return;
  const tr = revealHeading(editor.state, heading.pos);
  if (!tr) return;
  editor.view.dispatch(tr);
  editor.view.focus();
  // 펼친 토글의 내용이 레이아웃에 잡힌 다음 프레임에 스크롤한다 (바로 하면 숨은 제목에서 멈춘다)
  requestAnimationFrame(() => {
    if (editor.isDestroyed) return;
    const dom = editor.view.nodeDOM(heading.pos);
    if (dom instanceof Element)
      dom.scrollIntoView({ block: "start", behavior: options.smooth ? "smooth" : "auto" });
  });
}
