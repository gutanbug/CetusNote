import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { CellSelection } from "@tiptap/pm/tables";
import { AllSelection, TextSelection } from "@tiptap/pm/state";
import { tableSelectAllShortcuts, TableSelectAll } from "./table-select-all";

function makeEditor(content: JSONContent) {
  return new Editor({
    extensions: [StarterKit, TableKit, TableSelectAll],
    content,
  });
}

const text = (t: string): JSONContent => ({ type: "text", text: t });
const para = (...lines: string[]): JSONContent =>
  lines.length === 0
    ? { type: "paragraph" }
    : ({ type: "paragraph", content: [text(lines[0]!)] } as JSONContent);
const paras = (...lines: string[]): JSONContent[] =>
  lines.length === 0 ? [{ type: "paragraph" }] : lines.map((l) => para(l));
const cell = (type: "tableCell" | "tableHeader", ...lines: string[]): JSONContent => ({
  type,
  content: paras(...lines),
});
const row = (...cells: JSONContent[]): JSONContent => ({ type: "tableRow", content: cells });
const table = (...rows: JSONContent[]): JSONContent => ({ type: "table", content: rows });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

const pressModA = (editor: Editor) => tableSelectAllShortcuts(editor)["Mod-a"]();

/** 글자 `t`를 가진 첫 텍스트 노드의 끝에 캐럿을 둔다 */
function caretAtEnd(editor: Editor, t: string) {
  let pos = -1;
  editor.state.doc.descendants((node, p) => {
    if (pos < 0 && node.isText && node.text === t) pos = p + t.length;
  });
  expect(pos).toBeGreaterThan(0);
  editor.commands.setTextSelection(pos);
}

/** 글자 `t`를 가진 셀(첫 노드) 바로 앞 위치 */
function cellPosOf(editor: Editor, t: string) {
  let found = -1;
  editor.state.doc.descendants((node, p) => {
    if (found < 0 && (node.type.name === "tableCell" || node.type.name === "tableHeader")) {
      if (node.textContent === t) found = p;
    }
  });
  expect(found).toBeGreaterThanOrEqual(0);
  return found;
}

const wholeDoc = (editor: Editor) => ({
  from: 0,
  to: editor.state.doc.content.size,
});

describe("표 셀 안 ⌘A 단계 선택 (EDIT-15)", () => {
  it("셀 안에서 누르면 그 셀의 글자만 고른다", () => {
    const editor = makeEditor(
      doc(table(row(cell("tableCell", "가나"), cell("tableCell", "다라")))),
    );
    caretAtEnd(editor, "다라");
    expect(pressModA(editor)).toBe(true);
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe("다라");
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
  });

  it("고른 뒤 한 번 더 누르면 문서 전체를 고른다", () => {
    const editor = makeEditor(doc(para("앞"), table(row(cell("tableCell", "가나")))));
    caretAtEnd(editor, "가나");
    pressModA(editor);
    expect(pressModA(editor)).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(AllSelection);
    expect(editor.state.selection.from).toBe(wholeDoc(editor).from);
    expect(editor.state.selection.to).toBe(wholeDoc(editor).to);
  });

  it("여러 문단인 셀은 첫 글자부터 마지막 글자까지 고른다", () => {
    const editor = makeEditor(
      doc(table(row(cell("tableCell", "첫 줄", "둘째 줄"), cell("tableCell", "옆")))),
    );
    caretAtEnd(editor, "둘째 줄");
    pressModA(editor);
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to, "\n")).toBe("첫 줄\n둘째 줄");
  });

  it("머리글 셀(tableHeader)에서도 셀 안 선택이 된다", () => {
    const editor = makeEditor(doc(table(row(cell("tableHeader", "머리글")))));
    caretAtEnd(editor, "머리글");
    pressModA(editor);
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe("머리글");
  });

  it("빈 셀은 첫 번째 누름을 삼키고 아무것도 바꾸지 않는다", () => {
    const editor = makeEditor(doc(table(row(cell("tableCell"), cell("tableCell", "옆")))));
    editor.commands.setTextSelection(cellPosOf(editor, "") + 2);
    const before = editor.getJSON();
    const selBefore = editor.state.selection.from;
    expect(pressModA(editor)).toBe(true);
    expect(editor.getJSON()).toEqual(before);
    expect(editor.state.selection.from).toBe(selBefore);
    expect(editor.state.selection).not.toBeInstanceOf(AllSelection);
  });

  it("빈 셀에서 두 번째 누름은 문서 전체를 고른다", () => {
    const editor = makeEditor(doc(para("앞"), table(row(cell("tableCell")))));
    editor.commands.setTextSelection(cellPosOf(editor, "") + 2);
    pressModA(editor);
    expect(pressModA(editor)).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(AllSelection);
  });

  it("빈 셀 두 번째 누름 사이에 글을 바꾸면 다시 첫 번째 누름으로 친다", () => {
    const editor = makeEditor(doc(table(row(cell("tableCell")))));
    const at = cellPosOf(editor, "") + 2;
    editor.commands.setTextSelection(at);
    pressModA(editor);
    // 글을 넣었다 지워 셀은 다시 비었지만 문서가 바뀌었으므로 첫 번째 누름으로 친다
    editor.view.dispatch(editor.state.tr.insertText("가", at));
    editor.commands.deleteRange({ from: at, to: at + 1 });
    editor.commands.setTextSelection(at);
    expect(pressModA(editor)).toBe(true);
    expect(editor.state.selection).not.toBeInstanceOf(AllSelection);
  });

  it("표 밖에서 누르면 문서 전체를 고른다", () => {
    const editor = makeEditor(
      doc(para("본문 첫 문단"), table(row(cell("tableCell", "셀"))), para("끝 문단")),
    );
    caretAtEnd(editor, "본문 첫 문단");
    expect(pressModA(editor)).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(AllSelection);
    expect(editor.state.selection.from).toBe(wholeDoc(editor).from);
    expect(editor.state.selection.to).toBe(wholeDoc(editor).to);
  });

  it("여러 셀(CellSelection)을 고른 상태면 문서 전체를 고른다", () => {
    const editor = makeEditor(doc(table(row(cell("tableCell", "가"), cell("tableCell", "나")))));
    const $a = editor.state.doc.resolve(cellPosOf(editor, "가"));
    const $b = editor.state.doc.resolve(cellPosOf(editor, "나"));
    editor.view.dispatch(editor.state.tr.setSelection(new CellSelection($a, $b)));
    expect(editor.state.selection).toBeInstanceOf(CellSelection);
    expect(pressModA(editor)).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(AllSelection);
  });

  it("IME 조합 중에는 처리하지 않는다(false)", () => {
    // 헤드리스 에디터의 view는 input 접근을 막으므로, 조합 중 플래그만 가진 가짜 에디터로 확인한다.
    // 가드는 view.composing만 먼저 읽고 돌아가야 한다.
    const composing = { view: { composing: true } } as unknown as Editor;
    expect(tableSelectAllShortcuts(composing)["Mod-a"]()).toBe(false);
  });
});
