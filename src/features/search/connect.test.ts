import { createPagesStore } from "@/features/pages/store";
import { createMemoryStorage, createPage } from "@/lib/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectSearchIndex } from "./connect";
import { createSearchIndex } from "./search-index";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("connectSearchIndex", () => {
  it("불러오기·만들기·고치기·휴지통·복원·영구 삭제를 따라간다", async () => {
    const existing = { ...createPage({ title: "기존 회의록" }), content: doc("안건") };
    const store = createPagesStore(createMemoryStorage({ pages: [existing] }), { delay: 10 });
    const index = createSearchIndex();
    const stop = connectSearchIndex(store, index);
    const titles = (q: string) => index.search(q).map((r) => r.title);

    await store.getState().load();
    expect(titles("안건")).toEqual(["기존 회의록"]);

    const memo = store.getState().create({ title: "새 메모" });
    store.getState().update(memo.id, { content: doc("디자인 검토") });
    expect(titles("검토")).toEqual(["새 메모"]);

    store.getState().trash(memo.id);
    expect(titles("검토")).toEqual([]);
    store.getState().restore(memo.id);
    expect(titles("검토")).toEqual(["새 메모"]);

    store.getState().trash(memo.id);
    await store.getState().purge(memo.id);
    expect(index.search("검토", { includeTrashed: true })).toEqual([]);

    stop();
    store.getState().create({ title: "끊은 뒤 메모" });
    expect(titles("끊은 뒤")).toEqual([]);
  });
});
