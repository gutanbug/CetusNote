import { describe, expect, it } from "vitest";
import { clampPinned, isPinEdgeIndex, isPinnedIndex, stickyLeft } from "./grid-pin";

describe("CL-GridView 고정 칸 계산 (COLL-02)", () => {
  it("고정 칸 수는 보이는 속성 칸 수 안의 0 이상 정수", () => {
    expect(clampPinned(0, 4)).toBe(0);
    expect(clampPinned(2, 4)).toBe(2);
    expect(clampPinned(9, 4)).toBe(4);
    expect(clampPinned(-3, 4)).toBe(0);
    expect(clampPinned(1.7, 4)).toBe(1);
    expect(clampPinned(Number.NaN, 4)).toBe(0);
  });

  it("제목(색인 0)은 늘 고정이고, 고정 칸 수만큼 앞 속성 칸이 고정이다", () => {
    expect(isPinnedIndex(0, 0)).toBe(true);
    expect(isPinnedIndex(1, 0)).toBe(false);
    expect(isPinnedIndex(2, 2)).toBe(true);
    expect(isPinnedIndex(3, 2)).toBe(false);
  });

  it("가로 스크롤 구분선은 마지막 고정 칸에만 긋는다 (고정이 없으면 제목)", () => {
    expect(isPinEdgeIndex(0, 0)).toBe(true);
    expect(isPinEdgeIndex(0, 2)).toBe(false);
    expect(isPinEdgeIndex(1, 2)).toBe(false);
    expect(isPinEdgeIndex(2, 2)).toBe(true);
  });

  it("sticky left는 앞 칸 너비의 합이라 고정 칸이 차곡차곡 쌓이고, 너비가 바뀌면 따라간다", () => {
    const widths = [320, 160, 240, 160];
    expect([0, 1, 2, 3].map((i) => stickyLeft(widths, i))).toEqual([0, 320, 480, 720]);
    expect(stickyLeft([320, 96, 160], 1)).toBe(320);
    expect(stickyLeft(widths, 9)).toBe(880);
  });
});
