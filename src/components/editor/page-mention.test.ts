import { describe, expect, it } from "vitest";
import { pageIdOfHref } from "./page-mention";

describe("pageIdOfHref (SHELL-19 ⌥⌘↵)", () => {
  it("페이지 링크 주소에서 id를 꺼낸다", () => {
    expect(pageIdOfHref("cetusnote://page/abc-123")).toBe("abc-123");
  });
  it("페이지 링크가 아니면 null", () => {
    expect(pageIdOfHref("https://example.com")).toBeNull();
    expect(pageIdOfHref(undefined)).toBeNull();
    expect(pageIdOfHref(null)).toBeNull();
  });
});
