import { openTodos } from "@/features/todos";
import { createSearchIndex } from "@/features/search/search-index";
import { connectSearchIndex } from "@/features/search/connect";
import { createMemoryStorage, createPage, type Page } from "@/lib/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findBacklinks } from "./backlinks";
import { createPagesStore } from "./store";
import { backlinksIn, createSummaryIndex, openTodosIn, summarizePage } from "./summary";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const ID = (n: number) => `01KZ${String(n).padStart(22, "0")}`;
const link = (target: string, text = "링크") => ({
  type: "text",
  text,
  marks: [{ type: "link", attrs: { href: `cetusnote://page/${target}` } }],
});
const mention = (target: string, label: string) => ({
  type: "pageMention",
  attrs: { id: target, label },
});
const para = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...blocks: unknown[]) => ({ type: "doc" as const, content: blocks });

/** 같은 날 고친 것처럼 보이지 않게 시각을 나눈다 */
const at = (minute: number) => new Date(Date.UTC(2026, 10, 24, 0, minute)).toISOString();

function fixture(): Record<string, Page> {
  const target = { ...createPage({ title: "대상" }), id: ID(1), updatedAt: at(1) };
  const a = {
    ...createPage({ title: "멘션" }),
    id: ID(2),
    updatedAt: at(5),
    content: doc(
      para({ type: "text", text: "참고 " }, mention(ID(1), "대상"), { type: "text", text: " 끝" }),
    ),
  };
  // 한 페이지에서 여러 블록이 언급: 문맥은 3개까지, 개수는 전부
  const b = {
    ...createPage({ title: "링크" }),
    id: ID(3),
    updatedAt: at(9),
    content: doc(
      para(link(ID(1), "첫째")),
      para({ type: "text", text: "가".repeat(200) }, link(ID(1), "둘째")),
      { type: "bulletList", content: [{ type: "listItem", content: [para(link(ID(1), "셋째"))] }] },
      para(link(ID(1), "넷째")),
      para({ type: "text", text: "다른 글" }, link(ID(9), "다른 곳")),
    ),
  };
  const trashed = {
    ...createPage({ title: "휴지통" }),
    id: ID(4),
    updatedAt: at(12),
    trashedAt: at(12),
    content: doc(para(link(ID(1)))),
  };
  const template = {
    ...createPage({ title: "템플릿" }),
    id: ID(5),
    updatedAt: at(13),
    template: { category: "work", description: "", builtin: null, pageTitle: "" },
    content: doc(para(link(ID(1)))),
  };
  const self = {
    ...createPage({ title: "자기" }),
    id: ID(6),
    updatedAt: at(14),
    content: doc(para(link(ID(6)), link(ID(1)))),
  };
  const todos = {
    ...createPage({ title: "할 일" }),
    id: ID(7),
    updatedAt: at(20),
    content: doc({
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [para({ type: "text", text: "보고서 쓰기" })],
        },
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [para({ type: "text", text: "끝난 일" })],
        },
      ],
    }),
  };
  const pages = [target, a, b, trashed, template, self, todos];
  return Object.fromEntries(pages.map((p) => [p.id, p]));
}

function summaryOf(pages: Record<string, Page>) {
  const index = createSummaryIndex();
  const titleOf = (id: string) => pages[id]?.title;
  index.setMany(Object.values(pages).map((p) => [p.id, summarizePage(p, titleOf)]));
  return index;
}

describe("본문 요약 (SYS-10, ADR-022)", () => {
  it("요약으로 찾은 백링크는 본문을 직접 훑은 결과와 같다", () => {
    const pages = fixture();
    const index = summaryOf(pages);
    for (const id of Object.keys(pages)) {
      expect(backlinksIn(id, pages, index)).toEqual(findBacklinks(pages, id));
    }
    const back = backlinksIn(ID(1), pages, index);
    // 최근에 고친 페이지가 앞 (ID 6은 14분, ID 3은 9분, ID 2는 5분). 대상 자신은 빠진다
    expect(back.map((b) => b.page.id)).toEqual([ID(6), ID(3), ID(2)]);
    // 링크 페이지는 4개 언급, 문맥은 3개까지
    const from = back.find((b) => b.page.id === ID(3))!;
    expect(from.count).toBe(4);
    expect(from.snippets).toHaveLength(3);
    // 휴지통·템플릿은 빠진다
    expect(back.some((b) => [ID(4), ID(5)].includes(b.page.id))).toBe(false);
  });

  it("요약으로 모은 할 일은 본문을 직접 훑은 할 일과 같다(열린 것만, 최근 문서부터)", () => {
    const pages = fixture();
    const index = summaryOf(pages);
    expect(openTodosIn(Object.values(pages), index)).toEqual(openTodos(Object.values(pages)));
    expect(openTodosIn(Object.values(pages), index).map((t) => t.text)).toEqual(["보고서 쓰기"]);
  });

  it("요약이 없는 페이지는 백링크와 할 일에서 빠진다 (아직 읽지 않은 본문)", () => {
    const pages = fixture();
    const index = createSummaryIndex();
    expect(backlinksIn(ID(1), pages, index)).toEqual([]);
    expect(openTodosIn(Object.values(pages), index)).toEqual([]);
  });

  it("요약 색인은 값이 바뀔 때만 버전을 올리고 구독자에게 알린다", () => {
    const index = createSummaryIndex();
    const listener = vi.fn();
    const off = index.subscribe(listener);
    const v0 = index.version;
    index.setMany([]);
    expect(index.version).toBe(v0);
    index.setMany([[ID(1), { links: new Map(), todos: [], asset: null }]]);
    expect(index.version).toBe(v0 + 1);
    index.remove(ID(9));
    expect(index.version).toBe(v0 + 1);
    index.remove(ID(1));
    expect(index.version).toBe(v0 + 2);
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    index.setMany([[ID(2), { links: new Map(), todos: [], asset: null }]]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("백그라운드 읽기가 요약을 채우고, 고친 본문의 요약을 다시 뽑는다", async () => {
    const target = { ...createPage({ title: "대상" }), id: ID(1) };
    const from = {
      ...createPage({ title: "출처" }),
      id: ID(2),
      content: doc(para(link(ID(1)))),
    };
    const store = createPagesStore(createMemoryStorage({ pages: [target, from] }), { delay: 10 });
    const index = createSearchIndex();
    const summaries = createSummaryIndex();
    connectSearchIndex(store, index, { summaries });

    await store.getState().load();
    expect(backlinksIn(ID(1), store.getState().pages, summaries)).toEqual([]);
    await vi.runAllTimersAsync();
    expect(backlinksIn(ID(1), store.getState().pages, summaries).map((b) => b.page.id)).toEqual([
      ID(2),
    ]);

    // 출처 본문에서 링크를 지운다 → 요약도 따라간다
    store.getState().update(ID(2), { content: doc(para({ type: "text", text: "링크 없음" })) });
    await vi.runAllTimersAsync();
    expect(backlinksIn(ID(1), store.getState().pages, summaries)).toEqual([]);

    // 다시 읽는 워크스페이스는 요약을 비우고 새로 채운다
    await store.getState().load();
    expect(summaries.size).toBe(0);
    await vi.runAllTimersAsync();
    expect(summaries.size).toBe(2);
  });
});
