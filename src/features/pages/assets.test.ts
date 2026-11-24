import { describe, expect, it } from "vitest";
import type { Page } from "@/lib/storage";
import { assetRefs, attachmentFileName, isImageAssetPath, replaceAssetRefs } from "./assets";

const OWNER = "01JD0000000000000000000001";
const IMG = `assets/${OWNER}/img-01JD0000000000000000000009.png`;
const FILE = `assets/${OWNER}/01JD0000000000000000000002-notes.pdf`;

const content = {
  type: "doc",
  content: [
    { type: "image", attrs: { src: IMG } },
    { type: "attachment", attrs: { path: FILE, name: "notes.pdf", kind: "pdf" } },
  ],
} as unknown as Page["content"];
const page = { cover: null, icon: null, content };

describe("페이지가 쓰는 자산 경로 (EDIT-31~33)", () => {
  it("기본은 이미지 경로만 모은다 (요약 썸네일은 이미지여야 한다)", () => {
    expect(assetRefs(page)).toEqual([IMG]);
  });

  it("attachments 옵션을 주면 파일 첨부 경로도 모은다", () => {
    expect(assetRefs(page, { attachments: true })).toEqual([IMG, FILE]);
  });

  it("경로를 바꿀 때 첨부는 path 속성을 바꾼다", () => {
    const next = replaceAssetRefs(page, new Map([[FILE, `assets/NEW/copy-notes.pdf`]]));
    const kids =
      (next.content as { content?: { attrs?: Record<string, unknown> }[] }).content ?? [];
    expect(kids[1]?.attrs?.path).toBe("assets/NEW/copy-notes.pdf");
    expect(kids[0]?.attrs?.src).toBe(IMG);
  });

  it("이미지인지·첨부 이름은 저장 이름 규칙으로 가른다", () => {
    expect(isImageAssetPath(IMG)).toBe(true);
    expect(isImageAssetPath(FILE)).toBe(false);
    expect(attachmentFileName(FILE)).toBe("notes.pdf");
  });
});
