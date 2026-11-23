import { createMemoryStorage, normalizeWorkspace } from "@/lib/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMetaStore } from "./store";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createMetaStore", () => {
  it("태그 색을 바꾸면 모았다가 workspace.json에 쓴다. 다른 값은 그대로", async () => {
    const storage = createMemoryStorage();
    await storage.openDefaultWorkspace();
    const before = await storage.readWorkspace();
    const store = createMetaStore(storage, { delay: 10 });
    await store.getState().load();
    store.getState().setTagColor("회의", "blue");
    store.getState().setTagColor("기획", "green");
    expect((await storage.readWorkspace()).tags).toEqual(before.tags);
    await vi.advanceTimersByTimeAsync(10);
    const after = await storage.readWorkspace();
    expect(after.tags).toMatchObject({ 회의: "blue", 기획: "green" });
    expect(after.name).toBe(before.name);
  });

  it("즐겨찾기·순서, 영구 삭제하면 둘 다에서 빠진다", async () => {
    const storage = createMemoryStorage();
    await storage.openDefaultWorkspace();
    const store = createMetaStore(storage, { delay: 10 });
    await store.getState().load();
    store.getState().toggleFavorite("a");
    store.getState().toggleFavorite("b");
    store.getState().toggleFavorite("a");
    store.getState().setOrder(null, ["b", "c"]);
    store.getState().setOrder("f", ["b"]);
    expect(store.getState().meta).toMatchObject({ favorites: ["b"], order: { root: ["b", "c"] } });
    store.getState().forget("b");
    expect(store.getState().meta).toMatchObject({ favorites: [], order: { root: ["c"], f: [] } });
    await vi.advanceTimersByTimeAsync(10);
    // 읽을 때는 없는 페이지 id를 거른다(저장 계층)
    expect((await storage.readWorkspace()).favorites).toEqual([]);
  });
});

describe("빠른 메모 (QN-01)", () => {
  it("저장하면 바로 workspace.json에 쓴다 · 지우고 되돌리면 원래 자리", async () => {
    const storage = createMemoryStorage();
    const store = createMetaStore(storage, { delay: 10 });
    await store.getState().load();
    expect(await store.getState().addQuickNote("  우유 사기  ")).toBe(true);
    expect(await store.getState().addQuickNote("   ")).toBe(false);
    expect(storage.snapshot().workspace!.quickNotes.map((n) => n.text)).toEqual(["우유 사기"]);
    await store.getState().addQuickNote("회의 안건 정리");
    const first = store.getState().meta!.quickNotes[0]!;
    const removed = store.getState().removeQuickNote(first.id)!;
    expect(store.getState().meta!.quickNotes.map((n) => n.text)).toEqual(["회의 안건 정리"]);
    store.getState().restoreQuickNote(removed);
    expect(store.getState().meta!.quickNotes.map((n) => n.text)).toEqual([
      "우유 사기",
      "회의 안건 정리",
    ]);
  });

  it("쓰지 못하면 false — 목록에도 남기지 않는다", async () => {
    const storage = createMemoryStorage();
    const store = createMetaStore(storage, { delay: 10 });
    await store.getState().load();
    storage.writeWorkspace = async () => {
      throw new Error("디스크 가득 참");
    };
    expect(await store.getState().addQuickNote("잃으면 안 되는 생각")).toBe(false);
    expect(store.getState().meta!.quickNotes).toEqual([]);
  });

  it("잘못된 항목은 읽을 때 버린다", () => {
    const meta = normalizeWorkspace({
      quickNotes: [
        { id: "x", text: "id가 이상함", createdAt: "2026-11-19T00:00:00Z" },
        { text: "" },
        3,
      ],
    });
    expect(meta.quickNotes).toHaveLength(1);
    expect(meta.quickNotes[0]!.text).toBe("id가 이상함");
  });
});

describe("태그 색 전체 바꾸기 (SHELL-18)", () => {
  it("replaceTagColors는 색 목록을 통째로 바꾸고 workspace.json에 쓴다", async () => {
    const storage = createMemoryStorage();
    await storage.openDefaultWorkspace();
    const store = createMetaStore(storage, { delay: 10 });
    await store.getState().load();
    store.getState().setTagColor("회의", "blue");
    store.getState().replaceTagColors({ 기획: "green" });
    expect(store.getState().meta?.tags).toEqual({ 기획: "green" });
    await store.getState().flush();
    expect((await storage.readWorkspace()).tags).toEqual({ 기획: "green" });
  });
});
