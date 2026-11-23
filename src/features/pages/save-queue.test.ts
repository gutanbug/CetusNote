import { createMemoryStorage, createPage, StorageError, type Page } from "@/lib/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSaveQueue, type SaveState } from "./save-queue";
import { createPagesStore } from "./store";

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createSaveQueue (DATA-01)", () => {
  it("편집이 800ms 멈춘 뒤 마지막 내용만 한 번 쓴다", async () => {
    const write = vi.fn<(page: Page) => Promise<void>>(async () => {});
    const states: SaveState[] = [];
    const q = createSaveQueue({ write, onStateChange: (s) => states.push(s) });
    const page = createPage();
    q.schedule({ ...page, title: "회" });
    await vi.advanceTimersByTimeAsync(500);
    q.schedule({ ...page, title: "회의록" });
    await vi.advanceTimersByTimeAsync(500);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]![0].title).toBe("회의록");
    expect(states).toEqual(["saving", "saved"]);
  });

  it("쓰는 중에 또 바뀌면 끝난 뒤 최신 내용으로 한 번 더 — 같은 페이지 쓰기는 겹치지 않는다", async () => {
    const gates = [deferred(), deferred()];
    let active = 0;
    let maxActive = 0;
    const written: string[] = [];
    const write = vi.fn(async (p: Page) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await gates[written.length]!.promise;
      written.push(p.title);
      active--;
    });
    const q = createSaveQueue({ write, delay: 10 });
    const page = createPage();
    q.schedule({ ...page, title: "1" });
    await vi.advanceTimersByTimeAsync(10);
    q.schedule({ ...page, title: "2" });
    q.schedule({ ...page, title: "3" });
    await vi.advanceTimersByTimeAsync(10);
    gates[0]!.resolve();
    gates[1]!.resolve();
    await q.flush();
    expect(written).toEqual(["1", "3"]);
    expect(maxActive).toBe(1);
    expect(q.state).toBe("saved");
  });

  it("실패하면 내용을 들고 있다가 다시 시도하면 저장한다", async () => {
    let fail = true;
    const write = vi.fn(async () => {
      if (fail) throw new StorageError("disk_full", "가득 참");
    });
    const states: [SaveState, unknown][] = [];
    const q = createSaveQueue({ write, delay: 10, onStateChange: (s, e) => states.push([s, e]) });
    q.schedule(createPage({ title: "중요한 메모" }));
    await vi.advanceTimersByTimeAsync(10);
    expect(q.state).toBe("error");
    expect(states[states.length - 1]![1]).toBeInstanceOf(StorageError);
    expect(q.hasUnsaved).toBe(true);
    fail = false;
    expect(await q.retry()).toBe(true);
    expect(q.state).toBe("saved");
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("flush는 기다리지 않고 모든 페이지를 바로 쓴다 (창을 닫을 때)", async () => {
    const write = vi.fn<(page: Page) => Promise<void>>(async () => {});
    const q = createSaveQueue({ write });
    q.schedule(createPage({ title: "a" }));
    q.schedule(createPage({ title: "b" }));
    expect(await q.flush()).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledTimes(2);
  });
});

