import { createPage, type Page } from "@/lib/storage";
import { createSearchIndex } from "@/features/search";
import { describe, expect, it } from "vitest";
import { mentionTitleOf, resolveMention, searchMentions } from "./mention-model";

const make = (over: Partial<Page>): Page => ({ ...createPage(over), ...over });

function fixture() {
  const folder = make({ kind: "folder", title: "업무" });
  const weekly = make({ title: "주간 회의록", parentId: folder.id, updatedAt: "2026-11-18" });
  const kickoff = make({ title: "킥오프 회의", updatedAt: "2026-11-19" });
  const plan = make({ title: "회의 준비", updatedAt: "2026-11-01" });
  const gone = make({ title: "지난 회의", trashedAt: "2026-11-10" });
  const child = make({ title: "회의 안의 회의", parentId: gone.id });
  const pages = Object.fromEntries(
    [folder, weekly, kickoff, plan, gone, child].map((p) => [p.id, p]),
  );
  return { pages, folder, weekly, kickoff, plan, gone, child };
}

/** ⌘K와 같은 검색 인덱스로 순위를 매긴다 (SRCH-04) */
function rankerFor(pages: Record<string, Page>) {
  const index = createSearchIndex();
  index.build(Object.values(pages));
  return (query: string) =>
    index
      .search(query)
      .filter((r) => r.matchIn === "title")
      .map((r) => r.id);
}

const search = (pages: Record<string, Page>, query: string, opts = {}) =>
  searchMentions(pages, query, { rankTitles: rankerFor(pages), ...opts });

describe("멘션 찾기 (EDIT-13)", () => {
  it("검색어 없음: 최근에 연 순서 → 최근에 고친 순. 폴더·휴지통·지금 페이지는 빠진다", () => {
    const { pages, weekly, kickoff, plan } = fixture();
    const out = search(pages, "", { exceptId: plan.id, recent: [weekly.id] });
    expect(out.map((t) => t.title)).toEqual([weekly.title, kickoff.title]);
  });

  it("검색어: 제목에 모두 들어 있어야 하고, 검색어로 시작하는 제목이 먼저", () => {
    const { pages } = fixture();
    expect(search(pages, "회의").map((t) => t.title)).toEqual([
      "회의 준비",
      "킥오프 회의",
      "주간 회의록",
    ]);
    expect(search(pages, "주간 회의").map((t) => t.title)).toEqual(["주간 회의록"]);
  });

  it("제목이 검색어와 똑같은 페이지가 사본보다 먼저 온다 (⌘K 순위와 같다)", () => {
    const original = make({ title: "abc Test", updatedAt: "2026-11-01" });
    const copy = make({ title: "abc Test 사본", updatedAt: "2026-11-20" });
    const pages = Object.fromEntries([original, copy].map((p) => [p.id, p]));
    expect(search(pages, "abc Test").map((t) => t.title)).toEqual(["abc Test", "abc Test 사본"]);
  });

  it("깨진 링크: 없음·폴더·휴지통·휴지통 안의 하위 페이지", () => {
    const { pages, folder, weekly, gone, child } = fixture();
    expect(resolveMention(pages, weekly.id)?.title).toBe("주간 회의록");
    for (const id of ["없는-id", folder.id, gone.id, child.id])
      expect(resolveMention(pages, id)).toBeNull();
    expect(mentionTitleOf(pages)(gone.id)).toBeUndefined();
  });
});
