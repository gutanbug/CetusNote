import { describe, expect, it } from "vitest";
import { formatAbsoluteLabel, formatDateLabel, formatDateTimeLabel } from "./date-label";
import { addDays, dayDiff, isIsoDate, nextMonday, parseIsoDate, toIsoDate } from "./local-date";
import {
  computeReminderAt,
  customReminderTime,
  followChipTime,
  isOverdue,
  NO_REMINDER,
  reminderOptionKey,
  reminderStatus,
} from "./reminder";

// 기준 시각은 로컬 시각으로 만든다(new Date(y, m, d)) — TZ와 무관하게 같은 달력 날짜를 본다.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("로컬 달력 날짜", () => {
  it("YYYY-MM-DD를 로컬 자정으로 읽는다 (UTC로 밀리지 않는다)", () => {
    const d = parseIsoDate("2026-11-28");
    expect(d && [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([
      2026, 10, 28, 0,
    ]);
  });

  it("없는 날짜와 형식이 다른 값은 거른다", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isIsoDate("2026-11-28T00:00:00Z")).toBe(false);
    expect(isIsoDate("2026-11-28")).toBe(true);
  });

  it("Date를 로컬 날짜 문자열로 바꾼다 (자정 직전·직후에도 같은 날)", () => {
    expect(toIsoDate(at(2026, 3, 1, 23, 59))).toBe("2026-03-01");
    expect(toIsoDate(at(2026, 3, 1, 0, 0))).toBe("2026-03-01");
  });

  it("addDays는 월·연도 경계와 2월을 넘는다", () => {
    expect(toIsoDate(addDays(at(2026, 12, 31), 1))).toBe("2027-01-01");
    expect(toIsoDate(addDays(at(2028, 2, 28), 1))).toBe("2028-02-29");
    expect(toIsoDate(addDays(at(2026, 3, 1), -1))).toBe("2026-02-28");
  });

  it("dayDiff는 시각을 무시하고 달력 날짜 차이만 센다", () => {
    expect(dayDiff(at(2026, 11, 24, 23, 59), at(2026, 11, 25, 0, 1))).toBe(1);
    expect(dayDiff(at(2026, 3, 1), at(2026, 2, 28))).toBe(-1);
  });

  it("다음 주 월요일: 목요일이면 다음 주 월(4일 뒤), 월요일이면 7일 뒤", () => {
    // 2026-11-26은 목요일
    expect(toIsoDate(nextMonday(at(2026, 11, 26)))).toBe("2026-11-30");
    // 2026-11-30은 월요일
    expect(toIsoDate(nextMonday(at(2026, 11, 30)))).toBe("2026-12-07");
  });
});

describe("날짜 표시 문구", () => {
  const now = at(2026, 11, 24, 9);

  it.each([
    ["2026-11-24", "오늘"],
    ["2026-11-25", "내일"],
    ["2026-11-23", "어제"],
    ["2026-11-26", "2일 뒤"],
    ["2026-11-29", "5일 뒤"],
    ["2026-11-30", "6일 뒤"],
    ["2026-12-01", "12월 1일 (화)"],
    ["2026-11-22", "11월 22일 (일)"],
    ["2027-01-03", "2027년 1월 3일 (일)"],
    ["2025-12-31", "2025년 12월 31일 (수)"],
  ])("%s → %s", (iso, label) => {
    expect(formatDateLabel(iso, now)).toBe(label);
  });

  it("6일 뒤까지만 상대 표시, 7일 뒤부터는 날짜", () => {
    expect(formatDateLabel("2026-11-30", now)).toBe("6일 뒤");
    expect(formatDateLabel("2026-12-01", now)).toBe("12월 1일 (화)");
  });

  it("자정을 넘긴 직후 「오늘」이 바뀐다 (로컬 날짜 기준)", () => {
    expect(formatDateLabel("2026-11-24", at(2026, 11, 25, 0, 0))).toBe("어제");
  });

  it("잘못된 값은 그대로 돌려준다", () => {
    expect(formatDateLabel("nope", now)).toBe("nope");
  });

  it("시각이 있으면 뒤에 붙이고, 절대 표시는 항상 연도를 붙인다", () => {
    expect(formatDateTimeLabel("2026-11-25", "14:30", now)).toBe("내일 14:30");
    expect(formatDateTimeLabel("2026-11-25", null, now)).toBe("내일");
    expect(formatAbsoluteLabel("2026-11-28", "09:00")).toBe("2026년 11월 28일 (토) 09:00");
  });
});

