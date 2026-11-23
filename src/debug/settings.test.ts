import { describe, expect, it } from "vitest";
import { DEFAULTS, parseSettings, serializeSettings } from "./settings";

describe("Debug 설정 ↔ URL 해시", () => {
  it("빈 해시는 기본값", () => {
    expect(parseSettings("#/debug")).toEqual(DEFAULTS);
  });

  it("왕복해도 같은 설정", () => {
    const s = { ...DEFAULTS, theme: "dark", accent: "teal", grid: true, q: "버튼" } as const;
    expect(parseSettings(serializeSettings(s))).toEqual(s);
  });

  it("기본값은 쿼리에 남기지 않는다", () => {
    expect(serializeSettings(DEFAULTS)).toBe("#/debug");
  });

  it("알 수 없는 값은 기본값으로", () => {
    expect(parseSettings("#/debug?theme=sepia&accent=neon").theme).toBe(DEFAULTS.theme);
  });
});
