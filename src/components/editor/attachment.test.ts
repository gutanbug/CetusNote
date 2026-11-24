import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { AttachmentBlock } from "./attachment";
import { filterSlashItems } from "./slash-items";

/** 저장 형식의 첨부 속성 (assets/<페이지 id>/<첨부 id>-<이름>) */
const PDF = {
  path: "assets/01JD0000000000000000000001/01JD0000000000000000000002-notes.pdf",
  name: "회의 메모.pdf",
  size: 1394,
  mime: "application/pdf",
  kind: "pdf",
  caption: "",
} as const;

function makeEditor(content: JSONContent) {
  return new Editor({ extensions: [StarterKit, AttachmentBlock], content });
}

describe("첨부 블록 노드 (EDIT-31~33)", () => {
  it("속성을 JSON으로 그대로 왕복한다", () => {
    const editor = makeEditor({ type: "doc", content: [{ type: "attachment", attrs: PDF }] });
    expect(editor.getJSON().content?.[0]).toEqual({ type: "attachment", attrs: PDF });
  });

  it("속성이 빠지면 파일 종류·빈 값으로 채운다", () => {
    const editor = makeEditor({ type: "doc", content: [{ type: "attachment" }] });
    expect(editor.getJSON().content?.[0]?.attrs).toEqual({
      path: "",
      name: "",
      size: 0,
      mime: "",
      kind: "file",
      caption: "",
    });
  });

  it("빈 문단에 넣으면 그 문단을 바꾸고, 맨 끝이면 뒤에 글 문단을 둔다", () => {
    const editor = makeEditor({ type: "doc", content: [{ type: "paragraph" }] });
    editor.commands.insertAttachment(PDF);
    const kids = editor.getJSON().content ?? [];
    expect(kids[0]).toEqual({ type: "attachment", attrs: PDF });
    expect(kids[kids.length - 1]?.type).toBe("paragraph");
    expect(kids).toHaveLength(2);
  });

  it("글 가운데에 넣으면 문단을 둘로 나눈다", () => {
    const editor = makeEditor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "앞뒤" }] }],
    });
    // 「앞」 뒤(1 + 1 = 2)에 넣는다
    editor.commands.insertAttachment(PDF, 2);
    const types = (editor.getJSON().content ?? []).map((n) => n.type);
    expect(types).toEqual(["paragraph", "attachment", "paragraph"]);
  });
});

describe("슬래시 파일·이모지 항목 (EDIT-31~35)", () => {
  const ids = (query: string) => filterSlashItems(query).map((item) => item.id);

  it("파일 종류별 항목을 이름·낱말로 찾는다", () => {
    expect(ids("첨부")).toContain("file");
    expect(ids("attach")).toContain("file");
    expect(ids("pdf")).toContain("pdf");
    expect(ids("동영상")).toContain("video");
    expect(ids("비디오")).toContain("video");
    expect(ids("소리")).toContain("audio");
    expect(ids("음성")).toContain("audio");
    expect(ids("이모지")).toContain("emoji");
  });
});
