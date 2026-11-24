import { describe, expect, it } from "vitest";
import { describeDateChip, type DateChipValue } from "./date-chip";
import { NO_REMINDER } from "./reminder";

const base: DateChipValue = {
  date: "2026-11-28",
  time: null,
  reminder: NO_REMINDER,
  done: false,
  created: null,
};
const now = new Date(2026, 10, 24, 9, 0);

describe("날짜 칩 표시 값", () => {
  it("상대 문구와 마우스 올림 문구를 함께 만든다", () => {
    const v = describeDateChip({ ...base, date: "2026-11-25", time: "14:30" }, now);
    expect(v.label).toBe("내일 14:30");
    expect(v.title).toBe("2026년 11월 25일 (수) 14:30");
  });

  it("지난 날짜이고 완료하지 않으면 기한 지남", () => {
    const v = describeDateChip({ ...base, date: "2026-11-20" }, now);
    expect([v.overdue, v.done]).toEqual([true, false]);
  });

  it("완료하면 기한 지남이 아니고 완료 상태다", () => {
    const v = describeDateChip({ ...base, date: "2026-11-20", done: true }, now);
    expect([v.overdue, v.done]).toEqual([false, true]);
  });

  it("알림이 있으면 hasReminder, 시각이 지났으면 passed", () => {
    const set = describeDateChip(
      { ...base, date: "2026-11-24", time: "10:00", reminder: { kind: "before", minutes: 10 } },
      now,
    );
    expect([set.hasReminder, set.reminder]).toEqual([true, "scheduled"]);
    const past = describeDateChip(
      { ...base, date: "2026-11-24", time: "08:00", reminder: { kind: "custom", time: "08:30" } },
      now,
    );
    expect(past.reminder).toBe("passed");
  });

  it("알림 값이 깨졌으면 없는 것으로 본다", () => {
    const v = describeDateChip(
      { ...base, reminder: { kind: "custom", time: "25:99" } as never },
      now,
    );
    expect([v.hasReminder, v.reminder]).toEqual([false, "none"]);
  });
});
