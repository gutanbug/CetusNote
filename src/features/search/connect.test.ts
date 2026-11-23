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

describe("connectSearchIndex 조각 색인 (SYS-10)", () => {
  /** 테스트에서 예약된 조각을 직접 돌린다 */
  function manualScheduler() {
    const queue: (() => void)[] = [];
    return {
      schedule: (run: () => void) => void queue.push(run),
      flush(max = Infinity) {
        let n = 0;
        while (queue.length && n++ < max) queue.shift()!();
        return queue.length;
      },
    };
  }

  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      ...createPage({ title: `문서 ${i}` }),
      id: `01JE${String(i).padStart(22, "0")}`,
      content: doc(i % 10 === 0 ? "공유 키워드 본문" : `본문 ${i}`),
    }));

  it("많은 페이지를 불러오면 조각으로 나눠 만들고, 끝나면 전체 빌드와 같다", async () => {
    const pages = many(300);
    const store = createPagesStore(createMemoryStorage({ pages }), { delay: 10 });
    const index = createSearchIndex();
    const sched = manualScheduler();
    connectSearchIndex(store, index, { budgetMs: 0, schedule: sched.schedule });

    await store.getState().load();
    // 아직 다 만들지 않았다 — 조각이 남아 있다
    expect(index.size).toBeLessThan(300);
    expect(index.search("공유 키워드").length).toBeLessThanOrEqual(30);

    expect(sched.flush()).toBe(0);
    const full = createSearchIndex();
    full.build(Object.values(store.getState().pages));
    expect(index.size).toBe(full.size);
    for (const q of ["공유 키워드", "문서 7", "본문 1", "없는말"]) {
      expect(
        index
          .search(q, { includeTrashed: true })
          .map((r) => r.id)
          .sort(),
      ).toEqual(
        full
          .search(q, { includeTrashed: true })
          .map((r) => r.id)
          .sort(),
      );
    }
  });

  it("조각 작업 중에 고친 페이지와 지운 페이지도 결과에 맞다", async () => {
    const pages = many(200);
    const store = createPagesStore(createMemoryStorage({ pages }), { delay: 10 });
    const index = createSearchIndex();
    const sched = manualScheduler();
    connectSearchIndex(store, index, { budgetMs: 0, schedule: sched.schedule });

    await store.getState().load();
    sched.flush(20);
    const late = pages[199]!.id;
    const gone = pages[198]!.id;
    store.getState().update(late, { content: doc("늦은 편집 키워드") });
    store.getState().trash(gone);
    await store.getState().purge(gone);

    sched.flush();
    expect(index.search("늦은 편집 키워드").map((r) => r.id)).toEqual([late]);
    expect(index.search("문서 198", { includeTrashed: true })).toEqual([]);
  });
});
