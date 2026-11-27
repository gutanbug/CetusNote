import { afterEach, describe, expect, it } from "vitest";
import {
  getLocale,
  msg,
  onLocaleChange,
  parseLanguagePref,
  resolveLocale,
  setLocale,
  systemLocale,
} from ".";

afterEach(() => setLocale("ko"));

describe("언어 고르기 (SYS-14)", () => {
  it("시스템 언어는 지원하는 첫 언어, 없으면 영어", () => {
    expect(systemLocale(["ko-KR", "en-US"])).toBe("ko");
    expect(systemLocale(["ja-JP", "en-GB"])).toBe("en");
    expect(systemLocale(["ja-JP"])).toBe("en");
    expect(systemLocale([])).toBe("en");
  });
  it("설정 값 읽기와 풀기", () => {
    expect(parseLanguagePref("en")).toBe("en");
    expect(parseLanguagePref("fr")).toBe("system");
    expect(resolveLocale("system", ["ko"])).toBe("ko");
    expect(resolveLocale("en", ["ko"])).toBe("en");
  });
  it("언어를 바꾸면 문구와 <html lang>이 바뀌고 구독자에게 알린다", () => {
    let calls = 0;
    const off = onLocaleChange(() => calls++);
    setLocale("en");
    expect(getLocale()).toBe("en");
    expect(msg().settings.general.language).toBe("Language");
    setLocale("en");
    expect(calls).toBe(1);
    off();
    setLocale("ko");
    expect(msg().settings.general.language).toBe("언어");
  });
});
