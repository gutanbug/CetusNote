import { describe, expect, it } from "vitest";
import { createMemoryStorage, createPage, StorageError } from "@/lib/storage";
import { attachmentErrorMessage, importAttachmentFile, pickKindOf } from "./index";

const MB = 1024 * 1024;

describe("파일 첨부 기능 (EDIT-31~33)", () => {
  it("크기 초과·종류 안내는 limits의 문구를 쓴다", () => {
    const tooLarge = new StorageError("too_large", "서버 문구");
    expect(attachmentErrorMessage(tooLarge, "pdf")).toBe("파일이 너무 커요 (최대 25MB)");
    expect(attachmentErrorMessage(tooLarge, "video")).toBe(
      "영상·소리 파일이 너무 커요 (최대 200MB)",
    );
    expect(attachmentErrorMessage(new StorageError("wrong_kind", "x"), "pdf")).toBe(
      "PDF 파일만 넣을 수 있어요.",
    );
    expect(attachmentErrorMessage(new Error("boom"))).toBe("파일을 첨부하지 못했어요.");
  });

  it("고르기 종류를 저장 계층의 종류로 바꾼다", () => {
    expect(pickKindOf("pdf")).toBe("pdf");
    expect(pickKindOf("video")).toBe("media");
    expect(pickKindOf("audio")).toBe("media");
    expect(pickKindOf("file")).toBe("file");
  });

  it("끌어 놓은 파일이 상한을 넘으면 바이트를 읽기 전에 거절한다", async () => {
    // 실제 파일 대신 크기만 큰 가짜 파일 — arrayBuffer가 불리면 실패한다
    const huge = {
      name: "거대한 영상.mp4",
      size: 300 * MB,
      type: "video/mp4",
      arrayBuffer: () => Promise.reject(new Error("읽으면 안 된다")),
    } as unknown as File;
    const storage = createMemoryStorage({ pages: [createPage({ title: "첨부" })] });
    await expect(
      importAttachmentFile("01JD0000000000000000000001", huge, storage),
    ).rejects.toMatchObject({ code: "too_large" });
  });

  it("끌어 놓은 파일을 그 페이지 assets에 넣고 종류를 정한다", async () => {
    const page = createPage({ title: "첨부" });
    const storage = createMemoryStorage({ pages: [page] });
    const file = new File([new Uint8Array(64)], "메모.pdf", { type: "application/pdf" });
    const info = await importAttachmentFile(page.id, file, storage);
    expect(info).toMatchObject({ name: "메모.pdf", size: 64, kind: "pdf" });
    expect(info.path.startsWith(`assets/${page.id}/`)).toBe(true);
  });
});
