import { createPage, type Page } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { cleanTagName, planTagChange, tagExists, tagUsage, undoTagChange } from "./manage";

const ID_PREFIX = "01ARZ3NDEKTSV4RRFFQ69G5F";
const A_ID = ID_PREFIX + "AA";
const B_ID = ID_PREFIX + "BB";
const C_ID = ID_PREFIX + "CC";
const D_ID = ID_PREFIX + "DD";
const K_ID = ID_PREFIX + "KK";
const NOW = "2026-11-22T00:00:00.000Z";
const OLD = "2026-11-01T00:00:00.000Z";

function page(id: string, tags: string[], extra: Partial<Page> = {}): Page {
  const p = createPage({ title: id });
  return {
    ...p,
    id,
    updatedAt: OLD,
    props: { ...p.props, tags },
    ...extra,
  } as Page;
}

function pagesOf(...list: Page[]): Record<string, Page> {
  return Object.fromEntries(list.map((p) => [p.id, p]));
}

/** 적용한 결과 페이지 태그 목록 */
function tagsAfter(
  pages: Record<string, Page>,
  id: string,
  result: ReturnType<typeof planTagChange>,
) {
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  const patch = result.plan.pages[id];
  return patch ? patch.props.tags : pages[id]!.props.tags;
}

describe("cleanTagName / tagExists / tagUsage", () => {
  it("trims the name", () => {
    expect(cleanTagName("  회의  ")).toBe("회의");
  });

  it("counts pages that carry the tag, including trashed and templates", () => {
    const pages = pagesOf(
      page(A_ID, ["x"]),
      page(B_ID, ["x", "y"], { trashedAt: OLD }),
      page(C_ID, ["y"], {
        template: { category: "work", description: "", pageTitle: "", builtin: null },
      }),
    );
    expect(tagUsage(pages, "x")).toBe(2);
    expect(tagUsage(pages, "z")).toBe(0);
    expect(tagExists(pages, "y")).toBe(true);
    expect(tagExists(pages, "z")).toBe(false);
  });

  it("matches tags exactly (case-sensitive, like the rest of the app)", () => {
    const pages = pagesOf(page(A_ID, ["Work"]));
    expect(tagExists(pages, "work")).toBe(false);
  });
});

