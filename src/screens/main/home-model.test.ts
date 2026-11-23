import { describe, expect, it } from "vitest";
import { greeting } from "./home-model";

describe("홈 인사 (SHELL-13)", () => {
  it("시간대마다 다르게", () => {
    expect([3, 5, 10, 11, 16, 17, 23].map(greeting)).toEqual([
      "늦은 밤이네요",
      "좋은 아침이에요",
      "좋은 아침이에요",
      "좋은 오후예요",
      "좋은 오후예요",
      "좋은 저녁이에요",
      "좋은 저녁이에요",
    ]);
  });
});
