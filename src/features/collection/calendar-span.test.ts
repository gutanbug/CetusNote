import { describe, expect, it } from "vitest";
import { layoutCalendar, rangeOf, type CalendarSpanInput } from "./calendar-span";

/** 2026-11-01(일)부터 42칸 */
const DATES = Array.from({ length: 42 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 10, 1 + i));
  return d.toISOString().slice(0, 10);
});
const rec = (
  id: string,
  start: string | null,
  due: string | null,
  title = id,
): CalendarSpanInput => ({
  id,
  title,
  start,
  due,
});

describe("rangeOf", () => {
  it("both dates make a span", () => {
    expect(rangeOf("2026-11-03", "2026-11-07")).toEqual({ from: "2026-11-03", to: "2026-11-07" });
  });
  it("a reversed span is a single day on start", () => {
    expect(rangeOf("2026-11-09", "2026-11-07")).toEqual({ from: "2026-11-09", to: "2026-11-09" });
  });
  it("only one date is a single day on that date", () => {
    expect(rangeOf(null, "2026-11-07")).toEqual({ from: "2026-11-07", to: "2026-11-07" });
    expect(rangeOf("2026-11-03", null)).toEqual({ from: "2026-11-03", to: "2026-11-03" });
  });
  it("no dates means no item", () => {
    expect(rangeOf(null, null)).toBeNull();
  });
});

describe("layoutCalendar", () => {
  it("one span inside a week is one segment with both rounded ends", () => {
    const { weeks, dayItems } = layoutCalendar(DATES, [rec("a", "2026-11-03", "2026-11-05")]);
    expect(weeks[0].segments).toEqual([
      expect.objectContaining({
        id: "a",
        col: 2,
        span: 3,
        lane: 0,
        continuesBefore: false,
        continuesAfter: false,
      }),
    ]);
    expect(dayItems["2026-11-04"]).toHaveLength(1);
    expect(dayItems["2026-11-06"]).toHaveLength(0);
  });

  it("a span across weeks is split with square continuation edges", () => {
    // 11/05(목) ~ 11/12(목): 첫 주 목~토, 둘째 주 일~목
    const { weeks } = layoutCalendar(DATES, [rec("a", "2026-11-05", "2026-11-12")]);
    expect(weeks[0].segments[0]).toMatchObject({
      col: 4,
      span: 3,
      continuesBefore: false,
      continuesAfter: true,
    });
    expect(weeks[1].segments[0]).toMatchObject({
      col: 0,
      span: 5,
      continuesBefore: true,
      continuesAfter: false,
    });
  });

  it("a span running past the grid edges is open on both sides", () => {
    const { weeks } = layoutCalendar(DATES, [rec("a", "2026-10-25", "2026-12-20")]);
    expect(weeks[0].segments[0]).toMatchObject({
      col: 0,
      span: 7,
      continuesBefore: true,
      continuesAfter: true,
    });
    expect(weeks[5].segments[0]).toMatchObject({ continuesAfter: true });
  });

  it("overlapping spans get separate lanes; earlier start first, then longer", () => {
    const { weeks } = layoutCalendar(DATES, [
      rec("short", "2026-11-03", "2026-11-04"),
      rec("long", "2026-11-03", "2026-11-06"),
      rec("later", "2026-11-04", "2026-11-05"),
    ]);
    const lanes = Object.fromEntries(weeks[0].segments.map((s) => [s.id, s.lane]));
    expect(lanes).toEqual({ long: 0, short: 1, later: 2 });
  });

  it("a lane is reused once it is free", () => {
    const { weeks } = layoutCalendar(DATES, [
      rec("a", "2026-11-01", "2026-11-02"),
      rec("b", "2026-11-04", "2026-11-05"),
    ]);
    expect(weeks[0].segments.map((s) => s.lane)).toEqual([0, 0]);
  });

  it("spans beyond maxLanes are hidden and counted per day", () => {
    const { weeks } = layoutCalendar(
      DATES,
      [
        rec("a", "2026-11-03", "2026-11-04"),
        rec("b", "2026-11-03", "2026-11-04"),
        rec("c", "2026-11-03", "2026-11-03"),
      ],
      2,
    );
    expect(weeks[0].segments).toHaveLength(2);
    expect(weeks[0].hidden).toEqual([0, 0, 1, 0, 0, 0, 0]);
  });

  it("a reversed record shows as one day on its start", () => {
    const { weeks, dayItems } = layoutCalendar(DATES, [rec("r", "2026-11-10", "2026-11-08")]);
    expect(weeks[1].segments[0]).toMatchObject({
      col: 2,
      span: 1,
      from: "2026-11-10",
      to: "2026-11-10",
    });
    expect(dayItems["2026-11-08"]).toHaveLength(0);
  });

  it("records without dates are left out", () => {
    const { weeks } = layoutCalendar(DATES, [rec("none", null, null)]);
    expect(weeks.every((w) => w.segments.length === 0)).toBe(true);
  });
});
