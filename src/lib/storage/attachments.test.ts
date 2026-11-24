import { describe, expect, it } from "vitest";
import { createMemoryStorage, createPage, StorageError } from "./index";

const bytes = (n: number) => new Uint8Array(n);

describe("파일 첨부 (memory 구현, EDIT-31~33)", () => {
  it("고른 파일을 그 페이지 assets에 넣고 종류·크기를 돌려준다", async () => {
    const page = createPage({ title: "첨부" });
    const storage = createMemoryStorage({
      pages: [page],
      pickAttachment: () => ({
        name: "보고서 2026.pdf",
        bytes: bytes(10),
        mime: "application/pdf",
      }),
    });
    const info = await storage.pickFile(page.id, { kind: "pdf" });
    expect(info).toMatchObject({ name: "보고서 2026.pdf", size: 10, kind: "pdf" });
    expect(info!.path.startsWith(`assets/${page.id}/`)).toBe(true);
    expect(info!.path.endsWith("-____2026.pdf")).toBe(true);
    const url = await storage.resolveAssetSrc(info!.path);
    expect(url.length).toBeGreaterThan(0);
  });

  it("취소하면 null", async () => {
    const storage = createMemoryStorage({ pickAttachment: () => null });
    expect(await storage.pickFile(createPage().id)).toBeNull();
  });

  it("종류가 맞지 않으면 wrong_kind, 상한을 넘으면 too_large", async () => {
    const page = createPage();
    const txt = createMemoryStorage({
      pages: [page],
      importAttachments: { "/in/a.txt": { name: "a.txt", bytes: bytes(3) } },
    });
    await expect(txt.importFile(page.id, "/in/a.txt", { kind: "pdf" })).rejects.toMatchObject({
      code: "wrong_kind",
    });
    const big = createMemoryStorage({
      pages: [page],
      importAttachments: { "/in/big.zip": { name: "big.zip", bytes: bytes(25 * 1024 * 1024 + 1) } },
    });
    await expect(big.importFile(page.id, "/in/big.zip")).rejects.toMatchObject({
      code: "too_large",
    });
  });

  it("끌어 놓은 경로에 파일이 없으면 not_found", async () => {
    const storage = createMemoryStorage();
    await expect(storage.importFile(createPage().id, "/nope.pdf")).rejects.toBeInstanceOf(
      StorageError,
    );
  });

  it("Finder·기본 앱 열기는 브라우저 미리보기에서 unsupported", async () => {
    const storage = createMemoryStorage();
    await expect(storage.revealAsset("assets/x/y")).rejects.toMatchObject({ code: "unsupported" });
    await expect(storage.openAsset("assets/x/y")).rejects.toMatchObject({ code: "unsupported" });
  });

  it("영구 삭제하면 첨부도 함께 사라진다", async () => {
    const page = createPage();
    const storage = createMemoryStorage({
      pages: [page],
      pickAttachment: () => ({ name: "a.txt", bytes: bytes(2) }),
    });
    const info = (await storage.pickFile(page.id))!;
    await storage.writePage({ ...page, trashedAt: new Date().toISOString() });
    await storage.purgePage(page.id);
    await expect(storage.resolveAssetSrc(info.path)).rejects.toMatchObject({ code: "not_found" });
  });
});
