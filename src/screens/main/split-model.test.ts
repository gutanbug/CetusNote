import { describe, expect, it } from "vitest";
import {
  canSplit,
  clampPaneWidth,
  closePane,
  isPaneable,
  MAIN_MIN,
  openInPane,
  PANE_MIN,
  PANE_STEP,
  paneMax,
  resetPane,
  resizePane,
  SPLIT_MIN_AREA,
  swapSides,
} from "./split-model";
import { readSplit } from "@/features/session/split-state";

const none = { pageId: null, width: null };

describe("분할 화면 상태 전이 (SHELL-19)", () => {
  it("패널이 비었을 때 다른 페이지를 열면 패널에 올라가고 포커스는 패널", () => {
    const r = openInPane("A", none, "B");
    expect(r).toEqual({ main: "A", split: { pageId: "B", width: null }, focus: "pane" });
  });

  it("패널을 열 때 폭은 그대로 둔다", () => {
    const r = openInPane("A", { pageId: "B", width: 400 }, "C");
    expect(r.split).toEqual({ pageId: "C", width: 400 });
  });

  it("주 화면과 같은 페이지를 열면 중복 없이 주 화면에 포커스만", () => {
    const state = { pageId: "B", width: 400 };
    const r = openInPane("A", state, "A");
    expect(r).toEqual({ main: "A", split: state, focus: "main" });
  });

  it("맞바꾸기는 두 쪽을 바꾸고 폭을 유지한다", () => {
    expect(swapSides("A", { pageId: "B", width: 350 })).toEqual({
      main: "B",
      split: { pageId: "A", width: 350 },
    });
  });

  it("패널이 비었으면 맞바꾸기는 아무것도 바꾸지 않는다", () => {
    expect(swapSides("A", none)).toEqual({ main: "A", split: none });
  });

  it("닫아도 폭은 기억한다", () => {
    expect(closePane({ pageId: "B", width: 500 })).toEqual({ pageId: null, width: 500 });
  });

  it("기본 폭은 절반, 드래그로 정한 폭은 영역 안으로 맞춘다", () => {
    expect(clampPaneWidth(null, 1000)).toBe(500);
    expect(clampPaneWidth(100, 1000)).toBe(PANE_MIN);
    expect(clampPaneWidth(990, 1000)).toBe(paneMax(1000));
    expect(clampPaneWidth(Number.NaN, 1000)).toBe(500);
  });

  it("상한은 영역의 60%와 주 화면 최소 폭 중 작은 값", () => {
    expect(paneMax(1000)).toBe(600);
    expect(paneMax(800)).toBe(800 - MAIN_MIN);
    expect(paneMax(600)).toBe(PANE_MIN);
  });

  it("키보드로 한 칸 움직이고 두 번 누르면 기본 폭", () => {
    const s = resizePane({ pageId: "B", width: 400 }, 400 + PANE_STEP, 1000);
    expect(s.width).toBe(416);
    expect(resetPane(s).width).toBeNull();
  });

  it("좁은 창에서는 분할을 보이지 않는다", () => {
    expect(canSplit(SPLIT_MIN_AREA - 1)).toBe(false);
    expect(canSplit(SPLIT_MIN_AREA)).toBe(true);
  });

  it("패널에는 문서만 올린다(컬렉션·폴더·템플릿 제외)", () => {
    expect(isPaneable("page")).toBe(true);
    expect(isPaneable("collection")).toBe(false);
    expect(isPaneable("folder")).toBe(false);
    expect(isPaneable("page", true)).toBe(false);
  });

  it("저장값은 잘못된 모양을 버린다", () => {
    expect(readSplit(undefined)).toEqual(none);
    expect(readSplit("x")).toEqual(none);
    expect(readSplit({ pageId: 3, width: "x" })).toEqual(none);
    expect(readSplit({ pageId: "", width: Number.POSITIVE_INFINITY })).toEqual(none);
    expect(readSplit({ pageId: "B", width: 420 })).toEqual({ pageId: "B", width: 420 });
  });
});
