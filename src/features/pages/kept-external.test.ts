import { createMemoryStorage, createPage } from "@/lib/storage";
import { describe, expect, it, vi } from "vitest";
import { onKeptExternal } from "./kept-external";
import { createPagesStore } from "./store";

const info = { name: "노트", path: "/memory/노트" };
const ID = "01JD0000000000000000000000";

describe("바깥 변경 알림 (DATA-07)", () => {
  it("저장소가 바깥 내용을 남겼다고 하면 그 페이지를 한 번 알린다", async () => {
    const a = { ...createPage({ title: "회의록" }), id: ID };
    const storage = createMemoryStorage({ info, pages: [a], keepsExternal: () => true });
    const store = createPagesStore(storage, { delay: 10_000 });
    await store.getState().load();
    const seen = vi.fn();
    const off = onKeptExternal(seen);

    store.getState().update(ID, { title: "여기서 고침" });
    expect(await store.getState().flushAll()).toBe(true);

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith(ID);
    off();
  });

  it("바깥 내용이 없으면 알리지 않는다", async () => {
    const a = { ...createPage({ title: "회의록" }), id: ID };
    const storage = createMemoryStorage({ info, pages: [a] });
    const store = createPagesStore(storage, { delay: 10_000 });
    await store.getState().load();
    const seen = vi.fn();
    const off = onKeptExternal(seen);

    store.getState().update(ID, { title: "여기서 고침" });
    expect(await store.getState().flushAll()).toBe(true);

    expect(seen).not.toHaveBeenCalled();
    off();
  });
});
