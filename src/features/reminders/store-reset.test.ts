import { describe, expect, it, vi } from "vitest";
import { createRemindersStore } from "./store";
import type { Reminder } from "./model";

const item = (id: string): Reminder => ({
  id,
  kind: "alarm",
  target: { type: "page", id: "p1" },
  label: id,
  at: "2026-11-28T09:00",
  createdAt: "2026-11-27T09:00:00",
});

const file = (list: Reminder[]) => ({ schemaVersion: 1, reminders: list });

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createRemindersStore workspace switch", () => {
  it("reset writes pending edits to the current workspace before clearing", async () => {
    const writes: unknown[] = [];
    const storage = {
      readReminders: vi.fn(async () => file([])),
      writeReminders: vi.fn(async (v: unknown) => {
        writes.push(v);
      }),
    };
    const store = createRemindersStore(storage, { debounceMs: 60_000, newId: () => "x" });
    await store.getState().load();
    store
      .getState()
      .add(
        { kind: "alarm", target: { type: "page", id: "p1" }, label: "a", at: "2026-11-28T09:00" },
        new Date(2026, 10, 27, 10),
      );

    await store.getState().reset();

    expect(writes).toHaveLength(1);
    expect(store.getState().list).toEqual([]);
    expect(store.getState().loaded).toBe(false);
  });

  it("ignores a load that resolves after a reset (stale workspace)", async () => {
    const pending = deferred<unknown>();
    const storage = {
      readReminders: vi.fn(() => pending.promise),
      writeReminders: vi.fn(async () => undefined),
    };
    const store = createRemindersStore(storage, { debounceMs: 0 });
    const loading = store.getState().load();
    await store.getState().reset();
    pending.resolve(file([item("old")]));
    await loading;

    expect(store.getState().list).toEqual([]);
    expect(store.getState().loaded).toBe(false);
  });

  it("does not report a save error from a write that started before the switch", async () => {
    const pending = deferred<void>();
    const storage = {
      readReminders: vi.fn(async () => file([])),
      writeReminders: vi.fn(() => pending.promise),
    };
    const store = createRemindersStore(storage, { debounceMs: 60_000, newId: () => "x" });
    await store.getState().load();
    store
      .getState()
      .add(
        { kind: "alarm", target: { type: "page", id: "p1" }, label: "a", at: "2026-11-28T09:00" },
        new Date(2026, 10, 27, 10),
      );
    const flushing = store.getState().flush();
    await store.getState().reset();
    pending.reject(new Error("disk"));
    await flushing;

    expect(store.getState().saveError).toBe(false);
  });
});
