import { describe, expect, it, vi } from "vitest";
import { createReminder } from "./model";
import { StoreReminderScheduler } from "./store-scheduler";

const target = { type: "none" } as const;

function setup(clock: { t: Date }, fired = new Set<string>()) {
  const send = vi.fn(async () => "sent" as const);
  const onFallback = vi.fn();
  const onMissed = vi.fn();
  const sched = new StoreReminderScheduler({
    now: () => clock.t,
    setTimer: () => 0,
    clearTimer: () => undefined,
    permission: async () => "granted",
    send,
    fired: { has: (k) => fired.has(k), add: (k) => void fired.add(k) },
    onFallback,
    onMissed,
  });
  return { sched, send, onFallback, onMissed };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("StoreReminderScheduler", () => {
  it("켜진 상태에서 울린 알림은 OS 알림으로 한 번 보낸다", async () => {
    const clock = { t: new Date(2026, 10, 27, 10, 0) };
    const { sched, send, onMissed } = setup(clock);
    const rem = createReminder(
      { id: "a", kind: "alarm", target, label: "회의", at: "2026-11-27T10:05" },
      clock.t,
    )!;
    sched.setList([rem]);
    clock.t = new Date(2026, 10, 27, 10, 6);
    sched.wake();
    sched.wake();
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ title: "회의", body: "오늘 10:05" });
    expect(onMissed).not.toHaveBeenCalled();
  });

  it("앱이 꺼져 있던 동안 지난 반복 알림은 가장 최근 울림 하나만 놓친 알림으로 올린다", async () => {
    const clock = { t: new Date(2026, 10, 27, 12, 0) };
    const rem = createReminder(
      { id: "r", kind: "alarm", target, label: "물", at: "2026-11-24T09:00", repeat: "day" },
      new Date(2026, 10, 23),
    )!;
    const { sched, onMissed, send } = setup(clock);
    sched.setList([rem]);
    await flush();
    expect(onMissed).toHaveBeenCalledTimes(1);
    const items = onMissed.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0].at).toEqual(new Date(2026, 10, 27, 9, 0));
    expect(send).not.toHaveBeenCalled();
  });

  it("이미 보낸 알림은 다시 보내지 않는다", async () => {
    const clock = { t: new Date(2026, 10, 27, 10, 6) };
    const rem = createReminder(
      { id: "a", kind: "alarm", target, label: "", at: "2026-11-27T10:05" },
      new Date(2026, 10, 27, 10, 0),
    )!;
    const { sched, send } = setup(clock, new Set([`a|${new Date(2026, 10, 27, 10, 5).getTime()}`]));
    sched.setList([rem]);
    await flush();
    expect(send).not.toHaveBeenCalled();
  });

  describe("포커스 밖 알림 패널 (SYS-16)", () => {
    function live(focused: boolean) {
      const clock = { t: new Date(2026, 10, 27, 10, 0) };
      const send = vi.fn(async () => "sent" as const);
      const onUnfocused = vi.fn();
      const onFocused = vi.fn();
      const sched = new StoreReminderScheduler({
        now: () => clock.t,
        setTimer: () => 0,
        clearTimer: () => undefined,
        permission: async () => "granted",
        send,
        fired: { has: () => false, add: () => undefined },
        isFocused: () => focused,
        onFocused,
        onUnfocused,
      });
      clock.t = new Date(2026, 10, 27, 10, 5);
      const rem = createReminder(
        { id: "a", kind: "alarm", target, label: "물", at: "2026-11-27T10:05" },
        new Date(2026, 10, 27, 10, 0),
      )!;
      return { sched, rem, send, onUnfocused, onFocused };
    }

    it("포커스 밖에서 울리면 OS 알림과 함께 onUnfocused에 id를 넘긴다", async () => {
      const { sched, rem, send, onUnfocused, onFocused } = live(false);
      sched.setList([rem]);
      await flush();
      expect(onUnfocused).toHaveBeenCalledTimes(1);
      expect(onUnfocused.mock.calls[0][0][0].rem.id).toBe("a");
      expect(send).toHaveBeenCalledTimes(1);
      expect(onFocused).not.toHaveBeenCalled();
    });

    it("보고 있는 창에서는 onUnfocused를 부르지 않고 대화상자로 간다", async () => {
      const { sched, rem, send, onUnfocused, onFocused } = live(true);
      sched.setList([rem]);
      await flush();
      expect(onUnfocused).not.toHaveBeenCalled();
      expect(onFocused).toHaveBeenCalledTimes(1);
      expect(send).not.toHaveBeenCalled();
    });
  });
});
