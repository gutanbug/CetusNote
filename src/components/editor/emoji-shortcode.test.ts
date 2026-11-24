import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { findSuggestionMatch } from "@tiptap/suggestion";
import { SHORTCODE_MIN_QUERY, shortcodeItems, shortcodeTriggerAllowed } from "./emoji-shortcode";

function makeEditor(content: JSONContent) {
  return new Editor({ extensions: [StarterKit], content });
}

/** 문서에서 글자 조각이 처음 나오는 위치 (ProseMirror 위치) */
function posOf(editor: Editor, needle: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text?.includes(needle))
      found = pos + node.text.indexOf(needle);
  });
  if (found < 0) throw new Error(`없는 글자: ${needle}`);
  return found;
}

const para = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const text = (t: string, ...marks: { type: string }[]): JSONContent =>
  marks.length ? { type: "text", text: t, marks } : { type: "text", text: t };

describe(":단축 코드 목록 (EDIT-35)", () => {
  it("이름은 2글자 이상일 때만 목록을 준다", () => {
    expect(SHORTCODE_MIN_QUERY).toBe(2);
    expect(shortcodeItems("")).toEqual([]);
    expect(shortcodeItems("s")).toEqual([]);
    expect(shortcodeItems("smi").map((i) => i.code)).toContain("smile");
  });

  it("이름에 허용하지 않는 글자가 있으면 목록을 주지 않는다", () => {
    expect(shortcodeItems("sm)")).toEqual([]);
    expect(shortcodeItems("//")).toEqual([]);
  });
});

describe(":단축 코드 여는 자리 (줄 처음·공백 뒤, 코드·링크 밖)", () => {
  const match = (before: string) => {
    const editor = makeEditor({ type: "doc", content: [para(text(before))] });
    const $position = editor.state.doc.resolve(before.length + 1);
    return findSuggestionMatch({
      char: ":",
      allowSpaces: false,
      allowedPrefixes: [" "],
      allowToIncludeChar: false,
      startOfLine: false,
      $position,
    });
  };

  it("줄 처음이나 공백 뒤의 콜론에서만 시작한다", () => {
    expect(match(":sm")?.query).toBe("sm");
    expect(match("지금 :sm")?.query).toBe("sm");
    expect(match("hello:sm")).toBeNull();
    expect(match("http://x")).toBeNull();
  });

  it("코드 서식 글자 안에서는 열지 않는다", () => {
    const editor = makeEditor({
      type: "doc",
      content: [para(text("평범 :sm "), text("코드 :sm", { type: "code" }))],
    });
    const plain = posOf(editor, "평범 :sm");
    const code = posOf(editor, "코드 :sm");
    expect(shortcodeTriggerAllowed(editor.state, { from: plain + 3, to: plain + 6 })).toBe(true);
    expect(shortcodeTriggerAllowed(editor.state, { from: code + 3, to: code + 6 })).toBe(false);
  });

  it("코드 블록 안에서는 열지 않는다", () => {
    const editor = makeEditor({
      type: "doc",
      content: [{ type: "codeBlock", content: [text(":sm")] }],
    });
    const at = posOf(editor, ":sm");
    expect(shortcodeTriggerAllowed(editor.state, { from: at, to: at + 3 })).toBe(false);
  });
});
