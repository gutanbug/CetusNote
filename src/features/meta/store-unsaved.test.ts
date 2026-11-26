import { createMemoryStorage, StorageError } from "@/lib/storage";
import { describe, expect, it, vi } from "vitest";
import { createMetaStore } from "./store";

describe("워크스페이스 전환 전 workspace.json 저장 (DATA-03)", () => {
  it("편집이 없으면 flush는 workspace.json을 쓰지 않고 통과한다", async () => {
    const storage = createMemoryStorage();
    const write = vi.spyOn(storage, "writeWorkspace");
    const store = createMetaStore(storage, { delay: 10 });
    await store.getState().load();
    write.mockClear();

    expect(await store.getState().flush()).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });

  it("첫 열기에서 채우는 templatesSeeded는 쓰기가 실패해도 전환을 막지 않는다", async () => {
    const storage = createMemoryStorage();
    const store = createMetaStore(storage, { delay: 10_000 });
    await store.getState().load();
    vi.spyOn(storage, "writeWorkspace").mockRejectedValue(new StorageError("locked", "x"));

    store.getState().markTemplatesSeeded();
    expect(await store.getState().flush()).toBe(true);
  });

  it("사용자가 바꾼 태그 색이 쓰이지 못하면 flush는 false, 다시 쓰면 true", async () => {
    const storage = createMemoryStorage();
    const store = createMetaStore(storage, { delay: 10_000 });
    await store.getState().load();
    const write = vi
      .spyOn(storage, "writeWorkspace")
      .mockRejectedValueOnce(new StorageError("io", "x"));

    store.getState().setTagColor("중요", "red");
    expect(await store.getState().flush()).toBe(false);
    expect(await store.getState().flush()).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
  });
});
