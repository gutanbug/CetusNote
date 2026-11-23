import { describe, expect, it } from "vitest";
import { pageTextFromItems } from "./pdf-js";

describe("pageTextFromItems", () => {
  it("hasEOL마다 줄을 바꾸고 조각을 이어 붙인다", () => {
    const items = [
      { str: "첫 줄", hasEOL: true },
      { str: "이어진 ", hasEOL: false },
      { str: "글", hasEOL: true },
      { str: "둘째 줄", hasEOL: true },
    ];
    expect(pageTextFromItems(items)).toBe("첫 줄\n이어진 글\n둘째 줄");
  });

  it("줄 앞뒤 공백을 떼고 빈 줄은 한 줄로 줄인다", () => {
    const items = [
      { str: "  가  ", hasEOL: true },
      { str: "", hasEOL: true },
      { str: "", hasEOL: true },
      { str: "나", hasEOL: true },
    ];
    expect(pageTextFromItems(items)).toBe("가\n\n나");
  });

  it("조각이 없으면 빈 글", () => {
    expect(pageTextFromItems([])).toBe("");
  });
});
