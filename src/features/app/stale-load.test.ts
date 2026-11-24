import { createMemoryStorage, createPage, type Storage } from "@/lib/storage";
import { createMetaStore } from "@/features/meta/store";
import { createPagesStore } from "@/features/pages/store";
import { createSessionStore } from "@/features/session/store";
import { advanceWorkspaceGeneration } from "@/features/workspace/generation";
import { describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type Loaded = Awaited<ReturnType<Storage["loadPages"]>>;

describe("느린 워크스페이스 불러오기 (SYS-09)", () => {
  it("A 페이지 불러오기가 B 뒤에 끝나도 B 페이지를 덮지 않는다", async () => {
    const pageA = createPage({ title: "A" });
    const pageB = createPage({ title: "B" });
    const slowA = deferred<Loaded>();
    const storage: Storage = {
      ...createMemoryStorage(),
      loadPages: vi
        .fn<Storage["loadPages"]>()
        .mockReturnValueOnce(slowA.promise)
        .mockResolvedValueOnce({ pages: [pageB], errors: [] }),
    };
    const pages = createPagesStore(storage);
    const aLoad = pages.getState().load();
    advanceWorkspaceGeneration(); // A → B 전환
    await pages.getState().load();
    slowA.resolve({ pages: [pageA], errors: [] });
    await aLoad;
    expect(Object.keys(pages.getState().pages)).toEqual([pageB.id]);
  });

  it("A 화면 상태 읽기가 B 뒤에 끝나도 세션을 A로 되돌리지 않는다", async () => {
    const slowA = deferred<unknown>();
    const storage: Storage = {
      ...createMemoryStorage(),
      readSettings: vi
        .fn<Storage["readSettings"]>()
        .mockReturnValueOnce(slowA.promise as Promise<Record<string, unknown>>)
        .mockResolvedValueOnce({}),
    };
    const session = createSessionStore(storage);
    const aLoad = session.getState().load("/w/A");
    advanceWorkspaceGeneration();
    await session.getState().load("/w/B");
    slowA.resolve({});
    await aLoad;
    expect(session.getState().workspace).toBe("/w/B");
  });

  it("A workspace.json 읽기가 B 뒤에 끝나도 메타를 A 것으로 바꾸지 않는다", async () => {
    const metaA = await createMemoryStorage({ workspace: { name: "A" } }).readWorkspace();
    const metaB = await createMemoryStorage({ workspace: { name: "B" } }).readWorkspace();
    const slowA = deferred<typeof metaA>();
    const storage: Storage = {
      ...createMemoryStorage(),
      readWorkspace: vi
        .fn<Storage["readWorkspace"]>()
        .mockReturnValueOnce(slowA.promise)
        .mockResolvedValueOnce({ ...metaB, name: "B" }),
    };
    const meta = createMetaStore(storage);
    const aLoad = meta.getState().load();
    advanceWorkspaceGeneration();
    await meta.getState().load();
    slowA.resolve({ ...metaA, name: "A" });
    await aLoad;
    expect(meta.getState().meta?.name).toBe("B");
  });
});
