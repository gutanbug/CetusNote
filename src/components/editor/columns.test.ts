import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Column, Columns, COLUMN_MIN_WEIGHT } from "./columns";

/** JSON 노드의 자식 (타입 좁히기용) */
const kids = (n: JSONContent | undefined): JSONContent[] => (n?.content ?? []) as JSONContent[];

function makeEditor(content: JSONContent | string) {
  return new Editor({ extensions: [StarterKit, Columns, Column], content });
}

const para = (t: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text: t }],
});
const cols = (...texts: string[]): JSONContent => ({
  type: "columns",
  content: texts.map((t) => ({ type: "column", attrs: { width: 1 }, content: [para(t)] })),
});

/** 글자 `t`인 텍스트블록 끝에 캐럿 */
function caretAtEndOf(editor: Editor, t: string) {
  let at = -1;
  editor.state.doc.descendants((n, pos) => {
    if (at < 0 && n.isTextblock && n.textContent === t) at = pos + 1 + n.content.size;
    return at < 0;
  });
  editor.commands.setTextSelection(at);
}

/** 캐럿이 든 열의 번호 (없으면 -1) */
function columnIndex(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 1; d--)
    if ($from.node(d).type.name === "column") return $from.index(d - 1);
  return -1;
}

describe("ED-Columns 스키마", () => {
  it("열은 2–4개만 허용한다", () => {
    const editor = makeEditor({ type: "doc", content: [] });
    expect(() => editor.schema.nodeFromJSON(cols("하나")).check()).toThrow();
    expect(() => editor.schema.nodeFromJSON(cols("1", "2")).check()).not.toThrow();
    expect(() => editor.schema.nodeFromJSON(cols("1", "2", "3", "4", "5")).check()).toThrow();
    editor.destroy();
  });

  it("열 안에는 블록을 여러 개 담는다", () => {
    const editor = makeEditor({
      type: "doc",
      content: [
        {
          type: "columns",
          content: [
            {
              type: "column",
              content: [
                para("가"),
                { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "나" }] },
              ],
            },
            { type: "column", content: [para("다")] },
          ],
        },
      ],
    });
    expect(kids(kids(editor.getJSON().content?.[0])[0]).length).toBe(2);
    editor.destroy();
  });
});

describe("ED-Columns 명령", () => {
  it("insertColumns는 지정한 열 수의 빈 단 나누기를 넣는다", () => {
    const editor = makeEditor({ type: "doc", content: [para("본문")] });
    caretAtEndOf(editor, "본문");
    expect(editor.commands.insertColumns({ count: 3 })).toBe(true);
    const node = editor.getJSON().content!.find((n) => n.type === "columns");
    expect(node?.content?.length).toBe(3);
    editor.destroy();
  });

  it("moveToColumn은 앞·뒤 열로 옮기고 끝 열에서는 멈춘다", () => {
    const editor = makeEditor({ type: "doc", content: [cols("가", "나", "다")] });
    caretAtEndOf(editor, "가");
    editor.commands.moveToColumn(-1);
    expect(columnIndex(editor)).toBe(0);
    editor.commands.moveToColumn(1);
    expect(columnIndex(editor)).toBe(1);
    editor.commands.moveToColumn(1);
    expect(columnIndex(editor)).toBe(2);
    expect(editor.commands.moveToColumn(1)).toBe(false);
    expect(columnIndex(editor)).toBe(2);
    editor.destroy();
  });

  it("열 밖에서 moveToColumn은 false", () => {
    const editor = makeEditor({ type: "doc", content: [para("밖"), cols("가", "나")] });
    caretAtEndOf(editor, "밖");
    expect(editor.commands.moveToColumn(1)).toBe(false);
    editor.destroy();
  });

  it("resizeColumn은 뒤 열에서 가져오고 최소 비율을 지킨다", () => {
    const editor = makeEditor({ type: "doc", content: [cols("가", "나")] });
    caretAtEndOf(editor, "가");
    editor.commands.resizeColumn(0.25);
    expect(kids(editor.getJSON().content?.[0]).map((c) => c.attrs?.width)).toEqual([1.25, 0.75]);
    // 최소 비율 아래로는 줄지 않는다
    editor.commands.resizeColumn(-10);
    const [a, b] = kids(editor.getJSON().content?.[0]).map((c) => Number(c.attrs?.width));
    expect(a).toBeCloseTo(COLUMN_MIN_WEIGHT);
    expect(a + b).toBeCloseTo(2);
    editor.destroy();
  });

  it("setColumnWidths는 열 수가 다르면 거절한다", () => {
    const editor = makeEditor({ type: "doc", content: [cols("가", "나")] });
    expect(editor.commands.setColumnWidths({ pos: 0, widths: [1, 1, 1] })).toBe(false);
    editor.destroy();
  });
});