describe("createPagesStore", () => {
  const now = () => "2026-11-19T10:00:00.000Z";

  it("고치면 updatedAt을 바꾸고 자동 저장한다", async () => {
    const storage = createMemoryStorage();
    const store = createPagesStore(storage, { delay: 10, now });
    await store.getState().load();
    const page = store.getState().create({ title: "회의록" });
    store.getState().update(page.id, { content: doc("안건 1") });
    expect(store.getState().saveState).toBe("saving");
    await vi.advanceTimersByTimeAsync(10);
    expect(store.getState().saveState).toBe("saved");
    const saved = storage.snapshot().pages[0]!;
    expect(saved.content).toEqual(doc("안건 1"));
    expect(saved.updatedAt).toBe(now());
  });

  it("저장 실패는 saveState=error, 다시 시도하면 saved", async () => {
    let fail = true;
    const storage = createMemoryStorage({
      failWrite: () => (fail ? new StorageError("disk_full", "가득 참") : undefined),
    });
    const store = createPagesStore(storage, { delay: 10 });
    store.getState().create({ title: "메모" });
    await vi.advanceTimersByTimeAsync(10);
    expect(store.getState().saveState).toBe("error");
    fail = false;
    expect(await store.getState().retry()).toBe(true);
    expect(store.getState().saveState).toBe("saved");
    expect(storage.snapshot().pages).toHaveLength(1);
  });

  it("읽기 전용 파일(permission_denied)은 error로 남고, 권한을 되돌린 뒤 다시 시도하면 saved (DATA-02)", async () => {
    let readOnly = true;
    const storage = createMemoryStorage({
      failWrite: () =>
        readOnly
          ? new StorageError("permission_denied", "읽기 전용 파일이라 저장할 수 없어요")
          : undefined,
    });
    const store = createPagesStore(storage, { delay: 10 });
    const page = store.getState().create({ title: "메모" });
    store.getState().update(page.id, { content: doc("고친 내용") });
    await vi.advanceTimersByTimeAsync(10);
    expect(store.getState().saveState).toBe("error");
    // 권한을 고치기 전 재시도는 여전히 실패해야 한다
    expect(await store.getState().retry()).toBe(false);
    expect(store.getState().saveState).toBe("error");
    readOnly = false;
    expect(await store.getState().retry()).toBe(true);
    expect(store.getState().saveState).toBe("saved");
    expect(storage.snapshot().pages[0]!.content).toEqual(doc("고친 내용"));
  });

  it("휴지통 → 복원, 휴지통 → 영구 삭제", async () => {
    const storage = createMemoryStorage();
    const store = createPagesStore(storage, { delay: 10, now });
    const page = store.getState().create({ title: "지울 페이지" });
    await store.getState().purge(page.id); // 휴지통 밖 → 무시
    expect(store.getState().pages[page.id]).toBeDefined();
    store.getState().trash(page.id);
    store.getState().restore(page.id);
    expect(store.getState().pages[page.id]!.trashedAt).toBeNull();
    store.getState().trash(page.id);
    // 휴지통 이동이 아직 디바운스 중이어도 영구 삭제는 먼저 저장하고 지운다
    await store.getState().purge(page.id);
    expect(store.getState().pages[page.id]).toBeUndefined();
    expect(storage.snapshot().pages).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(storage.snapshot().pages).toHaveLength(0);
  });

  it("컬렉션 아래에 폴더를 만들거나 옮기면 오류, 문서 아래 폴더는 된다 (SHELL-14)", () => {
    const store = createPagesStore(createMemoryStorage(), { delay: 10, now });
    const folder = store.getState().create({ kind: "folder", title: "업무" });
    const doc = store.getState().create({ title: "로드맵", parentId: folder.id });
    expect(doc.parentId).toBe(folder.id);
    expect(store.getState().create({ kind: "folder", parentId: doc.id }).parentId).toBe(doc.id);
    const coll = store.getState().create({ kind: "collection", title: "작업" });
    expect(() => store.getState().create({ kind: "folder", parentId: coll.id })).toThrow();
    const other = store.getState().create({ kind: "folder", title: "공부" });
    expect(() => store.getState().update(other.id, { parentId: coll.id })).toThrow();
    store.getState().update(other.id, { parentId: folder.id });
    expect(store.getState().pages[other.id]!.parentId).toBe(folder.id);
  });
});

describe("이미지와 영구 삭제 (EDIT-14)", () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
  const img = (src: string) => ({
    type: "doc" as const,
    content: [
      { type: "image", attrs: { src, width: 100 }, content: [{ type: "text", text: "캡" }] },
    ],
  });

  const srcOf = (p: Page) =>
    (p.content as unknown as { content: { attrs: { src: string } }[] }).content[0]!.attrs.src;

  it("복제본이 빌려 쓰던 이미지는 원본을 영구 삭제하기 전에 사본으로 옮긴다", async () => {
    const storage = createMemoryStorage();
    const store = createPagesStore(storage, { delay: 10 });
    const orig = store.getState().create({ title: "원본" });
    const src = await storage.writeAsset(orig.id, PNG);
    store.getState().update(orig.id, { content: img(src), cover: src });
    const copy = store.getState().create({ title: "사본", content: img(src) });
    store.getState().trash(orig.id);
    await store.getState().purge(orig.id);
    const moved = srcOf(store.getState().pages[copy.id]!);
    expect(moved).toMatch(new RegExp(`^assets/${copy.id}/`));
    expect(await storage.readAsset(moved)).toEqual(PNG);
    await expect(storage.readAsset(src)).rejects.toMatchObject({ code: "not_found" });
    const saved = storage.snapshot().pages.find((p) => p.id === copy.id)!;
    expect(srcOf(saved)).toBe(moved);
  });
});
