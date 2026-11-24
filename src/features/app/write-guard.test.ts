import { createMemoryStorage, StorageError, type Page, type Storage } from "@/lib/storage";
import { createMetaStore } from "@/features/meta/store";
import { createPagesStore } from "@/features/pages/store";
import { createSessionStore } from "@/features/session/store";
import { createWorkspaceStore, UnsavedChangesError } from "@/features/workspace/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceWriteGuard } from "./write-guard";

/**
 * 워크스페이스 루트를 흉내 낸다. Rust가 현재 루트에 쓰듯, 쓰기가 일어난 순간의 루트를 기록한다.
 */
function routedStorage(options: { failWrite?: (page: Page) => StorageError | undefined } = {}) {
  let root = "/w/A";
  const writes: { root: string; id: string }[] = [];
  const base = createMemoryStorage({
    info: { name: "A", path: "/w/A" },
    failWrite: options.failWrite,
  });
  const storage: Storage = {
    ...base,
    async switchWorkspace(path) {
      root = path;
      return { name: path.slice(3), path, token: 1 };
    },
    async writePage(page) {
      writes.push({ root, id: page.id });
      return base.writePage(page);
    },
  };
  return { storage, writes, currentRoot: () => root };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("워크스페이스 전환 전 저장 (DATA-03)", () => {
  it("A에서 800ms 안에 남은 편집은 전환 전에 A에 쓰고, B에 쓰지 않는다", async () => {
    const { storage, writes, currentRoot } = routedStorage();
    const pages = createPagesStore(storage);
    const session = createSessionStore(storage);
    const meta = createMetaStore(storage);
    await pages.getState().load();
    await meta.getState().load();
    const page = pages.getState().create({ title: "A 노트" });
    pages.getState().update(page.id, { title: "A 노트 수정" });

    const ws = createWorkspaceStore(storage, {
      beforeChange: createWorkspaceWriteGuard({ pages, session, meta }),
    });
    await ws.getState().init();
    await ws.getState().switchTo("/w/B");
    await vi.advanceTimersByTimeAsync(2000);

    expect(currentRoot()).toBe("/w/B");
    expect(writes.filter((w) => w.id === page.id)).toEqual([
      expect.objectContaining({ root: "/w/A" }),
    ]);
    expect(writes.some((w) => w.root === "/w/B")).toBe(false);
  });

  it("저장하지 못한 변경이 남으면 전환을 막고 오류를 알린다", async () => {
    const { storage, currentRoot } = routedStorage({
      failWrite: () => new StorageError("io", "disk"),
    });
    const pages = createPagesStore(storage);
    const session = createSessionStore(storage);
    const meta = createMetaStore(storage);
    await pages.getState().load();
    await meta.getState().load();
    pages.getState().create({ title: "실패할 노트" });

    const ws = createWorkspaceStore(storage, {
      beforeChange: createWorkspaceWriteGuard({ pages, session, meta }),
    });
    await ws.getState().init();
    await expect(ws.getState().switchTo("/w/B")).rejects.toBeInstanceOf(UnsavedChangesError);
    expect(currentRoot()).toBe("/w/A");
    expect(ws.getState().workspace?.path).toBe("/w/A");
    expect(pages.getState().saveState).toBe("error");
  });

  it("가드 없이 바뀐 뒤에도 A의 대기 쓰기는 B에 쓰이지 않는다 (안전장치)", async () => {
    const { storage, writes } = routedStorage();
    const pages = createPagesStore(storage);
    await pages.getState().load();
    const page = pages.getState().create({ title: "늦은 노트" });
    pages.getState().update(page.id, { title: "늦은 노트 수정" });

    const ws = createWorkspaceStore(storage);
    await ws.getState().init();
    await ws.getState().switchTo("/w/B");
    await vi.advanceTimersByTimeAsync(2000);

    expect(writes.some((w) => w.root === "/w/B")).toBe(false);
    expect(pages.getState().saveState).toBe("error");
  });
});