describe("rename", () => {
  it("renames the tag on every page, keeping order, and moves the color", () => {
    const pages = pagesOf(page(A_ID, ["old", "x"]), page(B_ID, ["x"]), page(C_ID, ["y"]));
    const colors = { old: "red", x: "blue" };
    const r = planTagChange(pages, colors, { kind: "rename", from: "old", to: "new" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.merged).toBe(false);
    expect(r.plan.affected).toBe(1);
    expect(tagsAfter(pages, A_ID, r)).toEqual(["new", "x"]);
    expect(r.plan.pages[B_ID]).toBeUndefined();
    expect(r.plan.colors).toEqual({ x: "blue", new: "red" });
    expect(r.plan.pages[A_ID]!.updatedAt).toBe(NOW);
  });

  it("keeps the new name's own color when it already has one", () => {
    const pages = pagesOf(page(A_ID, ["old"]));
    const colors = { old: "red", new: "green" };
    const r = planTagChange(pages, colors, { kind: "rename", from: "old", to: "new" }, NOW);
    expect(r.ok && r.plan.colors).toEqual({ new: "green" });
  });

  it("treats a rename onto an existing tag as a merge and says so", () => {
    const pages = pagesOf(page(A_ID, ["old", "new"]), page(B_ID, ["old"]));
    const colors = { old: "red", new: "green" };
    const r = planTagChange(pages, colors, { kind: "rename", from: "old", to: "new" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.merged).toBe(true);
    expect(tagsAfter(pages, A_ID, r)).toEqual(["new"]);
    expect(tagsAfter(pages, B_ID, r)).toEqual(["new"]);
    expect(r.plan.colors).toEqual({ new: "green" });
  });

  it("trims the new name before comparing", () => {
    const pages = pagesOf(page(A_ID, ["old"]));
    const r = planTagChange(pages, {}, { kind: "rename", from: "old", to: "  new  " }, NOW);
    expect(r.ok && tagsAfter(pages, A_ID, r)).toEqual(["new"]);
  });

  it("rejects an empty name and an unchanged name", () => {
    const pages = pagesOf(page(A_ID, ["old"]));
    expect(planTagChange(pages, {}, { kind: "rename", from: "old", to: "   " }, NOW)).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(planTagChange(pages, {}, { kind: "rename", from: "old", to: "old" }, NOW)).toEqual({
      ok: false,
      reason: "same",
    });
  });

  it("updates tag names inside collection filters and board hidden lanes", () => {
    const coll = createPage({ title: "k", kind: "collection" });
    const collection = {
      ...coll.collection!,
      filters: [
        { field: "tags" as const, value: "old" },
        { field: "status" as const, value: "x" },
      ],
      board: { ...coll.collection!.board, groupBy: "tags" as const, hidden: ["tags:old"] },
    };
    const pages = pagesOf({ ...page(K_ID, []), kind: "collection", collection });
    const r = planTagChange(pages, {}, { kind: "rename", from: "old", to: "new" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const next = r.plan.pages[K_ID]!.collection!;
    expect(next.filters).toEqual([
      { field: "tags", value: "new" },
      { field: "status", value: "x" },
    ]);
    expect(next.board.hidden).toEqual(["tags:new"]);
    expect(r.plan.affected).toBe(0);
  });
});

describe("merge", () => {
  it("moves every source page to the target without duplicates and drops the source color", () => {
    const pages = pagesOf(
      page(A_ID, ["src", "t", "x"]),
      page(B_ID, ["src"]),
      page(C_ID, ["t"]),
      page(D_ID, ["x"]),
    );
    const colors = { src: "red", t: "blue" };
    const r = planTagChange(pages, colors, { kind: "merge", from: "src", into: "t" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.affected).toBe(2);
    expect(tagsAfter(pages, A_ID, r)).toEqual(["t", "x"]);
    expect(tagsAfter(pages, B_ID, r)).toEqual(["t"]);
    expect(r.plan.pages[C_ID]).toBeUndefined();
    expect(r.plan.colors).toEqual({ t: "blue" });
  });

  it("rejects merging into itself or into a missing tag", () => {
    const pages = pagesOf(page(A_ID, ["src"]));
    expect(planTagChange(pages, {}, { kind: "merge", from: "src", into: "src" }, NOW)).toEqual({
      ok: false,
      reason: "self",
    });
    expect(planTagChange(pages, {}, { kind: "merge", from: "src", into: "nope" }, NOW)).toEqual({
      ok: false,
      reason: "missing",
    });
  });
});

describe("recolor", () => {
  it("changes only the color map, not pages", () => {
    const pages = pagesOf(page(A_ID, ["x"]));
    const r = planTagChange(
      pages,
      { x: "red" },
      { kind: "recolor", name: "x", color: "green" },
      NOW,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.colors).toEqual({ x: "green" });
    expect(r.plan.pages).toEqual({});
    expect(r.plan.affected).toBe(0);
    expect(r.plan.undo.colors).toEqual({ x: "red" });
  });

  it("rejects an empty name", () => {
    expect(planTagChange({}, {}, { kind: "recolor", name: "", color: "red" }, NOW)).toEqual({
      ok: false,
      reason: "empty",
    });
  });
});

describe("delete", () => {
  it("removes the tag from every page (trash and templates too) and drops its color", () => {
    const pages = pagesOf(
      page(A_ID, ["x", "y"]),
      page(B_ID, ["x"], { trashedAt: OLD }),
      page(C_ID, ["y"]),
    );
    const r = planTagChange(pages, { x: "red", y: "blue" }, { kind: "delete", name: "x" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.affected).toBe(2);
    expect(tagsAfter(pages, A_ID, r)).toEqual(["y"]);
    expect(tagsAfter(pages, B_ID, r)).toEqual([]);
    expect(r.plan.colors).toEqual({ y: "blue" });
  });

  it("removes the tag from collection filters and board hidden lanes", () => {
    const coll = createPage({ title: "k", kind: "collection" });
    const collection = {
      ...coll.collection!,
      filters: [{ field: "tags" as const, value: "x" }],
      board: { ...coll.collection!.board, hidden: ["tags:x", "tags:y"] },
    };
    const pages = pagesOf({ ...page(K_ID, []), kind: "collection", collection });
    const r = planTagChange(pages, {}, { kind: "delete", name: "x" }, NOW);
    expect(r.ok && r.plan.pages[K_ID]!.collection).toMatchObject({
      filters: [],
      board: { hidden: ["tags:y"] },
    });
  });

  it("rejects an empty name", () => {
    expect(planTagChange({}, {}, { kind: "delete", name: "" }, NOW)).toEqual({
      ok: false,
      reason: "empty",
    });
  });
});

describe("undo", () => {
  it("restores tags, collection settings, updatedAt and colors exactly", () => {
    const coll = createPage({ title: "k", kind: "collection" });
    const collection = {
      ...coll.collection!,
      filters: [{ field: "tags" as const, value: "src" }],
      board: { ...coll.collection!.board, hidden: ["tags:src"] },
    };
    const pages = pagesOf(page(A_ID, ["src", "t"]), page(B_ID, ["src"]), {
      ...page(K_ID, []),
      kind: "collection",
      collection,
    });
    const colors = { src: "red" };
    const r = planTagChange(pages, colors, { kind: "merge", from: "src", into: "t" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const back = undoTagChange(r.plan.colors, r.plan.undo);
    // 페이지 값을 이전 값으로 되돌리면 원래 상태와 같다
    for (const [id, patch] of Object.entries(back.pages)) {
      expect({ ...pages[id]!, ...patch }).toEqual(pages[id]);
    }
    expect(back.colors).toEqual(colors);
  });

  it("removes a color that did not exist before the change", () => {
    const pages = pagesOf(page(A_ID, ["old"]));
    const r = planTagChange(pages, {}, { kind: "rename", from: "old", to: "new" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(undoTagChange(r.plan.colors, r.plan.undo).colors).toEqual({});
  });
});
