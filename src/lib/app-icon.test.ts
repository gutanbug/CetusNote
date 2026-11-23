import { describe, expect, it } from "vitest";
import { parseAppIconPref, resolveAppIcon } from "./app-icon";

describe("앱 아이콘 고르기 (SET-07)", () => {
  it("자동이면 지금 테마를 따른다", () => {
    expect(resolveAppIcon("auto", "light")).toBe("light");
    expect(resolveAppIcon("auto", "dark")).toBe("dark");
  });

  it("화이트·블랙을 고르면 테마와 상관없이 그 아이콘을 쓴다", () => {
    expect(resolveAppIcon("light", "dark")).toBe("light");
    expect(resolveAppIcon("dark", "light")).toBe("dark");
  });

  it("설정 값이 이상하면 자동으로 읽는다", () => {
    expect(parseAppIconPref("dark")).toBe("dark");
    expect(parseAppIconPref("light")).toBe("light");
    expect(parseAppIconPref("auto")).toBe("auto");
    expect(parseAppIconPref("blue")).toBe("auto");
    expect(parseAppIconPref(undefined)).toBe("auto");
    expect(parseAppIconPref(null)).toBe("auto");
  });
});
