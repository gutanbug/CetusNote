import { describe, expect, it } from "vitest";
import { reminderPresets } from "./presets";

const at = (list: ReturnType<typeof reminderPresets>, id: string) =>
  list.find((p) => p.id === id)?.at;

describe("reminderPresets", () => {
  it("computes offsets and the next evening/Monday from local time", () => {
    // 2026-11-27 금요일 10:00
    const list = reminderPresets(new Date(2026, 10, 27, 10, 0));
    expect(at(list, "min10")).toBe("2026-11-27T10:10");
    expect(at(list, "hour1")).toBe("2026-11-27T11:00");
    expect(at(list, "tonight6")).toBe("2026-11-27T18:00");
    expect(at(list, "tomorrow9")).toBe("2026-11-28T09:00");
    expect(at(list, "monday9")).toBe("2026-11-30T09:00");
  });

  it("moves the evening to tomorrow after 18:00 and Monday to next week on a Monday", () => {
    // 2026-11-30 월요일 19:00
    const list = reminderPresets(new Date(2026, 10, 30, 19, 0));
    expect(at(list, "tonight6")).toBe("2026-12-01T18:00");
    expect(at(list, "monday9")).toBe("2026-12-07T09:00");
  });
});
