import { metaStore } from "@/features/meta";
import { pagesStore } from "@/features/pages";
import { getStorage } from "@/lib/storage/default";
import { beforeAll, describe, expect, it } from "vitest";
import { sessionStore } from "@/features/session";
import {
  createIn,
  duplicatePage,
  moveTargets,
  movePage,
  promoteQuickNote,
  setBodyWidth,
} from "./actions";

beforeAll(async () => {
  await getStorage().openDefaultWorkspace();
  await pagesStore.getState().load();
  await metaStore.getState().load();
});

describe("페이지 동작 (PAGE-05)", () => {
  it("복제는 원본 바로 아래, 내용·속성은 복사하고 하위는 복사하지 않는다", () => {
    const { create, update } = pagesStore.getState();
    const a = create({ title: "가" });
    const b = create({ title: "나" });
    create({ title: "가의 하위", parentId: a.id });
    update(a.id, {
      props: {
        tags: ["회의"],
        status: "진행 중",
        assignee: null,
        start: null,
        due: null,
        values: { fabcd1234: "메모" },
      },
    });
    const copy = duplicatePage(a.id)!;
    expect(copy.title).toBe("가 사본");
    expect(pagesStore.getState().pages[copy.id]!.props).toEqual({
      tags: ["회의"],
      status: "진행 중",
      assignee: null,
      start: null,
      due: null,
      values: { fabcd1234: "메모" },
    });
    const root = metaStore.getState().meta!.order.root!;
    expect(root.indexOf(copy.id)).toBe(root.indexOf(a.id) + 1);
    expect(root.indexOf(b.id)).toBeGreaterThan(root.indexOf(copy.id));
    const kids = Object.values(pagesStore.getState().pages).filter((p) => p.parentId === copy.id);
    expect(kids).toHaveLength(0);
  });

  it("옮길 곳: 폴더는 컬렉션 아래로 못 가고, 자기·하위·지금 부모는 빠진다", () => {
    const { create } = pagesStore.getState();
    const folder = create({ kind: "folder", title: "업무" });
    const doc = create({ title: "로드맵", parentId: folder.id });
    const child = create({ title: "세부", parentId: doc.id });
    const other = create({ kind: "folder", title: "공부" });
    const coll = create({ kind: "collection", title: "작업" });
    const forFolder = moveTargets(other.id).map((t) => t?.id ?? null);
    expect(forFolder).toContain(folder.id);
    expect(forFolder).toContain(doc.id);
    expect(forFolder).not.toContain(coll.id);
    const forDoc = moveTargets(doc.id).map((t) => t?.id ?? null);
    expect(forDoc).toContain(null);
    expect(forDoc).not.toContain(folder.id); // 지금 부모
    expect(forDoc).not.toContain(child.id); // 하위
    expect(forDoc).not.toContain(doc.id);
    movePage(doc.id, other.id);
    expect(pagesStore.getState().pages[doc.id]!.parentId).toBe(other.id);
  });
});

describe("빠른 메모 → 페이지 (QN-02)", () => {
  it("첫 줄은 제목, 나머지 줄은 문단(빈 줄은 뺀다). 메모는 목록에서 빠진다", async () => {
    await metaStore.getState().addQuickNote("다음 회의 안건\n배포 일정\n\n디자인 리뷰");
    const notes = metaStore.getState().meta!.quickNotes;
    const note = notes[notes.length - 1]!;
    const page = promoteQuickNote(note.id)!;
    expect(page.title).toBe("다음 회의 안건");
    expect(page.icon).toBe("🗒️");
    expect(page.parentId).toBeNull();
    type Block = { content?: { text?: string }[] };
    const blocks = (page.content.content ?? []) as Block[];
    const texts = blocks.map((b) => b.content?.[0]?.text);
    expect(texts).toEqual(["배포 일정", "디자인 리뷰"]);
    expect(metaStore.getState().meta!.quickNotes.some((n) => n.id === note.id)).toBe(false);
  });

  it("첫 줄이 길면 제목은 60자로 자르고 첫 줄 전체는 본문에 남긴다", async () => {
    const long = "가".repeat(80);
    await metaStore.getState().addQuickNote(long);
    const notes = metaStore.getState().meta!.quickNotes;
    const page = promoteQuickNote(notes[notes.length - 1]!.id)!;
    expect(page.title).toHaveLength(60);
    const first = (page.content.content ?? [])[0] as { content?: { text?: string }[] };
    expect(first.content?.[0]?.text).toBe(long);
  });
});

describe("새 페이지 기본값 (SET-03, SET-04)", () => {
  it("글꼴만 새 문서에 적용하고, 본문 폭은 굳히지 않고 상속한다", () => {
    sessionStore.getState().setAppearance({ defaultWide: true });
    sessionStore.getState().setEditor({ newPageFont: "serif" });
    const page = createIn(null);
    expect(pagesStore.getState().pages[page.id]!.layout).toEqual({ font: "serif" });
    const folder = createIn(null, "folder");
    expect(pagesStore.getState().pages[folder.id]!.layout).toEqual({ font: "default" });
    sessionStore.getState().setAppearance({ defaultWide: false });
    sessionStore.getState().setEditor({ newPageFont: "default" });
  });

  it("setBodyWidth는 명시 값을 넣고 undefined면 상속으로 되돌린다", () => {
    const page = createIn(null);
    setBodyWidth(page.id, "wide");
    expect(pagesStore.getState().pages[page.id]!.layout.width).toBe("wide");
    setBodyWidth(page.id, undefined);
    expect(pagesStore.getState().pages[page.id]!.layout).toEqual({ font: "default" });
  });
});
