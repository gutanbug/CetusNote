import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "@/lib/i18n";
import { formatAbsoluteLabel, formatDateLabel, formatDateTimeLabel } from "./date-label";
import { formatAgo } from "@/lib/format-date";

describe("영어 날짜 표시 (SYS-14)", () => {
  afterEach(() => setLocale("ko"));

  it("가까운 날은 Today · Tomorrow · Yesterday · in N days", () => {
    setLocale("en");
    const now = new Date(2026, 10, 24, 12); // 2026-11-24
    expect(formatDateLabel("2026-11-24", now)).toBe("Today");
    expect(formatDateLabel("2026-11-25", now)).toBe("Tomorrow");
    expect(formatDateLabel("2026-11-23", now)).toBe("Yesterday");
    expect(formatDateLabel("2026-11-26", now)).toBe("in 2 days");
  });

  it("그 밖의 날짜는 영어 달 이름과 요일, 다른 해면 연도를 붙인다", () => {
    setLocale("en");
    const now = new Date(2026, 10, 24, 12);
    expect(formatDateLabel("2026-12-01", now)).toBe("Dec 1 (Tue)");
    expect(formatDateLabel("2027-01-03", now)).toBe("Jan 3, 2027 (Sun)");
    expect(formatAbsoluteLabel("2026-12-01", "09:00")).toBe("Dec 1, 2026 (Tue) 09:00");
    expect(formatDateTimeLabel("2026-11-25", "14:30", now)).toBe("Tomorrow 14:30");
  });

  it("지난 시간은 영어 상대 문구로 쓴다", () => {
    setLocale("en");
    const now = new Date(2026, 10, 24, 12);
    expect(formatAgo(new Date(now.getTime() - 30_000).toISOString(), now)).toBe("just now");
    expect(formatAgo(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe(
      "5 minutes ago",
    );
    expect(formatAgo(new Date(now.getTime() - 3 * 3_600_000).toISOString(), now)).toBe(
      "3 hours ago",
    );
  });
});
