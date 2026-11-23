import { createMemoryStorage, createPage } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { createPagesStore } from "./store";

const info = { name: "노트", path: "/memory/노트" };

describe("외부 변경 반영 (DATA-07)", () => {
  it("바뀐 페이지는 바꾸고, 사라진 페이지는 빼고, 본문을 다시 읽게 rev를 올린다", async () => {
    const a = { ...createPage({ title: "회의록" }), id: "01JD0000000000000000000000" };
    const b = { ...createPage({ title: "지울 메모" }), id: "01JD0000000000000000000001" };
    const storage = createMemoryStorage({ info, pages: [a, b] });
    const store = createPagesStore(storage, { delay: 10_000 });
    await store.getState().load();

    storage.external({ pages: [{ ...a, title: "회의록 (다른 기기에서 고침)" }], removed: [b.id] });
    const changes = await storage.scanChanges();
    expect(changes).toEqual({ changed: [a.id], removed: [b.id], meta: false });
    const { pages } = await storage.readPages(changes.changed);
    const r = store.getState().applyExternal({ pages, removed: changes.removed });

    expect(r).toEqual({ applied: [a.id], removed: [b.id], conflicts: [] });
    expect(store.getState().pages[a.id]?.title).toBe("회의록 (다른 기기에서 고침)");
    expect(store.getState().pages[b.id]).toBeUndefined();
    expect(store.getState().externalRev[a.id]).toBe(1);
    expect(await storage.scanChanges()).toEqual({ changed: [], removed: [], meta: false });
  });

  it("아직 저장하지 않은 페이지는 덮지 않는다", async () => {
    const a = { ...createPage({ title: "초안" }), id: "01JD0000000000000000000000" };
    const storage = createMemoryStorage({ info, pages: [a] });
    const store = createPagesStore(storage, { delay: 10_000 });
    await store.getState().load();
    store.getState().update(a.id, { title: "여기서 고치는 중" });

    const r = store
      .getState()
      .applyExternal({ pages: [{ ...a, title: "바깥 내용" }], removed: [a.id] });
    expect(r.applied).toEqual([]);
    expect(r.conflicts).toEqual([a.id]);
    expect(store.getState().pages[a.id]?.title).toBe("여기서 고치는 중");
    expect(store.getState().externalRev[a.id]).toBeUndefined();
  });

  it("확인하는 사이 이 앱에서 바뀌었으면(저장까지 끝났어도) 덮지 않는다", async () => {
    const a = { ...createPage({ title: "초안" }), id: "01JD0000000000000000000000" };
    const storage = createMemoryStorage({ info, pages: [a] });
    const store = createPagesStore(storage, { delay: 0 });
    await store.getState().load();
    const base = store.getState().pages;
    store.getState().update(a.id, { title: "방금 고침" });
    await store.getState().flushAll();
    const r = store
      .getState()
      .applyExternal({ pages: [{ ...a, title: "바깥" }], removed: [], base });
    expect(r.conflicts).toEqual([a.id]);
    expect(store.getState().pages[a.id]?.title).toBe("방금 고침");
  });
});
