import { describe, expect, it } from "vitest";
import { GRID_ROW_HEIGHT, gridRowRange } from "./grid-rows";

describe("CL-GridView 행 창 (SYS-11)", () => {
  it("행이 없으면 아무것도 그리지 않는다", () => {
    expect(gridRowRange({ top: 0, height: 600, offset: 0 }, 0)).toEqual({ first: 0, last: 0 });
  });

  it("높이를 아직 못 잰 때는 앞쪽 40행만 그린다", () => {
    expect(gridRowRange({ top: 0, height: 0, offset: 0 }, 10_000)).toEqual({ first: 0, last: 40 });
  });

  it("보이는 구간 위아래로 여유 8행을 더한다", () => {
    // 3600px 스크롤 = 100번째 행 맨 위, 360px 높이 = 10행
    expect(gridRowRange({ top: 3600, height: 360, offset: 0 }, 10_000)).toEqual({
      first: 92,
      last: 118,
    });
  });

  it("표가 스크롤 내용 안에서 내려가 있으면 그만큼 뺀다 (offset)", () => {
    expect(gridRowRange({ top: 3960, height: 360, offset: 360 }, 10_000)).toEqual({
      first: 92,
      last: 118,
    });
  });

  it("끝에서는 행 수를 넘지 않는다", () => {
    expect(gridRowRange({ top: 3600, height: 360, offset: 0 }, 105)).toEqual({
      first: 92,
      last: 105,
    });
  });

  it("어디로 스크롤해도 그리는 행은 보이는 행 + 여유 16행을 넘지 않는다", () => {
    const height = 900;
    const cap = Math.ceil(height / GRID_ROW_HEIGHT) + 1 + 16;
    for (let top = 0; top < 360_000; top += 1234) {
      const { first, last } = gridRowRange({ top, height, offset: 0 }, 10_000);
      expect(last - first).toBeLessThanOrEqual(cap);
      expect(first).toBeLessThanOrEqual(Math.floor(top / GRID_ROW_HEIGHT));
    }
  });
});
