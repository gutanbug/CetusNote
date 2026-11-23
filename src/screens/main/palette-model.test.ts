import { createSearchIndex } from "@/features/search";
import { createPage, type Page } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import {
  isCommandQuery,
  matchCommands,
  pagePath,
  paletteItems,
  recentPages,
  visibleIds,
} from "./palette-model";

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

function setup() {
  const work = {
    ...createPage({ kind: "folder", title: "업무" }),
    updatedAt: "2026-11-01T00:00:00Z",
  };
  const meet: Page = {
    ...createPage({ title: "주간 회의", parentId: work.id }),
    content: doc("출시 일정을 검토했어요"),
    updatedAt: "2026-11-19T10:00:00Z",
  };
  const old: Page = { ...createPage({ title: "회의 메모" }), updatedAt: "2026-11-10T00:00:00Z" };
  const gone = {
    ...createPage({ kind: "folder", title: "지난" }),
    trashedAt: "2026-11-18T00:00:00Z",
  };
  const inGone: Page = {
    ...createPage({ title: "회의 옛날", parentId: gone.id }),
    updatedAt: "2026-11-19T12:00:00Z",
  };
  const pages = Object.fromEntries([work, meet, old, gone, inGone].map((p) => [p.id, p]));
  const index = createSearchIndex();
  index.build(Object.values(pages));
  return { pages, index, work, meet, old, inGone };
}

describe("⌘K 목록 (SRCH-01)", () => {
  it("검색어가 없으면 최근에 고친 문서 — 폴더와 휴지통 폴더 안은 뺀다", () => {
    const { pages, index, meet, old } = setup();
    expect(paletteItems("", pages, index).map((i) => i.id)).toEqual([meet.id, old.id]);
  });

  it("검색 결과: 경로, 제목 강조, 휴지통 폴더 안 문서는 빠진다", () => {
    const { pages, index, meet, old, inGone } = setup();
    const items = paletteItems("회의", pages, index);
    expect(items.map((i) => i.id)).toEqual(expect.arrayContaining([meet.id, old.id]));
    expect(items.map((i) => i.id)).not.toContain(inGone.id);
    const m = items.find((i) => i.id === meet.id)!;
    expect(m.path).toBe("업무");
    expect(m.titleHighlights).toEqual([[3, 5]]);
  });

  it("초성 검색이면 제목의 맞은 글자를 강조", () => {
    const { pages, index, meet } = setup();
    const m = paletteItems("ㅎㅇ", pages, index).find((i) => i.id === meet.id)!;
    expect(m.titleHighlights).toEqual([[3, 5]]);
  });

  it("본문에서 맞으면 발췌문과 강조", () => {
    const { pages, index } = setup();
    const [r] = paletteItems("검토", pages, index);
    expect(r!.snippet).toContain("검토");
    const [a, b] = r!.highlights[0]!;
    expect(r!.snippet.slice(a, b)).toBe("검토");
  });

  it("경로와 보이는 페이지", () => {
    const { pages, meet, inGone } = setup();
    expect(pagePath(meet, pages)).toBe("업무");
    expect(visibleIds(pages).has(inGone.id)).toBe(false);
  });
});

describe("팔레트 명령 (SRCH-02)", () => {
  const cmds = [
    { title: "설정 열기", keywords: ["settings"] },
    { title: "다크 테마로 바꾸기", keywords: ["theme", "dark"] },
    { title: "집중 모드 켜기", keywords: ["focus"] },
  ];

  it("이름·다른 이름에 낱말이 모두 들어 있으면 맞다 (대소문자 무시)", () => {
    expect(matchCommands("테마", cmds).map((c) => c.title)).toEqual(["다크 테마로 바꾸기"]);
    expect(matchCommands("Dark 바꾸기", cmds)).toHaveLength(1);
    expect(matchCommands("다크 설정", cmds)).toHaveLength(0);
  });

  it("> 로 시작하면 명령 검색, 빈 검색어는 전부", () => {
    expect(isCommandQuery(" >집중")).toBe(true);
    expect(isCommandQuery("회의")).toBe(false);
    expect(matchCommands(">", cmds)).toHaveLength(3);
    expect(matchCommands("> focus", cmds).map((c) => c.title)).toEqual(["집중 모드 켜기"]);
  });
});

describe("recentPages", () => {
  it("컬렉션과 그 레코드(보드 카드)는 넣고, 폴더·휴지통·없는 id는 뺀다", () => {
    const folder = createPage({ kind: "folder", title: "업무" });
    const board = createPage({ kind: "collection", title: "스프린트 보드" });
    const card = createPage({ title: "리뷰 준비", parentId: board.id });
    const gone = {
      ...createPage({ title: "지운 카드", parentId: board.id }),
      trashedAt: "2026-11-20T00:00:00Z",
    };
    const all = Object.fromEntries([folder, board, card, gone].map((p) => [p.id, p]));
    const ids = [card.id, "missing", gone.id, folder.id, board.id];
    expect(recentPages(ids, all, visibleIds(all)).map((p) => p.title)).toEqual([
      "리뷰 준비",
      "스프린트 보드",
    ]);
  });
});

describe("visibleIds — 레코드", () => {
  it("보이는 컬렉션의 레코드는 넣고, 휴지통 레코드·휴지통 컬렉션의 레코드는 뺀다", () => {
    const board = createPage({ kind: "collection", title: "보드" });
    const card = createPage({ title: "카드", parentId: board.id });
    const trashedCard = {
      ...createPage({ title: "지운 카드", parentId: board.id }),
      trashedAt: "2026-11-20T00:00:00Z",
    };
    const goneBoard = {
      ...createPage({ kind: "collection", title: "지운 보드" }),
      trashedAt: "2026-11-20T00:00:00Z",
    };
    const orphan = createPage({ title: "지운 보드의 카드", parentId: goneBoard.id });
    const all = Object.fromEntries(
      [board, card, trashedCard, goneBoard, orphan].map((p) => [p.id, p]),
    );
    const v = visibleIds(all);
    expect(v.has(card.id)).toBe(true);
    expect(v.has(trashedCard.id)).toBe(false);
    expect(v.has(orphan.id)).toBe(false);
  });

  it("검색 결과·빈 검색 목록에 레코드가 나온다", () => {
    const board = createPage({ kind: "collection", title: "보드" });
    const card = createPage({ title: "리뷰 준비", parentId: board.id });
    const all = Object.fromEntries([board, card].map((p) => [p.id, p]));
    const index = createSearchIndex();
    index.build(Object.values(all));
    expect(paletteItems("리뷰", all, index).map((i) => i.title)).toContain("리뷰 준비");
    expect(paletteItems("", all, index).map((i) => i.title)).toContain("리뷰 준비");
  });
});
