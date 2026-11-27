import { describe, expect, it } from "vitest";
import { formatReminderWhen } from "./present";
import { createReminder } from "./model";

const target = { type: "none" } as const;
const at = (s: string) => new Date(s.replace(" ", "T"));

describe("formatReminderWhen", () => {
  it("오늘·내일·다른 날 알람", () => {
    const now = at("2026-11-27 08:00");
    const today = createReminder(
      { id: "a", kind: "alarm", target, label: "", at: "2026-11-27T15:00" },
      now,
    );
    const tomorrow = createReminder(
      { id: "b", kind: "alarm", target, label: "", at: "2026-11-28T09:00" },
      now,
    );
    const later = createReminder(
      { id: "c", kind: "alarm", target, label: "", at: "2026-12-03T14:30" },
      now,
    );
    expect(formatReminderWhen(today!, now)).toBe("오늘 15:00");
    expect(formatReminderWhen(tomorrow!, now)).toBe("내일 9:00");
    expect(formatReminderWhen(later!, now)).toBe("12월 3일 14:30");
  });

  it("한 시간 안이면 남은 분", () => {
    const now = at("2026-11-27 10:00");
    const rem = createReminder(
      { id: "a", kind: "alarm", target, label: "", at: "2026-11-27T10:25" },
      now,
    );
    expect(formatReminderWhen(rem!, now)).toBe("25분 남음");
  });

  it("반복 알람은 주기와 시각", () => {
    const now = at("2026-11-27 08:00");
    const rem = createReminder(
      { id: "a", kind: "alarm", target, label: "", at: "2026-11-27T09:00", repeat: "day" },
      now,
    );
    expect(formatReminderWhen(rem!, now)).toBe("매일 9:00");
  });

  it("타이머는 남은 분, 끝나면 완료 문구", () => {
    const created = at("2026-11-27 10:00");
    const rem = createReminder(
      { id: "t", kind: "timer", target, label: "", durationSec: 1500 },
      created,
    );
    expect(formatReminderWhen(rem!, new Date(created.getTime() + 60_000))).toBe("24분 남음");
    expect(formatReminderWhen(rem!, new Date(created.getTime() + 1_600_000))).toBe(
      "타이머가 끝났어요",
    );
  });
});
