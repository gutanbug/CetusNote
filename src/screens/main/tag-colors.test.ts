import { describe, expect, it } from "vitest";
import { nextTagColor, tagColor } from "./tag-colors";

describe("태그 색", () => {
  it("모르는 값은 회색, 새 태그는 회색을 빼고 차례로", () => {
    expect(tagColor("blue")).toBe("blue");
    expect(tagColor("#fff")).toBe("gray");
    expect(tagColor(undefined)).toBe("gray");
    expect(nextTagColor(0)).not.toBe("gray");
    expect(nextTagColor(8)).toBe(nextTagColor(0));
  });
});
