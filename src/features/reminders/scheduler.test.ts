import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DateReminder } from "../../lib/dates/collect-reminders";
import { createFiredStore, FIRED_MAX } from "./fired-store";
import {
  ReminderScheduler,
  reminderKey,
  TICK_MS,
  type FiredStore,
  type ReminderSchedulerDeps,
} from "./scheduler";

const PAGE = "01JD0000000000000000000000";
const item = (over: Partial<DateReminder> = {}): DateReminder => ({
  pageId: PAGE,
  date: "2026-11-24",
  time: "10:00",
  rule: { kind: "custom", time: "10:00" },
  done: false,
  ...over,
});

function setup(
  opts: {
    perm?: "granted" | "default" | "denied" | "unsupported";
    send?: "sent" | "failed";
    fired?: FiredStore;
    now?: Date;
  } = {},
) {
  const fired =
    opts.fired ??
    createFiredStore(
      () => null,
      () => {},
    );
  const sent: unknown[] = [];
  const fallback: unknown[][] = [];
  const missed: unknown[][] = [];
  const needed = vi.fn();
  const deps: ReminderSchedulerDeps = {
    now: () => new Date(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    permission: async () => opts.perm ?? "granted",
    send: async (n) => {
      sent.push(n);
      return opts.send ?? "sent";
    },
    fired,
    pageTitle: () => "회의록",
    onPermissionNeeded: needed,
    onFallback: (items) => fallback.push(items),
    onMissed: (items) => missed.push(items),
  };
  const s = new ReminderScheduler(deps);
  return { s, sent, fallback, missed, needed, fired };
}

/** 비동기 콜백(권한 확인 · 발송)이 끝나도록 기다린다 */
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("ReminderScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 24, 9, 0, 0)); // 2026-11-24 09:00 로컬
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("시각이 되면 OS 알림을 한 번 보낸다 (제목 = 페이지, 본문 = 날짜 표시)", async () => {
    const { s, sent } = setup();
    s.setPage(PAGE, [item()]);
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0, 0));
    vi.advanceTimersByTime(60_000);
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ pageId: PAGE, title: "회의록" });
    expect((sent[0] as { body: string }).body).toContain("10:00");
  });

  it("같은 알림은 다시 울리지 않는다 (재계획·깨어남 뒤에도)", async () => {
    const { s, sent } = setup();
    s.setPage(PAGE, [item()]);
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0, 0));
    vi.advanceTimersByTime(60_000);
    await flush();
    s.setPage(PAGE, [item()]);
    s.wake();
    vi.advanceTimersByTime(120_000);
    await flush();
    expect(sent).toHaveLength(1);
  });

  it("완료한 날짜 칩은 울리지 않는다", async () => {
    const { s, sent } = setup();
    s.setPage(PAGE, [item({ done: true })]);
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0, 0));
    vi.advanceTimersByTime(60_000);
    await flush();
    expect(sent).toHaveLength(0);
  });

  it("권한이 없으면 앱 안 알림으로 대신하고, 권한 안내는 한 번만 한다", async () => {
    const { s, sent, fallback, needed } = setup({ perm: "default" });
    s.setPage(PAGE, [item()]);
    s.setPage(PAGE, [item()]);
    await flush();
    expect(needed).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0, 0));
    vi.advanceTimersByTime(60_000);
    await flush();
    expect(sent).toHaveLength(0);
    expect(fallback).toHaveLength(1);
    expect(fallback[0]).toEqual([expect.objectContaining({ title: "회의록" })]);
  });

  it("OS 알림 발송이 실패하면 앱 안 알림으로 대신한다", async () => {
    const { s, fallback } = setup({ send: "failed" });
    s.setPage(PAGE, [item()]);
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0, 0));
    vi.advanceTimersByTime(60_000);
    await flush();
    expect(fallback).toHaveLength(1);
  });

  it("앱이 꺼져 있던 동안 지난 알림은 놓친 목록으로 한 번 보여 준다", () => {
    // 앱을 12시에 켰다. 10시 알림은 보낸 표시가 없으므로 놓친 것이다
    vi.setSystemTime(new Date(2026, 10, 24, 12, 0, 0));
    const { s, missed } = setup();
    s.setPage(PAGE, [item()]);
    expect(missed).toHaveLength(1);
    expect(missed[0]).toEqual([expect.objectContaining({ title: "회의록" })]);
    // 한 번 보여 준 뒤에는 다시 올리지 않는다
    s.wake();
    s.setPage(PAGE, [item()]);
    expect(missed).toHaveLength(1);
  });

  it("보낸 표시가 있는 지난 알림은 다시 올리지 않는다", () => {
    vi.setSystemTime(new Date(2026, 10, 24, 12, 0, 0));
    const fired = createFiredStore(
      () => null,
      () => {},
    );
    fired.add(reminderKey(item()));
    const { s, missed } = setup({ fired });
    s.setPage(PAGE, [item()]);
    expect(missed).toHaveLength(0);
  });

  it("실행 뒤에 정한 과거 시각은 놓친 알림이 아니다 (조용히 넘어간다)", () => {
    // 앱은 9시에 켜졌고, 10시에 9시 30분 알림을 정했다
    const { s, missed, sent, fallback } = setup();
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0, 0));
    s.setPage(PAGE, [item({ time: "09:30", rule: { kind: "custom", time: "09:30" } })]);
    expect(missed).toHaveLength(0);
    expect(sent).toHaveLength(0);
    expect(fallback).toHaveLength(0);
  });

  it("페이지 목록에서 빠진 알림은 취소된다", async () => {
    const { s, sent } = setup();
    s.setPage(PAGE, [item()]);
    s.removePage(PAGE);
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0, 0));
    vi.advanceTimersByTime(60_000);
    await flush();
    expect(sent).toHaveLength(0);
  });

  it("워크스페이스를 바꾸면(reset) 예약이 모두 지워진다", async () => {
    const { s, sent } = setup();
    s.setPage(PAGE, [item()]);
    s.reset();
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0, 0));
    vi.advanceTimersByTime(60_000 * 5);
    await flush();
    expect(sent).toHaveLength(0);
  });

  it("먼 미래 알림도 TICK 간격으로 깨어나며 정확한 시각에 보낸다", async () => {
    const { s, sent } = setup();
    s.setPage(PAGE, [
      item({ date: "2026-11-25", time: "09:00", rule: { kind: "custom", time: "09:00" } }),
    ]);
    vi.advanceTimersByTime(TICK_MS * 60 * 23); // 하루 이상 뒤
    await flush();
    expect(sent).toHaveLength(0);
    vi.setSystemTime(new Date(2026, 10, 25, 9, 0, 0));
    vi.advanceTimersByTime(TICK_MS);
    await flush();
    expect(sent).toHaveLength(1);
  });

  it("키는 페이지·날짜·시각·규칙으로 정해진다", () => {
    const a = reminderKey(item());
    expect(reminderKey(item({ time: "11:00" }))).not.toBe(a);
    expect(reminderKey(item({ rule: { kind: "morning" } }))).not.toBe(a);
  });
});

describe("createFiredStore", () => {
  it("저장소 값을 읽고 쓰며, 실패해도 메모리에서 중복을 막는다", () => {
    const writes: string[] = [];
    const store = createFiredStore(
      () => JSON.stringify(["a"]),
      (v) => writes.push(v),
    );
    expect(store.has("a")).toBe(true);
    store.add("b");
    expect(store.has("b")).toBe(true);
    expect(JSON.parse(writes[writes.length - 1]!)).toEqual(["a", "b"]);
    const broken = createFiredStore(
      () => {
        throw new Error("denied");
      },
      () => {
        throw new Error("quota");
      },
    );
    expect(() => broken.add("x")).not.toThrow();
    expect(broken.has("x")).toBe(true);
  });

  it("상한을 넘으면 가장 오래된 것부터 버린다", () => {
    const store = createFiredStore(
      () => null,
      () => {},
    );
    for (let i = 0; i < FIRED_MAX + 3; i++) store.add(`k${i}`);
    expect(store.has("k0")).toBe(false);
    expect(store.has(`k${FIRED_MAX + 2}`)).toBe(true);
  });
});
