import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { alignmentShortcuts, TextAlignment } from "./text-align";

function makeEditor(content: JSONContent) {
  return new Editor({
    extensions: [StarterKit, TextAlignment.configure({ types: ["heading", "paragraph"] })],
    content,
  });
}

const para = (text: string, textAlign?: string): JSONContent => ({
  type: "paragraph",
  attrs: textAlign ? { textAlign } : undefined,
  content: text ? [{ type: "text", text }] : undefined,
});

/** 블록별 [글자, 정렬] — 정렬이 없으면 null */
function blocks(editor: Editor) {
  return editor
    .getJSON()
    .content?.map((n) => [
      (n.content?.[0] as JSONContent | undefined)?.text ?? "",
      (n.attrs?.textAlign as string | undefined) ?? null,
    ]);
}

/** 캐럿을 글자 `text`의 `offset` 뒤로 옮긴다 (첫 번째로 나오는 블록 기준) */
function caretAfter(editor: Editor, text: string, offset = text.length) {
  let pos = -1;
  editor.state.doc.descendants((node, p) => {
    if (pos < 0 && node.isText && node.text?.startsWith(text)) pos = p + offset;
  });
  editor.commands.setTextSelection(pos);
}

describe("문단 정렬 (EDIT-20)", () => {
  it("Enter로 나뉜 새 문단은 정렬을 잇지 않는다", () => {
    const editor = makeEditor({ type: "doc", content: [para("가나", "right")] });
    caretAfter(editor, "가나");
    expect(alignmentShortcuts(editor).Enter()).toBe(true);
    expect(blocks(editor)).toEqual([
      ["가나", "right"],
      ["", null],
    ]);
  });

  it("가운데에서 나누면 앞 문단은 정렬을 유지하고 뒤 문단은 기본이 된다", () => {
    const editor = makeEditor({ type: "doc", content: [para("가나다", "center")] });
    caretAfter(editor, "가나", 1);
    alignmentShortcuts(editor).Enter();
    expect(blocks(editor)).toEqual([
      ["가", "center"],
      ["나다", null],
    ]);
  });

  it("정렬 없는 문단의 Enter는 기본 동작에 맡긴다(false)", () => {
    const editor = makeEditor({ type: "doc", content: [para("가나")] });
    caretAfter(editor, "가나");
    expect(alignmentShortcuts(editor).Enter()).toBe(false);
    expect(blocks(editor)).toEqual([["가나", null]]);
  });

  it("제목도 같은 규칙이다", () => {
    const editor = makeEditor({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1, textAlign: "center" },
          content: [{ type: "text", text: "제목" }],
        },
      ],
    });
    caretAfter(editor, "제목");
    alignmentShortcuts(editor).Enter();
    expect(editor.getJSON().content?.map((n) => [n.type, n.attrs?.textAlign ?? null])).toEqual([
      ["heading", "center"],
      ["paragraph", null],
    ]);
  });

  it("목록 안의 정렬 문단은 목록 규칙을 건드리지 않는다(false)", () => {
    const editor = makeEditor({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [para("항목", "right")] }],
        },
      ],
    });
    caretAfter(editor, "항목");
    expect(alignmentShortcuts(editor).Enter()).toBe(false);
  });

  it("⌘⇧L은 정렬 속성을 지운다(왼쪽을 따로 저장하지 않는다)", () => {
    const editor = makeEditor({ type: "doc", content: [para("가나", "right")] });
    caretAfter(editor, "가나");
    alignmentShortcuts(editor)["Mod-Shift-l"]();
    expect(editor.getJSON().content?.[0].attrs?.textAlign ?? null).toBeNull();
  });

  it("⌘⇧R·⌘⇧E는 해당 정렬을 저장한다", () => {
    const editor = makeEditor({ type: "doc", content: [para("가나")] });
    caretAfter(editor, "가나");
    alignmentShortcuts(editor)["Mod-Shift-r"]();
    expect(blocks(editor)).toEqual([["가나", "right"]]);
    alignmentShortcuts(editor)["Mod-Shift-e"]();
    expect(blocks(editor)).toEqual([["가나", "center"]]);
  });
});
