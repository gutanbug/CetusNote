import { describe, expect, it } from "vitest";
import { CONTENT_HEIGHT, planPages } from "./pdf-layout";

const box = (top: number, height: number) => ({ top, bottom: top + height });

describe("planPages (DATA-06 쪽 나누기)", () => {
  it("블록이 없으면 쪽도 없다", () => {
    expect(planPages([])).toEqual([]);
  });

  it("한 쪽에 들어가는 블록은 한 쪽에 모은다", () => {
    const pages = planPages([box(0, 100), box(120, 100), box(240, 100)], 500);
    expect(pages).toEqual([{ start: 0, end: 340, blocks: [0, 1, 2] }]);
  });

  it("넘치는 블록은 다음 쪽으로 넘기고 블록 중간에서 자르지 않는다", () => {
    const pages = planPages([box(0, 300), box(310, 300), box(620, 300)], 500);
    expect(pages.map((p) => p.blocks)).toEqual([[0], [1], [2]]);
    expect(pages[1]).toEqual({ start: 310, end: 610, blocks: [1] });
  });

  it("쪽 높이보다 큰 블록은 혼자 한 쪽에 둔다", () => {
    const pages = planPages([box(0, 100), box(110, 900), box(1020, 50)], 500);
    expect(pages.map((p) => p.blocks)).toEqual([[0], [1], [2]]);
  });

  it("기본 쪽 높이는 A4에서 위아래 여백을 뺀 값이다", () => {
    expect(CONTENT_HEIGHT).toBeCloseTo(841.89 - 2 * 51);
  });
});
