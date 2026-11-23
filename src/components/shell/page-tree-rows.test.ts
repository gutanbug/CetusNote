import { describe, expect, it } from "vitest";
import type { PageNode } from "./page-tree";
import { ROW_HEIGHT, flattenRows, windowRange } from "./page-tree-rows";

const leaf = (id: string): PageNode => ({ id, title: id });

const tree: PageNode[] = [
  {
    id: "a",
    title: "a",
    kind: "folder",
    children: [leaf("a1"), { id: "a2", title: "a2", children: [leaf("a2x"), leaf("a2y")] }],
  },
  leaf("b"),
];

describe("flattenRows", () => {
  it("접힌 하위는 목록에 넣지 않는다", () => {
    const rows = flattenRows(tree, new Set());
    expect(rows.map((r) => r.node.id)).toEqual(["a", "b"]);
    expect(rows[0]).toMatchObject({ hasKids: true, isOpen: false, level: 1 });
  });

  it("펼친 행 바로 다음이 첫 하위이고 깊이 우선 순서다", () => {
    const rows = flattenRows(tree, new Set(["a", "a2"]));
    expect(rows.map((r) => r.node.id)).toEqual(["a", "a1", "a2", "a2x", "a2y", "b"]);
  });

  it("aria-level, setsize, posinset, parentId를 맞춘다", () => {
    const rows = flattenRows(tree, new Set(["a", "a2"]));
    const byId = Object.fromEntries(rows.map((r) => [r.node.id, r]));
    expect(byId.a1).toMatchObject({ level: 2, parentId: "a", setSize: 2, posInSet: 1 });
    expect(byId.a2).toMatchObject({
      level: 2,
      parentId: "a",
      setSize: 2,
      posInSet: 2,
      isOpen: true,
    });
    expect(byId.a2y).toMatchObject({ level: 3, parentId: "a2", setSize: 2, posInSet: 2 });
    expect(byId.b).toMatchObject({ level: 1, parentId: undefined, setSize: 2, posInSet: 2 });
  });

  it("펼침 상태가 없는 행은 isOpen이 false다", () => {
    const rows = flattenRows(tree, new Set(["a2"]));
    expect(rows.find((r) => r.node.id === "a")?.isOpen).toBe(false);
    expect(rows.length).toBe(2);
  });

  it("5000개 페이지도 빠르게 펼친다 (100폴더 × 50문서, 모두 펼침)", () => {
    const folders: PageNode[] = Array.from({ length: 100 }, (_, f) => ({
      id: `f${f}`,
      title: `폴더 ${f}`,
      kind: "folder",
      children: Array.from({ length: 49 }, (_, i) => leaf(`f${f}-${i}`)),
    }));
    const all = [...folders, ...Array.from({ length: 100 }, (_, i) => leaf(`r${i}`))];
    const expanded = new Set(folders.map((f) => f.id));
    const start = performance.now();
    const rows = flattenRows(all, expanded);
    expect(rows.length).toBe(100 + 100 * 49 + 100);
    expect(performance.now() - start).toBeLessThan(50);
  });
});

describe("windowRange", () => {
  it("보이는 구간과 위아래 여유 행을 준다", () => {
    // 300px 높이 = 10행, 스크롤 0 → 0..(10 + overscan 8) 행
    expect(windowRange(0, 10 * ROW_HEIGHT, 5000)).toEqual({ first: 0, last: 18 });
    // 1000행 아래로 스크롤
    expect(windowRange(1000 * ROW_HEIGHT, 10 * ROW_HEIGHT, 5000)).toEqual({
      first: 992,
      last: 1018,
    });
  });

  it("끝을 넘지 않는다", () => {
    expect(windowRange(4990 * ROW_HEIGHT, 1000, 5000).last).toBe(5000);
    expect(windowRange(0, 1000, 3)).toEqual({ first: 0, last: 3 });
    expect(windowRange(0, 0, 0)).toEqual({ first: 0, last: 0 });
  });

  it("높이를 아직 잴 수 없으면 처음 40행만 그린다", () => {
    expect(windowRange(0, 0, 5000)).toEqual({ first: 0, last: 40 });
  });
});
