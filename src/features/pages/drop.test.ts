import { createPage, type Page } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { planDrop } from "./drop";
import { buildPageTree } from "./tree";

/** 업무(폴더) ┬ 회의록(문서) ─ 안건(문서)
 *            └ 주간 리뷰(문서)
 *  메모(문서) */
function sample() {
  const work = createPage({ kind: "folder", title: "업무" });
  const meeting = createPage({ title: "회의록", parentId: work.id });
  const agenda = createPage({ title: "안건", parentId: meeting.id });
  const weekly = createPage({ title: "주간 리뷰", parentId: work.id });
  const memo = createPage({ title: "메모" });
  const all = [work, meeting, agenda, weekly, memo];
  const pages: Record<string, Page> = Object.fromEntries(all.map((p) => [p.id, p]));
  const order = { root: [work.id, memo.id], [work.id]: [meeting.id, weekly.id] };
  const tree = buildPageTree(all, order);
  const plan = (id: string, target: string, pos: "before" | "after" | "inside") =>
    planDrop(pages, tree, id, target, pos);
  return { work, meeting, agenda, weekly, memo, plan };
}

describe("트리 끌어다 놓기 (SHELL-06)", () => {
  it("형제 사이 순서 바꾸기", () => {
    const { work, meeting, weekly, plan } = sample();
    expect(plan(weekly.id, meeting.id, "before")).toEqual({
      parentId: work.id,
      ids: [weekly.id, meeting.id],
    });
  });

  it("다른 부모로: 위·아래면 대상의 형제, 안쪽이면 맨 끝 하위", () => {
    const { work, meeting, memo, agenda, weekly, plan } = sample();
    expect(plan(memo.id, meeting.id, "after")).toEqual({
      parentId: work.id,
      ids: [meeting.id, memo.id, weekly.id],
    });
    expect(plan(memo.id, meeting.id, "inside")).toEqual({
      parentId: meeting.id,
      ids: [agenda.id, memo.id],
    });
    expect(plan(agenda.id, work.id, "before")).toEqual({
      parentId: null,
      ids: [agenda.id, work.id, memo.id],
    });
  });

  it("놓을 수 없는 곳: 자기 자신·하위, 제자리 (문서 안 폴더는 된다)", () => {
    const { work, meeting, agenda, weekly, memo, plan } = sample();
    expect(plan(meeting.id, meeting.id, "inside")).toBeNull();
    expect(plan(meeting.id, agenda.id, "after")).toBeNull();
    expect(plan(work.id, memo.id, "inside")).toEqual({ parentId: memo.id, ids: [work.id] });
    expect(plan(work.id, agenda.id, "before")).toBeNull();
    expect(plan(meeting.id, weekly.id, "before")).toBeNull();
    expect(plan(weekly.id, work.id, "inside")).toBeNull();
    // 폴더는 최상위 사이에서는 움직일 수 있다
    expect(plan(work.id, memo.id, "after")).toEqual({ parentId: null, ids: [memo.id, work.id] });
  });

  it("컬렉션 안에는 문서만 놓는다 (COLL-01)", () => {
    const folder = createPage({ kind: "folder", title: "업무" });
    const coll = createPage({ kind: "collection", title: "작업" });
    const doc = createPage({ title: "메모" });
    const all = [folder, coll, doc];
    const pages: Record<string, Page> = Object.fromEntries(all.map((p) => [p.id, p]));
    const tree = buildPageTree(all, { root: [folder.id, coll.id, doc.id] });
    expect(planDrop(pages, tree, folder.id, coll.id, "inside")).toBeNull();
    expect(planDrop(pages, tree, doc.id, coll.id, "inside")).toEqual({
      parentId: coll.id,
      ids: [doc.id],
    });
  });
});
