import { describe, expect, it } from "vitest";
import { groupReminders } from "./group";
import type { Reminder } from "./model";

const NOW = new Date(2026, 10, 27, 10, 0, 0); // 2026-11-27 (금)

const alarm = (id: string, at: string, extra: Partial<Reminder> = {}): Reminder => ({
  id,
  kind: "alarm",
  target: { type: "page", id: "p1" },
  label: id,
  at,
  createdAt: "2026-11-20T09:00:00",
  ...extra,
});

const timer = (id: string, createdAt: string, durationSec: number): Reminder => ({
  id,
  kind: "timer",
  target: { type: "none" },
  label: id,
  at: createdAt.slice(0, 16),
  durationSec,
  createdAt,
});

describe("groupReminders", () => {
  it("splits alarms by due day, from today to later", () => {
    const list = [
      alarm("today", "2026-11-27T15:00"),
      alarm("tomorrow", "2026-11-28T09:00"),
      alarm("week", "2026-11-29T09:00"), // 일요일 11/29 → 이번 주 (월요일 시작, 일요일 끝)
      alarm("next", "2026-12-01T09:00"),
    ];
    const g = groupReminders(list, NOW);
    expect(g.today.map((r) => r.id)).toEqual(["today"]);
    expect(g.tomorrow.map((r) => r.id)).toEqual(["tomorrow"]);
    expect(g.thisWeek.map((r) => r.id)).toEqual(["week"]);
    expect(g.later.map((r) => r.id)).toEqual(["next"]);
  });

  it("puts past, undone alarms in overdue and keeps repeating ones apart", () => {
    const list = [
      alarm("late", "2026-11-27T08:00"),
      alarm("daily", "2026-11-27T20:00", { repeat: "day", anchor: "2026-11-20T20:00" }),
    ];
    const g = groupReminders(list, NOW);
    expect(g.overdue.map((r) => r.id)).toEqual(["late"]);
    expect(g.today).toEqual([]);
    expect(g.repeating.map((r) => r.id)).toEqual(["daily"]);
  });

  it("shows running timers and moves finished timers to overdue", () => {
    const list = [
      timer("running", "2026-11-27T09:50:00", 25 * 60), // 10:15 종료
      timer("ended", "2026-11-27T08:00:00", 60), // 08:01 종료
    ];
    const g = groupReminders(list, NOW);
    expect(g.running.map((r) => r.id)).toEqual(["running"]);
    expect(g.overdue.map((r) => r.id)).toEqual(["ended"]);
  });

  it("lists done items last, newest first, and keeps them out of the other groups", () => {
    const list = [
      alarm("d1", "2026-11-27T15:00", { done: true }),
      alarm("d2", "2026-11-26T15:00", { done: true }),
      alarm("open", "2026-11-27T16:00"),
    ];
    const g = groupReminders(list, NOW);
    expect(g.done.map((r) => r.id)).toEqual(["d1", "d2"]);
    expect(g.today.map((r) => r.id)).toEqual(["open"]);
  });

  it("uses Monday as the week start, so Monday next week is later", () => {
    // 2026-11-30은 다음 주 월요일
    const g = groupReminders([alarm("mon", "2026-11-30T09:00")], NOW);
    expect(g.later.map((r) => r.id)).toEqual(["mon"]);
    expect(g.thisWeek).toEqual([]);
  });
});
