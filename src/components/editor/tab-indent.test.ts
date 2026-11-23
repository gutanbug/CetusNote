import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { tabIndentShortcuts, TabIndent } from "./tab-indent";

function makeEditor(content: JSONContent) {
  return new Editor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), TabIndent],
    content,
  });
}

const text = (t: string): JSONContent => ({ type: "text", text: t });
const para = (t: string): JSONContent => ({ type: "paragraph", content: [text(t)] });

/** 글자 `t`를 가진 첫 텍스트 노드의 끝에 캐럿을 둔다 */
function caretAtEnd(editor: Editor, t: string) {
  let pos = -1;
  editor.state.doc.descendants((node, p) => {
    if (pos < 0 && node.isText && node.text === t) pos = p + t.length;
  });
  editor.commands.setTextSelection(pos);
}

describe("들여쓰기 Tab (EDIT-22)", () => {
  it("첫 목록 항목에서 Tab은 아무것도 바꾸지 않고 키만 삼킨다", () => {
    const editor = makeEditor({
      type: "doc",
      content: [{ type: "bulletList", content: [{ type: "listItem", content: [para("항목")] }] }],
    });
    caretAtEnd(editor, "항목");
    const before = editor.getJSON();
    expect(tabIndentShortcuts(editor).Tab()).toBe(true);
    expect(editor.getJSON()).toEqual(before);
  });

  it("체크리스트 첫 항목에서도 탭 문자를 넣지 않는다", () => {
    const editor = makeEditor({
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [{ type: "taskItem", attrs: { checked: false }, content: [para("할 일")] }],
        },
      ],
    });
    caretAtEnd(editor, "할 일");
    expect(tabIndentShortcuts(editor).Tab()).toBe(true);
    expect(editor.state.doc.textContent).toBe("할 일");
  });

  it("일반 문단에서 Tab은 탭 문자를 넣는다", () => {
    const editor = makeEditor({ type: "doc", content: [para("가나")] });
    caretAtEnd(editor, "가나");
    expect(tabIndentShortcuts(editor).Tab()).toBe(true);
    expect(editor.state.doc.textContent).toBe("가나\t");
  });

  it("코드 블록에서는 기본 Tab에 맡긴다(false)", () => {
    const editor = makeEditor({
      type: "doc",
      content: [{ type: "codeBlock", content: [text("let a")] }],
    });
    caretAtEnd(editor, "let a");
    expect(tabIndentShortcuts(editor).Tab()).toBe(false);
    expect(editor.state.doc.textContent).toBe("let a");
  });

  it("Shift+Tab은 목록 항목에서도 기존대로 탭을 지운다", () => {
    const editor = makeEditor({
      type: "doc",
      content: [{ type: "bulletList", content: [{ type: "listItem", content: [para("\t항목")] }] }],
    });
    caretAtEnd(editor, "\t항목");
    expect(tabIndentShortcuts(editor)["Shift-Tab"]()).toBe(true);
    expect(editor.state.doc.textContent).toBe("항목");
  });
});
