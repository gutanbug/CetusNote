import { createPage, type Page } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { buildPageTree } from "./tree";

let t = 0;
const make = (init: Parameters<typeof createPage>[0] & { trashed?: boolean }): Page => {
  const { trashed, ...rest } = init;
  const at = `2026-11-19T10:00:${String(t++).padStart(2, "0")}.000Z`;
  return { ...createPage(rest), createdAt: at, trashedAt: trashed ? at : null };
};
const shape = (nodes: ReturnType<typeof buildPageTree>): unknown =>
  nodes.map((n) => (n.children ? [n.title, shape(n.children)] : n.title));

describe("buildPageTree (SHELL-05, SHELL-14)", () => {
  it("폴더를 먼저, 그다음 만든 순. 폴더 안에 폴더·문서, 문서 안에 문서", () => {
    const work = make({ kind: "folder", title: "업무" });
    const memo = make({ title: "메모" });
    const sub = make({ kind: "folder", title: "회의", parentId: work.id });
    const doc = make({ title: "로드맵", parentId: work.id });
    const child = make({ title: "로드맵 부록", parentId: doc.id });
    const tree = buildPageTree([memo, doc, child, sub, work]);
    expect(shape(tree)).toEqual([["업무", ["회의", ["로드맵", ["로드맵 부록"]]]], "메모"]);
    expect(tree[0]!.kind).toBe("folder");
  });

  it("workspace.json의 순서를 먼저 따른다", () => {
    const a = make({ title: "a" });
    const b = make({ title: "b" });
    const f = make({ kind: "folder", title: "f" });
    expect(shape(buildPageTree([a, b, f], { root: [b.id, a.id] }))).toEqual(["b", "a", "f"]);
  });

  it("휴지통 페이지와 그 하위는 빼고, 규칙에 어긋난 부모·없는 부모·고리는 루트로", () => {
    const doc = make({ kind: "collection", title: "문서" });
    const badFolder = make({ kind: "folder", title: "컬렉션 아래 폴더", parentId: doc.id });
    const orphan = make({ title: "부모 없음", parentId: make({ title: "x" }).id });
    const gone = make({ title: "지운 것", trashed: true });
    const underGone = make({ title: "지운 것 아래", parentId: gone.id });
    const c1 = make({ title: "고리1" });
    const c2 = { ...make({ title: "고리2" }), parentId: c1.id };
    const c1loop = { ...c1, parentId: c2.id };
    const titles = (
      shape(buildPageTree([doc, badFolder, orphan, gone, underGone, c1loop, c2])) as unknown[]
    ).flat(3);
    expect(titles).toContain("컬렉션 아래 폴더");
    expect(titles).toContain("부모 없음");
    expect(titles).not.toContain("지운 것");
    expect(titles).not.toContain("지운 것 아래");
    expect(titles).toContain("고리1");
    expect(titles).toContain("고리2");
  });
});

describe("문서 아래 폴더 (SHELL-14)", () => {
  it("문서 안에 폴더가 들어가고, 폴더 안에 문서가 든다", () => {
    const doc = make({ title: "로드맵" });
    const folder = make({ kind: "folder", title: "자료", parentId: doc.id });
    const pic = make({ title: "그림", parentId: folder.id });
    expect(shape(buildPageTree([doc, folder, pic]))).toEqual([["로드맵", [["자료", ["그림"]]]]]);
  });
});
