import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { getHeadings } from "./outline";
import { ToggleHeading } from "./toggle-heading";

function makeEditor(content: JSONContent | string) {
  return new Editor({ extensions: [StarterKit, ToggleHeading], content });
}

const para = (t: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text: t }],
});
const toggle = (open: boolean | undefined, title: string, body: JSONContent[]): JSONContent => ({
  type: "toggleHeading",
  attrs: open === undefined ? {} : { open },
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: title }] },
    ...body,
  ],
});

/** 글자 `t`로 끝나는 텍스트블록 끝에 캐럿을 둔다 */
function caretAtEndOf(editor: Editor, t: string) {
  let at = -1;
  editor.state.doc.descendants((n, pos) => {
    if (at < 0 && n.isTextblock && n.textContent === t) at = pos + 1 + n.content.size;
    return at < 0;
  });
  editor.commands.setTextSelection(at);
}

describe("ED-ToggleHeading 스키마", () => {
  it("제목 줄은 heading 노드라 목차(getHeadings)에 들어간다 (접혀 있어도)", () => {
    const editor = makeEditor({
      type: "doc",
      content: [para("머리말"), toggle(false, "접힌 제목", [para("숨은 내용")])],
    });
    expect(getHeadings(editor).map((h) => [h.level, h.text])).toEqual([[2, "접힌 제목"]]);
    editor.destroy();
  });

  it("제목 줄이 없으면 스키마 검사에 걸린다", () => {
    const editor = makeEditor({ type: "doc", content: [] });
    expect(() =>
      editor.schema.nodeFromJSON({ type: "toggleHeading", content: [para("제목 아님")] }).check(),
    ).toThrow();
    editor.destroy();
  });
});

describe("ED-ToggleHeading 명령", () => {
  it("setToggleHeading은 문단을 토글 제목(펼침)으로 감싼다", () => {
    const editor = makeEditor({ type: "doc", content: [para("새 제목")] });
    caretAtEndOf(editor, "새 제목");
    expect(editor.commands.setToggleHeading({ level: 3 })).toBe(true);
    const node = editor.getJSON().content![0];
    expect(node.type).toBe("toggleHeading");
    expect(node.attrs?.open).toBe(true);
    expect(node.content![0]).toMatchObject({ type: "heading", attrs: { level: 3 } });
    editor.destroy();
  });

  it("toggleToggleHeading은 캐럿이 든 토글을 접고 펼친다", () => {
    const editor = makeEditor({
      type: "doc",
      content: [toggle(true, "토글", [para("본문")])],
    });
    caretAtEndOf(editor, "토글");
    editor.commands.toggleToggleHeading();
    expect(editor.getJSON().content![0].attrs?.open).toBe(false);
    editor.commands.toggleToggleHeading();
    expect(editor.getJSON().content![0].attrs?.open).toBe(true);
    editor.destroy();
  });

  it("접을 때 캐럿이 숨은 내용에 있으면 제목 끝으로 옮긴다", () => {
    const editor = makeEditor({
      type: "doc",
      content: [toggle(true, "토글", [para("숨을 문장")])],
    });
    caretAtEndOf(editor, "숨을 문장");
    editor.commands.toggleToggleHeading();
    const { $from } = editor.state.selection;
    expect($from.parent.type.name).toBe("heading");
    expect(editor.getJSON().content![0].attrs?.open).toBe(false);
    editor.destroy();
  });

  it("캐럿이 토글 밖이면 toggleToggleHeading은 아무것도 하지 않는다", () => {
    const editor = makeEditor({ type: "doc", content: [para("밖"), toggle(true, "토글", [])] });
    caretAtEndOf(editor, "밖");
    expect(editor.commands.toggleToggleHeading()).toBe(false);
    editor.destroy();
  });
});
