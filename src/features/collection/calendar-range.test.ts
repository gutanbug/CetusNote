import { describe, expect, it } from "vitest";
import {
  clipToWeek,
  dayOffset,
  passedThreshold,
  rangeFromDrag,
  rescheduleRecord,
  shiftDate,
  weekDates,
} from "./calendar-range";

describe("shiftDate / dayOffset", () => {
  it("moves across month and year boundaries", () => {
    expect(shiftDate("2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate("2026-02-27", 2)).toBe("2026-03-01");
  });

  it("counts days from first to second", () => {
    expect(dayOffset("2026-11-10", "2026-11-13")).toBe(3);
    expect(dayOffset("2026-11-13", "2026-11-10")).toBe(-3);
    expect(dayOffset("2026-11-10", "2026-11-10")).toBe(0);
  });
});

describe("passedThreshold", () => {
  it("needs 4px of travel", () => {
    expect(passedThreshold(3, 0)).toBe(false);
    expect(passedThreshold(4, 0)).toBe(true);
    expect(passedThreshold(0, -4)).toBe(true);
    expect(passedThreshold(2, 2)).toBe(false);
  });
});

describe("weekDates", () => {
  it("returns the Sunday-to-Saturday week that holds the anchor", () => {
    // 2026-11-20은 금요일 → 11/15(일)–11/21(토)
    const w = weekDates("2026-11-20");
    expect(w).toHaveLength(7);
    expect(w[0]).toBe("2026-11-15");
    expect(w[6]).toBe("2026-11-21");
    expect(weekDates("2026-11-22")[0]).toBe("2026-11-22");
  });
});

describe("rescheduleRecord", () => {
  const both = { start: "2026-11-10", due: "2026-11-12" };

  it("moves a range as a whole", () => {
    expect(rescheduleRecord(both, { kind: "move", days: 2 })).toEqual({
      start: "2026-11-12",
      due: "2026-11-14",
    });
    expect(rescheduleRecord(both, { kind: "move", days: -10 })).toEqual({
      start: "2026-10-31",
      due: "2026-11-02",
    });
  });

  it("moves a single date for start-only or due-only records", () => {
    expect(rescheduleRecord({ start: "2026-11-10", due: null }, { kind: "move", days: 1 })).toEqual(
      { start: "2026-11-11", due: null },
    );
    expect(
      rescheduleRecord({ start: null, due: "2026-11-27" }, { kind: "move", days: -1 }),
    ).toEqual({ start: null, due: "2026-11-26" });
  });

  it("returns null for no-op moves and undated records", () => {
    expect(rescheduleRecord(both, { kind: "move", days: 0 })).toBeNull();
    expect(rescheduleRecord({ start: null, due: null }, { kind: "move", days: 1 })).toBeNull();
  });

  it("changes only the edge it was given", () => {
    expect(rescheduleRecord(both, { kind: "due", date: "2026-11-15" })).toEqual({
      start: "2026-11-10",
      due: "2026-11-15",
    });
    expect(rescheduleRecord(both, { kind: "start", date: "2026-11-09" })).toEqual({
      start: "2026-11-09",
      due: "2026-11-12",
    });
  });

  it("clamps so start never passes due and due never passes start", () => {
    expect(rescheduleRecord(both, { kind: "start", date: "2026-11-20" })).toEqual({
      start: "2026-11-12",
      due: "2026-11-12",
    });
    expect(rescheduleRecord(both, { kind: "due", date: "2026-11-01" })).toEqual({
      start: "2026-11-10",
      due: "2026-11-10",
    });
  });

  it("sets the missing edge when a single-date record is resized", () => {
    expect(
      rescheduleRecord({ start: null, due: "2026-11-27" }, { kind: "start", date: "2026-11-25" }),
    ).toEqual({ start: "2026-11-25", due: "2026-11-27" });
    expect(
      rescheduleRecord({ start: "2026-11-20", due: null }, { kind: "due", date: "2026-11-22" }),
    ).toEqual({ start: "2026-11-20", due: "2026-11-22" });
  });

  it("returns null when the edge does not change", () => {
    expect(rescheduleRecord(both, { kind: "start", date: "2026-11-10" })).toBeNull();
    expect(rescheduleRecord(both, { kind: "due", date: "2026-11-12" })).toBeNull();
  });
});

describe("rangeFromDrag", () => {
  it("orders the two days either way", () => {
    expect(rangeFromDrag("2026-11-17", "2026-11-19")).toEqual({
      start: "2026-11-17",
      due: "2026-11-19",
    });
    expect(rangeFromDrag("2026-11-19", "2026-11-17")).toEqual({
      start: "2026-11-17",
      due: "2026-11-19",
    });
    expect(rangeFromDrag("2026-11-17", "2026-11-17")).toEqual({
      start: "2026-11-17",
      due: "2026-11-17",
    });
  });
});

describe("clipToWeek", () => {
  const week = weekDates("2026-11-22"); // 11/22(일)–11/28(토)

  it("places a range inside the week", () => {
    expect(clipToWeek({ from: "2026-11-23", to: "2026-11-25" }, week)).toEqual({
      col: 1,
      span: 3,
      continuesBefore: false,
      continuesAfter: false,
    });
  });

  it("cuts a range at the week edges", () => {
    expect(clipToWeek({ from: "2026-11-20", to: "2026-11-24" }, week)).toEqual({
      col: 0,
      span: 3,
      continuesBefore: true,
      continuesAfter: false,
    });
    expect(clipToWeek({ from: "2026-11-27", to: "2026-12-03" }, week)).toEqual({
      col: 5,
      span: 2,
      continuesBefore: false,
      continuesAfter: true,
    });
  });

  it("returns null when the range misses the week", () => {
    expect(clipToWeek({ from: "2026-11-01", to: "2026-11-21" }, week)).toBeNull();
    expect(clipToWeek({ from: "2026-11-29", to: "2026-11-30" }, week)).toBeNull();
  });
});
