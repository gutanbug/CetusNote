import { describe, expect, it } from "vitest";
import { normalizeLanguage } from "./code-block";

describe("normalizeLanguage", () => {
  it("줄임말을 목록 이름으로 바꾼다", () => {
    expect(normalizeLanguage("ts")).toBe("typescript");
    expect(normalizeLanguage("PY")).toBe("python");
    expect(normalizeLanguage("yml")).toBe("yaml");
  });
  it("목록에 있는 이름은 그대로 둔다", () => {
    expect(normalizeLanguage("rust")).toBe("rust");
  });
  it("모르는 언어는 일반 텍스트, 빈 값은 자동 감지", () => {
    expect(normalizeLanguage("brainfuck")).toBe("plaintext");
    expect(normalizeLanguage(null)).toBe("auto");
  });
});
