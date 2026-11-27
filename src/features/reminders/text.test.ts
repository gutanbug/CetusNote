import { describe, expect, it, vi } from "vitest";
import { addReminderFromText } from "./text";
import { complete, createReminder } from "./model";

const target = { type: "none" } as const;

describe("addReminderFromText", () => {
  it("문장에서 시각을 알아듣고 알람으로 더한다", () => {
    const sink = { add: vi.fn(() => null) };
    const now = new Date(2026, 10, 27, 10, 0);
    addReminderFromText(sink, "내일 9시 회의 준비", target, now);
    expect(sink.add).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "alarm", label: "회의 준비", at: "2026-11-28T09:00" }),
      now,
    );
  });

  it("시각이 없으면 null이고 더하지 않는다", () => {
    const sink = { add: vi.fn(() => null) };
    expect(addReminderFromText(sink, "그냥 메모", target, new Date(2026, 10, 27))).toBeNull();
    expect(sink.add).not.toHaveBeenCalled();
  });
});

describe("월말 반복 (ADR-030 anchor)", () => {
  it("31일 기준은 2월에 말일로 가도 다음 달에 31일로 돌아온다", () => {
    const now = new Date(2026, 0, 1);
    let rem = createReminder(
      { id: "m", kind: "alarm", target, label: "", at: "2026-01-31T09:00", repeat: "month" },
      now,
    )!;
    rem = complete(rem, new Date(2026, 0, 31, 9, 1));
    expect(rem.at).toBe("2026-02-28T09:00");
    rem = complete(rem, new Date(2026, 1, 28, 9, 1));
    expect(rem.at).toBe("2026-03-31T09:00");
  });
});
