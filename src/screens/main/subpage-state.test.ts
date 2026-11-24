import { metaStore } from "@/features/meta";
import { pagesStore } from "@/features/pages";
import { sessionStore } from "@/features/session";
import { getStorage } from "@/lib/storage/default";
import { beforeAll, describe, expect, it } from "vitest";
import { createSubpageOf, crumbsOf } from "./actions";
import { subpageRefOf } from "./page-editing";

beforeAll(async () => {
  await getStorage().openDefaultWorkspace();
  await pagesStore.getState().load();
  await metaStore.getState().load();
});

const structure = () => pagesStore.getState().structure;

describe("하위 페이지 (EDIT-29) 저장·상태", () => {
  it("하위 페이지는 부모 아래에 만들고, 열지는 않는다 (사이드바 ＋와 같은 저장 경로)", () => {
    const parent = pagesStore.getState().create({ title: "상위 생성" });
    const before = sessionStore.getState().activeId;
    const child = createSubpageOf(parent.id);
    expect(child.parentId).toBe(parent.id);
    expect(structure()[child.id]?.parentId).toBe(parent.id);
    expect(sessionStore.getState().activeId).toBe(before);
  });

  it("블록 상태는 이름·휴지통·지움 변화를 따라간다", async () => {
    const parent = pagesStore.getState().create({ title: "상위 상태" });
    const child = createSubpageOf(parent.id);
    const { update, trash, restore, purge } = pagesStore.getState();

    update(child.id, { title: "하위 A" });
    expect(subpageRefOf(structure(), child.id)).toMatchObject({
      title: "하위 A",
      exists: true,
      trashed: false,
    });

    update(child.id, { title: "하위 B" });
    expect(subpageRefOf(structure(), child.id).title).toBe("하위 B");

    trash(child.id);
    expect(subpageRefOf(structure(), child.id)).toMatchObject({ exists: true, trashed: true });
    restore(child.id);
    expect(subpageRefOf(structure(), child.id).trashed).toBe(false);

    // 부모가 휴지통에 가면 하위 페이지도 열 수 없다
    trash(parent.id);
    expect(subpageRefOf(structure(), child.id).trashed).toBe(true);
    restore(parent.id);
    expect(subpageRefOf(structure(), child.id).trashed).toBe(false);

    // 영구 삭제는 휴지통에 있는 페이지만 된다
    trash(child.id);
    await purge(child.id);
    expect(subpageRefOf(structure(), child.id)).toMatchObject({ exists: false, trashed: false });
  });
});

describe("경로 표시 (EDIT-30) 경로", () => {
  it("맨 위 → 현재 페이지 순서로 폴더·상위 페이지를 모두 넣는다", () => {
    const folder = pagesStore.getState().create({ kind: "folder", title: "폴더 경로" });
    const a = pagesStore.getState().create({ title: "A 경로", parentId: folder.id });
    const b = pagesStore.getState().create({ title: "B 경로", parentId: a.id });
    expect(crumbsOf(b.id, structure()).map((c) => c.title)).toEqual([
      "폴더 경로",
      "A 경로",
      "B 경로",
    ]);
  });

  it("없는 페이지는 빈 경로", () => {
    expect(crumbsOf("no-such-page", structure())).toEqual([]);
  });
});
