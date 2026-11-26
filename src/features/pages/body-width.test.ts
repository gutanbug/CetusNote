import { describe, expect, it } from "vitest";
import {
  inheritedBodyWidth,
  layoutWithWidth,
  resolveBodyWidth,
  type WidthNode,
} from "./body-width";

const node = (
  parentId: string | null,
  width?: "default" | "wide",
  kind: WidthNode["kind"] = "page",
): WidthNode => ({ parentId, kind, layout: { width } });

describe("본문 폭 해석 (PAGE-05 · SHELL-14 · SET-03)", () => {
  it("페이지 자신의 값이 가장 우선한다", () => {
    const all = { f: node(null, "wide", "folder"), p: node("f", "default") };
    expect(resolveBodyWidth("p", all, true)).toEqual({ width: "default", from: "page" });
  });

  it("값이 없으면 가까운 상위 폴더를 따른다", () => {
    const all = { f: node(null, "wide", "folder"), p: node("f") };
    expect(resolveBodyWidth("p", all, false)).toEqual({ width: "wide", from: "folder" });
  });

  it("중첩 폴더는 가장 가까운 값을 쓰고, 값이 없는 폴더는 건너뛴다", () => {
    const all = {
      outer: node(null, "wide", "folder"),
      inner: node("outer", "default", "folder"),
      mid: node("inner", undefined, "folder"),
      p: node("mid"),
    };
    expect(resolveBodyWidth("p", all, true)).toEqual({ width: "default", from: "folder" });
    expect(inheritedBodyWidth("mid", all, false)).toEqual({ width: "default", from: "folder" });
  });

  it("상위에 값이 없으면 전체 설정을 따른다", () => {
    const all = { f: node(null, undefined, "folder"), p: node("f") };
    expect(resolveBodyWidth("p", all, true)).toEqual({ width: "wide", from: "global" });
    expect(resolveBodyWidth("p", all, false)).toEqual({ width: "default", from: "global" });
  });

  it("컬렉션은 폭을 갖지 않으니 건너뛰고 그 위 폴더를 본다", () => {
    const all = {
      f: node(null, "wide", "folder"),
      c: node("f", "default", "collection"),
      r: node("c"),
    };
    expect(resolveBodyWidth("r", all, false)).toEqual({ width: "wide", from: "folder" });
  });

  it("페이지를 다른 폴더로 옮기면 결과가 바뀐다", () => {
    const all: Record<string, WidthNode> = {
      a: node(null, "wide", "folder"),
      b: node(null, "default", "folder"),
      p: node("a"),
    };
    expect(resolveBodyWidth("p", all, false).width).toBe("wide");
    all.p = node("b");
    expect(resolveBodyWidth("p", all, false).width).toBe("default");
  });

  it("부모 순환이 있어도 멈춘다", () => {
    const all = { a: node("b"), b: node("a") };
    expect(resolveBodyWidth("a", all, true)).toEqual({ width: "wide", from: "global" });
  });
});

describe("레이아웃 값 쓰기", () => {
  it("폭을 정하면 넣고, undefined면 키를 없앤다", () => {
    expect(layoutWithWidth({ font: "serif" }, "wide")).toEqual({ width: "wide", font: "serif" });
    expect(layoutWithWidth({ width: "wide", font: "serif" }, undefined)).toEqual({ font: "serif" });
  });
});
