import { createMemoryStorage, ulid, type QuickNote } from "@/lib/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMetaStore, mergeQuickNotes } from "./store";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const note = (id: string, text = id): QuickNote => ({
  id,
  text,
  createdAt: "2026-01-01T00:00:00Z",
});

describe("mergeQuickNotes", () => {
  it("디스크의 메모와 이 창의 메모를 id로 합치고, 지운 id는 뺀다", () => {
    const out = mergeQuickNotes([note("a"), note("q")], [note("a"), note("m")], new Set(["gone"]));
    expect(out.map((n) => n.id)).toEqual(["a", "q", "m"]);
    const withDeleted = mergeQuickNotes([note("a"), note("gone")], [], new Set(["gone"]));
    expect(withDeleted.map((n) => n.id)).toEqual(["a"]);
  });
});

describe("createMetaStore 빠른 메모 덮어쓰기 방지", () => {
  it("빠른 입력 창이 디스크에 붙인 메모를 메인 창의 저장이 지우지 않는다", async () => {
    const storage = createMemoryStorage();
    await storage.openDefaultWorkspace();
    const store = createMetaStore(storage, { delay: 10 });
    await store.getState().load();
    store.getState().setTagColor("회의", "blue");
    // 빠른 입력 창이 메인 창의 저장 사이에 메모를 붙인다
    const quickId = ulid();
    await storage.appendQuickNote(note(quickId, "빠른 창"));
    await vi.advanceTimersByTimeAsync(10);
    const disk = await storage.readWorkspace();
    expect(disk.quickNotes.map((n) => n.id)).toContain(quickId);
    expect(store.getState().meta?.quickNotes.map((n) => n.id)).toContain(quickId);
  });

  it("이 창에서 지운 메모는 디스크에 남아 있어도 저장하면 빠진다", async () => {
    const storage = createMemoryStorage();
    await storage.openDefaultWorkspace();
    const store = createMetaStore(storage, { delay: 10 });
    await store.getState().load();
    const goneId = ulid();
    await storage.appendQuickNote(note(goneId, "지울 메모"));
    await store.getState().reloadExternal();
    store.getState().removeQuickNote(goneId);
    await vi.advanceTimersByTimeAsync(10);
    const disk = await storage.readWorkspace();
    expect(disk.quickNotes.map((n) => n.id)).not.toContain(goneId);
  });
});
