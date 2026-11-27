import { describe, expect, it, vi } from "vitest";
import { collectDue, reminderFireKey } from "./due";
import { createRemindersStore, remindersFor } from "./store";
import type { Reminder } from "./model";

function fakeStorage(initial: unknown = null) {
  let file: unknown = initial;
  const writes: unknown[] = [];
  return {
    writes,
    get file() {
      return file;
    },
    storage: {
      readReminders: vi.fn(async () => file),
      writeReminders: vi.fn(async (v: unknown) => {
        writes.push(v);
        file = v;
      }),
    },
  };
}

let n = 0;
const make = (initial?: unknown) => {
  const fake = fakeStorage(initial);
  const store = createRemindersStore(fake.storage, { debounceMs: 0, newId: () => `id${++n}` });
  return { fake, store };
};

const NOW = new Date(2026, 10, 27, 10, 0, 0);

describe("createRemindersStore", () => {
  it("loads a valid file and drops invalid items", async () => {
    const { store } = make({
      schemaVersion: 1,
      reminders: [
        {
          id: "a",
          kind: "alarm",
          target: { type: "none" },
          label: "x",
          at: "2026-11-28T09:00",
          createdAt: "2026-11-27T00:00:00.000Z",
        },
        { id: "b" },
      ],
    });
    await store.getState().load();
    expect(store.getState().list.map((r) => r.id)).toEqual(["a"]);
    expect(store.getState().readError).toBe(false);
  });

  it("does not write when the file could not be read", async () => {
    const fake = fakeStorage({ schemaVersion: 9 });
    const store = createRemindersStore(fake.storage, { debounceMs: 0 });
    await store.getState().load();
    expect(store.getState().readError).toBe(false); // wrong schema reads as empty list, not an error
    fake.storage.readReminders.mockRejectedValueOnce(new Error("bad json"));
    await store.getState().load();
    expect(store.getState().readError).toBe(true);
    store
      .getState()
      .add({ kind: "timer", target: { type: "none" }, label: "t", durationSec: 60 }, NOW);
    await store.getState().flush();
    expect(fake.writes).toHaveLength(0);
  });

  it("adds, snoozes, completes and writes the file shape", async () => {
    const { fake, store } = make();
    await store.getState().load();
    const added = store.getState().add(
      {
        kind: "alarm",
        target: { type: "page", id: "p1" },
        label: "회의",
        at: "2026-11-28T09:00",
        repeat: "day",
      },
      NOW,
    );
    expect(added?.id).toBe("id1");
    store.getState().snooze("id1", 10, NOW);
    expect(store.getState().list[0].snoozedUntil).toBe("2026-11-27T10:10");
    store.getState().complete("id1", NOW);
    // 완료는 지금 울릴 예정인 차례를 넘긴다 → 다음 날
    expect(store.getState().list[0].at).toBe("2026-11-29T09:00");
    await store.getState().flush();
    expect(fake.writes[fake.writes.length - 1]).toEqual({
      schemaVersion: 1,
      reminders: store.getState().list,
    });
  });

  it("reports a save failure and keeps the change for the next try", async () => {
    const fake = fakeStorage();
    fake.storage.writeReminders.mockRejectedValueOnce(new Error("disk full"));
    const store = createRemindersStore(fake.storage, { debounceMs: 0, newId: () => "x" });
    await store.getState().load();
    store
      .getState()
      .add({ kind: "timer", target: { type: "none" }, label: "t", durationSec: 60 }, NOW);
    await store.getState().flush();
    expect(store.getState().saveError).toBe(true);
    await store.getState().flush();
    expect(store.getState().saveError).toBe(false);
    expect(fake.writes).toHaveLength(1);
  });

  it("returns null for an invalid new reminder", async () => {
    const { store } = make();
    expect(
      store.getState().add({ kind: "alarm", target: { type: "none" }, label: "", at: "nope" }, NOW),
    ).toBeNull();
  });
});

describe("remindersFor and collectDue", () => {
  const base = (over: Partial<Reminder>): Reminder => ({
    id: "r",
    kind: "alarm",
    target: { type: "page", id: "p1" },
    label: "",
    at: "2026-11-27T09:00",
    createdAt: "2026-11-26T00:00:00.000Z",
    ...over,
  });

  it("selects by target, skipping done items, in due order", () => {
    const list = [
      base({ id: "late", at: "2026-11-27T12:00" }),
      base({ id: "early", at: "2026-11-27T09:30" }),
      base({ id: "done", done: true }),
      base({ id: "other", target: { type: "page", id: "p2" } }),
      base({ id: "quick", target: { type: "quickNote", id: "p1" } }),
    ];
    expect(remindersFor(list, { type: "page", id: "p1" }).map((r) => r.id)).toEqual([
      "early",
      "late",
    ]);
  });

  it("fires each due occurrence once, and a snoozed or repeated one again", () => {
    const seen = new Set<string>();
    const fired = { has: (k: string) => seen.has(k), add: (k: string) => void seen.add(k) };
    const r = base({ at: "2026-11-27T09:00" });
    expect(collectDue([r], NOW, fired)).toHaveLength(1);
    expect(collectDue([r], NOW, fired)).toHaveLength(0);
    const snoozed = { ...r, snoozedUntil: "2026-11-27T10:05" };
    expect(collectDue([snoozed], NOW, fired)).toHaveLength(0);
    expect(collectDue([snoozed], new Date(2026, 10, 27, 10, 5), fired)).toHaveLength(1);
    expect(reminderFireKey(snoozed)).not.toBe(reminderFireKey(r));
  });
});
