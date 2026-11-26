import { createMemoryStorage, createPage, type Page } from "@/lib/storage";
import { describe, expect, it, vi } from "vitest";
import { createPagesStore } from "./store";

const info = { name: "노트", path: "/memory/노트" };
const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const pageOf = (i: number): Page => ({
  ...createPage({ title: `페이지 ${i}` }),
  id: `01JD00000000000000000000${String(i).padStart(2, "0")}`,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
  content: doc(`본문 ${i}`),
});

describe("열기만 하면 버전 기록을 만들지 않는다 (DATA-09)", () => {
  it("워크스페이스 열기 + 백그라운드 본문 읽기 + 바깥 변경 확인 → 버전 기록 0개", async () => {
    const pages = Array.from({ length: 50 }, (_, i) => pageOf(i));
    const storage = createMemoryStorage({ info, pages });
    const save = vi.spyOn(storage, "saveVersion");
    const write = vi.spyOn(storage, "writePage");
    const store = createPagesStore(storage, { delay: 10_000 });

    await store.getState().load();
    // 바깥 확인은 본문 읽기 전 상태를 기준으로 시작한다
    const base = store.getState().pages;
    await store.getState().ensureAllBodies();
    // 확인이 끝날 때까지 백그라운드 본문 읽기가 끝나 있으면, 내용이 같은 페이지는 남기지 않는다
    const read = await storage.readPages(pages.map((p) => p.id));
    const r = store.getState().applyExternal({ pages: read.pages, removed: [], base });
    expect(r.conflicts).toEqual([]);

    expect(save).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("기준 시점 뒤에 고친 페이지는 바깥 내용으로 덮지 않고 버전 기록에 남긴다", async () => {
    const a = pageOf(1);
    const storage = createMemoryStorage({ info, pages: [a] });
    const save = vi.spyOn(storage, "saveVersion");
    const store = createPagesStore(storage, { delay: 10_000 });
    await store.getState().load();
    const base = store.getState().pages;
    await store.getState().ensureBody(a.id);
    store.getState().update(a.id, { title: "여기서 고친 제목" });

    const r = store
      .getState()
      .applyExternal({ pages: [{ ...a, title: "바깥 내용" }], removed: [], base });
    expect(r.conflicts).toEqual([a.id]);
    expect(store.getState().pages[a.id]?.title).toBe("여기서 고친 제목");
    // 버전 기록은 뒤에서 차례로 쓴다
    await new Promise((done) => setTimeout(done, 0));
    expect(save).toHaveBeenCalledTimes(1);
  });
});