describe("알림 시각 계산", () => {
  const date = "2026-11-28";

  it("없음은 시각이 없다", () => {
    expect(computeReminderAt(date, "10:00", NO_REMINDER)).toBeNull();
  });

  it("당일 9시는 시각이 없어도 같은 날 09:00이다", () => {
    const at9 = computeReminderAt(date, null, { kind: "morning" });
    expect(at9 && toIsoDate(at9) + " " + at9.getHours() + ":" + at9.getMinutes()).toBe(
      "2026-11-28 9:0",
    );
  });

  it("시간 지정은 같은 날 지정한 시각이다", () => {
    const t = computeReminderAt(date, null, { kind: "custom", time: "18:45" });
    expect([t?.getHours(), t?.getMinutes()]).toEqual([18, 45]);
  });

  it("N분 전·1일 전은 날짜·시각 기준으로 빼고, 시각이 없으면 null", () => {
    const ten = computeReminderAt(date, "10:00", { kind: "before", minutes: 10 });
    expect([ten?.getHours(), ten?.getMinutes()]).toEqual([9, 50]);
    const hour = computeReminderAt(date, "00:30", { kind: "before", minutes: 60 });
    expect(hour && toIsoDate(hour) + " " + hour.getHours() + ":" + hour.getMinutes()).toBe(
      "2026-11-27 23:30",
    );
    const day = computeReminderAt(date, "10:00", { kind: "before", minutes: 1440 });
    expect(day && toIsoDate(day)).toBe("2026-11-27");
    expect(computeReminderAt(date, null, { kind: "before", minutes: 10 })).toBeNull();
  });

  it("잘못된 날짜는 null", () => {
    expect(computeReminderAt("2026-02-30", "10:00", { kind: "morning" })).toBeNull();
  });

  it("알림 상태: 지난 시각이면 passed (앱 실행 중에 놓친 알림)", () => {
    const rule = { kind: "custom", time: "09:00" } as const;
    expect(reminderStatus(date, null, rule, at(2026, 11, 28, 8))).toBe("scheduled");
    expect(reminderStatus(date, null, rule, at(2026, 11, 28, 9))).toBe("passed");
    expect(reminderStatus(date, null, NO_REMINDER, at(2026, 11, 28, 9))).toBe("none");
  });

  it("선택지 키", () => {
    expect(reminderOptionKey({ kind: "before", minutes: 1440 })).toBe("before-1440");
    expect(reminderOptionKey({ kind: "custom", time: "07:00" })).toBe("custom");
  });
});

describe("시간 지정 알림의 시각 따라가기", () => {
  it("「시간 지정」의 기본 시각은 칩 시각, 칩 시각이 없으면 09:00", () => {
    expect(customReminderTime("14:30")).toBe("14:30");
    expect(customReminderTime(null)).toBe("09:00");
  });

  it("알림 시각이 이전 칩 시각과 같으면 새 칩 시각을 따라간다", () => {
    expect(followChipTime({ kind: "custom", time: "14:30" }, "14:30", "15:00")).toEqual({
      kind: "custom",
      time: "15:00",
    });
  });

  it("이전 칩 시각이 없던 경우 알림 09:00은 새 칩 시각을 따라간다", () => {
    expect(followChipTime({ kind: "custom", time: "09:00" }, null, "16:20")).toEqual({
      kind: "custom",
      time: "16:20",
    });
  });

  it("사용자가 따로 고친 알림 시각은 칩 시각이 바뀌어도 그대로 둔다", () => {
    const rule = { kind: "custom", time: "08:15" } as const;
    expect(followChipTime(rule, "14:30", "15:00")).toBe(rule);
  });

  it("시각을 지우면(새 칩 시각 null) 규칙을 바꾸지 않는다", () => {
    const rule = { kind: "custom", time: "14:30" } as const;
    expect(followChipTime(rule, "14:30", null)).toBe(rule);
  });

  it("「시간 지정」이 아닌 규칙은 건드리지 않는다 (N분 전은 칩 시각에서 계산된다)", () => {
    const rule = { kind: "before", minutes: 10 } as const;
    expect(followChipTime(rule, "14:30", "15:00")).toBe(rule);
    expect(followChipTime(NO_REMINDER, "14:30", "15:00")).toBe(NO_REMINDER);
  });
});

describe("기한 지남 판정", () => {
  it("지난 날짜이고 완료하지 않았으면 기한 지남", () => {
    expect(isOverdue("2026-11-23", null, false, at(2026, 11, 24))).toBe(true);
    expect(isOverdue("2026-11-23", null, true, at(2026, 11, 24))).toBe(false);
  });

  it("오늘은 시각이 지나야 기한 지남, 시각이 없으면 지나지 않았다", () => {
    expect(isOverdue("2026-11-24", null, false, at(2026, 11, 24, 23))).toBe(false);
    expect(isOverdue("2026-11-24", "10:00", false, at(2026, 11, 24, 9))).toBe(false);
    expect(isOverdue("2026-11-24", "10:00", false, at(2026, 11, 24, 10))).toBe(true);
  });

  it("미래 날짜는 지나지 않았다", () => {
    expect(isOverdue("2026-11-25", "00:00", false, at(2026, 11, 24, 23))).toBe(false);
  });
});
