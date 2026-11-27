import { describe, expect, it } from "vitest";
import {
  complete,
  createReminder,
  dueAt,
  formatLocal,
  isDue,
  nextOccurrence,
  parseLocal,
  parseReminder,
  parseRemindersFile,
  remaining,
  snooze,
  toRemindersFile,
  updateReminder,
  type Reminder,
} from "./model";

const at = (s: string) => {
  const d = parseLocal(s);
  if (!d) throw new Error(`bad local ${s}`);
  return d;
};

const alarm = (over: Partial<Reminder> = {}): Reminder => ({
  id: "r1",
  kind: "alarm",
  target: { type: "none" },
  label: "회의",
  at: "2026-11-30T09:00",
  createdAt: "2026-11-27T00:00:00.000Z",
  ...over,
});

describe("local datetime", () => {
  it("parses and formats the minute-precision local form", () => {
    expect(formatLocal(at("2026-12-03T14:05"))).toBe("2026-12-03T14:05");
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseLocal("2026-02-30T10:00")).toBeNull();
    expect(parseLocal("2026-13-01T10:00")).toBeNull();
    expect(parseLocal("2026-12-03 14:00")).toBeNull();
    expect(parseLocal("2026-12-03T25:00")).toBeNull();
  });
});

describe("nextOccurrence", () => {
  it("returns the one-off time only when it is still ahead", () => {
    expect(nextOccurrence(alarm(), at("2026-11-29T00:00"))?.getTime()).toBe(
      at("2026-11-30T09:00").getTime(),
    );
    expect(nextOccurrence(alarm(), at("2026-11-30T09:00"))).toBeNull();
  });

  it("repeats every day at the same time", () => {
    const r = alarm({ repeat: "day", anchor: "2026-11-30T09:00" });
    expect(formatLocal(nextOccurrence(r, at("2026-11-30T09:00"))!)).toBe("2026-12-01T09:00");
    expect(formatLocal(nextOccurrence(r, at("2026-12-20T08:00"))!)).toBe("2026-12-20T09:00");
  });

  it("weekday skips Saturday and Sunday", () => {
    // 2026-11-27 is a Friday
    const r = alarm({ repeat: "weekday", anchor: "2026-11-27T08:30", at: "2026-11-27T08:30" });
    expect(formatLocal(nextOccurrence(r, at("2026-11-27T09:00"))!)).toBe("2026-11-30T08:30");
    expect(formatLocal(nextOccurrence(r, at("2026-11-30T09:00"))!)).toBe("2026-12-01T08:30");
  });

  it("week keeps the weekday and time", () => {
    // 2026-11-30 is a Monday
    const r = alarm({ repeat: "week", anchor: "2026-11-30T10:00" });
    expect(formatLocal(nextOccurrence(r, at("2026-11-30T10:00"))!)).toBe("2026-12-07T10:00");
    expect(formatLocal(nextOccurrence(r, at("2026-12-10T12:00"))!)).toBe("2026-12-14T10:00");
  });

  it("month clamps to the last day of short months and returns to the anchor day", () => {
    const r = alarm({ repeat: "month", anchor: "2026-01-31T09:00", at: "2026-01-31T09:00" });
    expect(formatLocal(nextOccurrence(r, at("2026-01-31T09:00"))!)).toBe("2026-02-28T09:00");
    const feb = { ...r, at: "2026-02-28T09:00" };
    expect(formatLocal(nextOccurrence(feb, at("2026-02-28T09:00"))!)).toBe("2026-03-31T09:00");
  });

  it("month on the 1st works across a year boundary", () => {
    const r = alarm({ repeat: "month", anchor: "2026-12-01T09:00", at: "2026-12-01T09:00" });
    expect(formatLocal(nextOccurrence(r, at("2026-12-01T10:00"))!)).toBe("2027-01-01T09:00");
  });

  it("handles a far-future anchor (no occurrence before it)", () => {
    const r = alarm({ repeat: "day", anchor: "2027-05-05T07:00", at: "2027-05-05T07:00" });
    expect(formatLocal(nextOccurrence(r, at("2026-11-27T00:00"))!)).toBe("2027-05-05T07:00");
  });
});

describe("dueAt, isDue, snooze", () => {
  it("uses snoozedUntil before at", () => {
    const r = alarm({ snoozedUntil: "2026-11-30T09:10" });
    expect(formatLocal(dueAt(r)!)).toBe("2026-11-30T09:10");
  });

  it("is due once its time has passed and it is not done", () => {
    expect(isDue(alarm(), at("2026-11-30T08:59"))).toBe(false);
    expect(isDue(alarm(), at("2026-11-30T09:00"))).toBe(true);
    expect(isDue(alarm({ done: true }), at("2026-11-30T10:00"))).toBe(false);
  });

  it("snooze by minutes rounds down to the minute from now", () => {
    const now = new Date(2026, 10, 30, 9, 0, 42);
    expect(snooze(alarm(), 10, now).snoozedUntil).toBe("2026-11-30T09:10");
    expect(snooze(alarm(), 60, now).snoozedUntil).toBe("2026-11-30T10:00");
  });

  it("snooze tomorrow sets next day 09:00", () => {
    const now = new Date(2026, 10, 30, 22, 15);
    expect(snooze(alarm(), "tomorrow9", now).snoozedUntil).toBe("2026-12-01T09:00");
  });
});

