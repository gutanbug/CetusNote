import { afterEach, describe, expect, it } from "vitest";
import { msg, setLocale } from "@/lib/i18n";

describe("collection 문구 영어 (SYS-14)", () => {
  afterEach(() => setLocale("ko"));

  it("영어 로캘이면 컬렉션 문구가 영어로 읽힌다", () => {
    setLocale("en");
    const c = msg().collection;
    expect(c.model.fieldType.checkbox).toBe("Checkbox");
    expect(c.calendar.dow[0]).toBe("Sun");
    expect(c.calendar.monthDay(3, 5)).toBe("Mar 5");
    expect(c.toolbar.shownOf(2, 5)).toBe("2 of 5 items");
    expect(c.toolbar.openMode.tab).toBe("New tab");
  });

  it("한국어로 되돌리면 기본 문구가 그대로다", () => {
    setLocale("ko");
    const c = msg().collection;
    expect(c.calendar.dow[0]).toBe("일");
    expect(c.calendar.monthDay(3, 5)).toBe("3월 5일");
    expect(c.toolbar.shownOf(2, 5)).toBe("2개 / 전체 5개");
  });
});
