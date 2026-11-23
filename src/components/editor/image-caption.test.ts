import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { NodeSelection } from "@tiptap/pm/state";
import { ImageBlock } from "./image";

type Keys = Record<string, (props: { editor: Editor }) => boolean>;

/** 기본 Backspace 키맵보다 먼저 도는 이미지 블록의 Backspace만 꺼낸다 */
function pressBackspace(editor: Editor) {
  const shortcuts = (
    ImageBlock.config.addKeyboardShortcuts as unknown as (this: { name: string }) => Keys
  ).call({ name: "image" });
  return shortcuts.Backspace({ editor });
}

const text = (t: string): JSONContent => ({ type: "text", text: t });

/** 이미지(캡션 `caption`) + 그 아래 문단(내용 `after`, null이면 문단 없음) */
function makeEditor(caption: string, after: JSONContent[] | null) {
  const content: JSONContent[] = [
    { type: "image", attrs: { src: "assets/a.png" }, content: caption ? [text(caption)] : [] },
  ];
  if (after) content.push({ type: "paragraph", content: after });
  return new Editor({
    extensions: [StarterKit, ImageBlock],
    content: { type: "doc", content },
  });
}

// 문서 위치: 이미지 0..(2+캡션길이), 그 아래 문단은 이미지 끝 다음 — 문단 맨 앞 = 이미지 끝 + 1
const paragraphStart = (caption: string) => caption.length + 3;

describe("이미지 캡션 Backspace (EDIT-14)", () => {
  it("캡션 아래 문단 맨 앞에서 Backspace는 문단 글을 캡션 끝에 합친다 (줄바꿈 제거)", () => {
    const editor = makeEditor("가나", [text("다라")]);
    editor.commands.setTextSelection(paragraphStart("가나"));
    expect(pressBackspace(editor)).toBe(true);
    expect(editor.getJSON().content).toEqual([
      {
        type: "image",
        attrs: { src: "assets/a.png", width: 100, remote: null },
        content: [text("가나다라")],
      },
    ]);
    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.$from.parent.type.name).toBe("image");
    expect(editor.state.selection.$from.parentOffset).toBe(2);
    expect(editor.state.selection).not.toBeInstanceOf(NodeSelection);
  });

  it("빈 문단에서 Backspace는 문단을 지우고 캡션 끝에 캐럿을 둔다", () => {
    const editor = makeEditor("가나", []);
    editor.commands.setTextSelection(paragraphStart("가나"));
    expect(pressBackspace(editor)).toBe(true);
    expect(editor.getJSON().content).toHaveLength(1);
    expect(editor.state.selection.$from.parent.type.name).toBe("image");
    expect(editor.state.selection.$from.parentOffset).toBe(2);
  });

  it("서식이 있는 문단은 지우지 않고 캡션 끝으로 캐럿만 옮긴다", () => {
    const editor = makeEditor("가나", [{ type: "text", text: "굵게", marks: [{ type: "bold" }] }]);
    editor.commands.setTextSelection(paragraphStart("가나"));
    expect(pressBackspace(editor)).toBe(true);
    expect(editor.getJSON().content?.[1]?.type).toBe("paragraph");
    expect(editor.state.selection.$from.parent.type.name).toBe("image");
    expect(editor.state.selection.$from.parentOffset).toBe(2);
  });

  it("캡션 맨 앞에서 Backspace는 이미지를 고른다", () => {
    const editor = makeEditor("가나", null);
    editor.commands.setTextSelection(1);
    expect(pressBackspace(editor)).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor.state.selection.from).toBe(0);
  });

  it("캡션 가운데에서 Backspace는 기본 동작에 맡긴다 (false)", () => {
    const editor = makeEditor("가나", null);
    editor.commands.setTextSelection(3);
    expect(pressBackspace(editor)).toBe(false);
    expect(editor.state.doc.firstChild?.textContent).toBe("가나");
  });

  it("이미지 위쪽 문단 맨 앞에서 Backspace는 손대지 않는다 (false)", () => {
    const editor = new Editor({
      extensions: [StarterKit, ImageBlock],
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [text("앞")] },
          { type: "image", attrs: { src: "assets/a.png" }, content: [text("가나")] },
        ],
      },
    });
    editor.commands.setTextSelection(1);
    expect(pressBackspace(editor)).toBe(false);
  });
});
