import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { Node as TiptapNode } from "@tiptap/core";
import { closedToggleAncestors, getHeadings, revealHeading } from "./outline";

// 페이지 멘션과 같은 모양(인라인 atom, label 속성)만 흉내 낸다
const MentionStub = TiptapNode.create({
  name: "pageMention",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({ id: { default: null }, label: { default: "" } }),
});

function makeEditor(content: JSONContent[]) {
  return new Editor({
    extensions: [
      StarterKit,
      MentionStub,
      Details.configure({ persist: true }),
      DetailsSummary,
      DetailsContent,
    ],
    content: { type: "doc", content },
  });
}

const text = (t: string): JSONContent => ({ type: "text", text: t });
const heading = (level: number, t: string): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [text(t)],
});
const toggle = (open: boolean, title: string, inner: JSONContent[]): JSONContent => ({
  type: "details",
  attrs: { open },
  content: [
    { type: "detailsSummary", content: [text(title)] },
    { type: "detailsContent", content: inner },
  ],
});

/** 문서에서 노드 타입과 열림 상태를 순서대로 */
function openStates(doc: ProseMirrorNode) {
  const out: boolean[] = [];
  doc.descendants((node) => {
    if (node.type.name === "details") out.push(Boolean(node.attrs.open));
  });
  return out;
}

describe("본문 목차 — 멘션만 있는 제목 (EDIT-27)", () => {
  it("글자 없이 멘션만 든 제목도 목차에 넣고 label을 쓴다", () => {
    const editor = makeEditor([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "pageMention", attrs: { id: "p1", label: "회의록" } }],
      },
      heading(1, "  "),
    ]);
    expect(getHeadings(editor).map((h) => h.text)).toEqual(["회의록"]);
  });
});

describe("목차 이동 — 접힌 토글 안의 제목 (EDIT-27 · PAGE-12)", () => {
  it("접힌 토글 안의 제목으로 가면 감싸는 토글을 펼친다", () => {
    const editor = makeEditor([
      heading(1, "처음"),
      toggle(false, "바깥", [toggle(false, "안쪽", [heading(2, "숨은 제목")])]),
    ]);
    const target = getHeadings(editor).find((h) => h.text === "숨은 제목")!;
    expect(closedToggleAncestors(editor.state.doc, target.pos)).toHaveLength(2);

    const tr = revealHeading(editor.state, target.pos)!;
    expect(tr).not.toBeNull();
    const next = editor.state.apply(tr);
    expect(openStates(next.doc)).toEqual([true, true]);
    // 제목 위치는 그대로, 캐럿은 제목 끝
    expect(next.doc.nodeAt(target.pos)?.textContent).toBe("숨은 제목");
    expect(next.selection.from).toBe(target.pos + next.doc.nodeAt(target.pos)!.nodeSize - 1);
  });

  it("이미 열린 토글은 그대로 두고, 닫힌 것만 펼친다", () => {
    const editor = makeEditor([
      toggle(true, "열림", [toggle(false, "닫힘", [heading(3, "깊은 제목")])]),
    ]);
    const target = getHeadings(editor)[0]!;
    const next = editor.state.apply(revealHeading(editor.state, target.pos)!);
    expect(next.doc.firstChild!.attrs.open).toBe(true);
    expect(next.doc.firstChild!.child(1).firstChild!.attrs.open).toBe(true);
  });

  it("토글 밖 제목은 열림 상태를 바꾸지 않는다", () => {
    const editor = makeEditor([heading(1, "본문"), toggle(false, "닫힘", [para("내용")])]);
    const target = getHeadings(editor)[0]!;
    expect(closedToggleAncestors(editor.state.doc, target.pos)).toEqual([]);
    const next = editor.state.apply(revealHeading(editor.state, target.pos)!);
    expect(openStates(next.doc)).toEqual([false]);
  });

  it("제목이 아닌 위치는 트랜잭션을 만들지 않는다", () => {
    const editor = makeEditor([para("글")]);
    expect(revealHeading(editor.state, 1)).toBeNull();
  });
});

const para = (t: string): JSONContent => ({ type: "paragraph", content: [text(t)] });
