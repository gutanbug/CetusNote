import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("조건부 클래스를 합친다", () => {
    const hidden = false;
    expect(cn("px-2", hidden && "hidden", "py-1")).toBe("px-2 py-1");
  });

  it("충돌하는 Tailwind 클래스는 뒤의 것이 이긴다", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("토큰 글자 크기와 글자 색을 서로 다른 그룹으로 본다", () => {
    expect(cn("text-accent-on", "text-ui")).toBe("text-accent-on text-ui");
    expect(cn("text-ui", "text-caption")).toBe("text-caption");
  });

  it("토큰 그림자끼리는 뒤의 것이 이긴다", () => {
    expect(cn("shadow-popover", "shadow-modal")).toBe("shadow-modal");
  });
});
