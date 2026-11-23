import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { remapMentions } from "./mentions";

describe("가져온 페이지 멘션 연결 (DATA-11)", () => {
  it("멘션 id를 새 페이지 id로 바꾸고, 목록에 없으면 글자만 남긴다", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "pageMention", attrs: { id: "p:a", label: "A" } },
            { type: "text", text: " · " },
            { type: "pageMention", attrs: { id: "p:없음", label: "없는 글" } },
          ],
        },
      ],
    };
    const out = remapMentions(doc, new Map([["p:a", "01NEWID"]]));
    const para = out.content![0]!;
    expect(para.content![0]!.attrs).toEqual({ id: "01NEWID", label: "A" });
    expect(para.content![2]).toEqual({ type: "text", text: "없는 글" });
  });
});