describe("complete", () => {
  it("marks a one-off alarm done and clears snooze", () => {
    const done = complete(alarm({ snoozedUntil: "2026-11-30T09:10" }), at("2026-11-30T09:10"));
    expect(done.done).toBe(true);
    expect(done.snoozedUntil).toBeUndefined();
  });

  it("advances a repeating alarm and clears snooze", () => {
    const r = alarm({
      repeat: "day",
      anchor: "2026-11-30T09:00",
      snoozedUntil: "2026-11-30T09:10",
    });
    const next = complete(r, at("2026-11-30T09:10"));
    expect(next.done).toBeUndefined();
    expect(next.at).toBe("2026-12-01T09:00");
    expect(next.snoozedUntil).toBeUndefined();
  });

  it("completing a repeating alarm early still moves past the current occurrence", () => {
    const r = alarm({ repeat: "day", anchor: "2026-11-30T09:00" });
    expect(complete(r, at("2026-11-29T20:00")).at).toBe("2026-12-01T09:00");
  });
});

describe("timers", () => {
  const timer = (over: Partial<Reminder> = {}): Reminder => ({
    id: "t1",
    kind: "timer",
    target: { type: "quickNote", id: "q1" },
    label: "차",
    at: "2026-11-27T10:25",
    durationSec: 25 * 60,
    createdAt: new Date(2026, 10, 27, 10, 0, 0).toISOString(),
    ...over,
  });

  it("fires at createdAt + durationSec", () => {
    expect(dueAt(timer())?.getTime()).toBe(new Date(2026, 10, 27, 10, 25).getTime());
  });

  it("reports the remaining seconds, rounded up, and 0 once passed", () => {
    expect(remaining(timer(), new Date(2026, 10, 27, 10, 0, 30))).toBe(24 * 60 + 30);
    expect(remaining(timer(), new Date(2026, 10, 27, 11, 0))).toBe(0);
    expect(remaining(alarm(), new Date())).toBeNull();
  });

  it("creates a timer whose at is the end time", () => {
    const now = new Date(2026, 10, 27, 10, 0, 0);
    const t = createReminder(
      { id: "t2", kind: "timer", target: { type: "none" }, label: "", durationSec: 600 },
      now,
    );
    expect(t?.at).toBe("2026-11-27T10:10");
  });
});

describe("createReminder and updateReminder", () => {
  const now = new Date(2026, 10, 27, 12, 0);

  it("rejects an invalid alarm time or a timer without duration", () => {
    expect(
      createReminder(
        { id: "x", kind: "alarm", target: { type: "none" }, label: "", at: "bad" },
        now,
      ),
    ).toBeNull();
    expect(
      createReminder({ id: "x", kind: "timer", target: { type: "none" }, label: "" }, now),
    ).toBeNull();
  });

  it("keeps the anchor for a repeating alarm", () => {
    const r = createReminder(
      {
        id: "x",
        kind: "alarm",
        target: { type: "page", id: "p1" },
        label: "운동",
        at: "2026-11-28T07:00",
        repeat: "week",
      },
      now,
    );
    expect(r?.anchor).toBe("2026-11-28T07:00");
    expect(r?.repeat).toBe("week");
  });

  it("updateReminder changes time, label and repeat, and removes repeat on null", () => {
    const r = alarm({
      repeat: "day",
      anchor: "2026-11-30T09:00",
      snoozedUntil: "2026-11-30T09:10",
    });
    const moved = updateReminder(r, { at: "2026-12-02T18:00", label: "저녁" });
    expect(moved?.at).toBe("2026-12-02T18:00");
    expect(moved?.anchor).toBe("2026-12-02T18:00");
    expect(moved?.snoozedUntil).toBeUndefined();
    expect(moved?.label).toBe("저녁");
    const once = updateReminder(r, { repeat: null });
    expect(once?.repeat).toBeUndefined();
    expect(once?.anchor).toBeUndefined();
  });
});

describe("parsing", () => {
  it("drops invalid reminders and keeps valid ones", () => {
    const list = parseRemindersFile({
      schemaVersion: 1,
      reminders: [
        alarm(),
        alarm({ id: "" }),
        alarm({ id: "bad-kind", kind: "reminder" as never }),
        alarm({ id: "bad-at", at: "2026-02-30T09:00" }),
        alarm({ id: "bad-target", target: { type: "folder", id: "f" } as never }),
        alarm({ id: "no-created", createdAt: "not a date" }),
        { ...alarm({ id: "timer-no-dur", kind: "timer" }) },
        "text",
        null,
      ],
    });
    expect(list.map((r) => r.id)).toEqual(["r1"]);
  });

  it("drops invalid optional values but keeps the reminder", () => {
    const rem = parseReminder({
      ...alarm({ id: "o1" }),
      repeat: "yearly",
      snoozedUntil: "soon",
      done: "yes",
    });
    expect(rem).not.toBeNull();
    expect(rem?.repeat).toBeUndefined();
    expect(rem?.snoozedUntil).toBeUndefined();
    expect(rem?.done).toBeUndefined();
  });

  it("returns an empty list for a wrong file shape or schema", () => {
    expect(parseRemindersFile(null)).toEqual([]);
    expect(parseRemindersFile({ schemaVersion: 2, reminders: [alarm()] })).toEqual([]);
    expect(parseRemindersFile({ schemaVersion: 1, reminders: {} })).toEqual([]);
  });

  it("removes duplicate ids", () => {
    const list = parseRemindersFile({
      schemaVersion: 1,
      reminders: [alarm(), alarm({ label: "두 번째" })],
    });
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe("회의");
  });

  it("round-trips through the file shape", () => {
    const list = [alarm({ repeat: "month", anchor: "2026-01-31T09:00", at: "2026-02-28T09:00" })];
    const file = toRemindersFile(list);
    expect(file).toEqual({ schemaVersion: 1, reminders: list });
    expect(parseRemindersFile(JSON.parse(JSON.stringify(file)))).toEqual(list);
  });
});
