import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "@/lib/i18n";
import {
  matchShortcodes,
  nextActiveIndex,
  normalizeShortcodeQuery,
  SHORTCODES,
} from "./shortcodes";

describe("이모지 단축 코드", () => {
  it("콜론과 대소문자를 맞추고, 허용하지 않는 글자는 목록을 띄우지 않는다", () => {
    expect(normalizeShortcodeQuery(":Smi")).toBe("smi");
    expect(normalizeShortcodeQuery("ok_")).toBe("ok_");
    expect(normalizeShortcodeQuery("smi le")).toBeNull();
    expect(normalizeShortcodeQuery("웃")).toBeNull();
  });

  it("앞부분이 맞는 것이 먼저 오고, 가운데 포함은 뒤에 온다", () => {
    const codes = matchShortcodes("s").map((s) => s.code);
    expect(codes.slice(0, 3)).toEqual(["smile", "sunglasses", "sob"]);
    expect(matchShortcodes("bul")[0].code).toBe("bulb");
    expect(matchShortcodes("ok")[0].code).toBe("ok_hand");
    // 가운데 포함: "lend"는 calendar 가운데에만 있다
    expect(matchShortcodes("lend").map((s) => s.code)).toEqual(["calendar"]);
  });

  it("빈 입력은 앞쪽 목록, 결과는 limit으로 자른다", () => {
    expect(matchShortcodes("")).toHaveLength(8);
    expect(matchShortcodes("", 3).map((s) => s.code)).toEqual(["smile", "grin", "joy"]);
    expect(matchShortcodes("zzz")).toEqual([]);
  });

  it("모든 항목의 코드는 소문자·숫자·밑줄이고 중복이 없다", () => {
    const codes = SHORTCODES.map((s) => s.code);
    for (const c of codes) expect(c).toMatch(/^[a-z0-9_]+$/);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("활성 항목은 끝에서 돌아간다", () => {
    expect(nextActiveIndex(0, "ArrowDown", 3)).toBe(1);
    expect(nextActiveIndex(2, "ArrowDown", 3)).toBe(0);
    expect(nextActiveIndex(0, "ArrowUp", 3)).toBe(2);
    expect(nextActiveIndex(0, "ArrowUp", 0)).toBe(-1);
  });
});

describe("이모지 단축 코드 이름 (SYS-14)", () => {
  afterEach(() => setLocale("ko"));

  it("이름은 지금 언어로 읽힌다", () => {
    const smile = SHORTCODES.find((s) => s.code === "smile");
    expect(smile?.label).toBe("웃는 얼굴");
    setLocale("en");
    expect(smile?.label).toBe("Smiling face");
  });
});
