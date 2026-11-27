import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reminder } from "./model";
import { formatLocal } from "./model";
import {
  formatTrayAlarmWhen,
  formatTrayTimer,
  nearestTimerLeft,
  startTrayTimerStatus,
  upcomingTrayLines,
} from "./tray-timer";

const NOW = new Date(2026, 10, 27, 10, 0, 0);

/** 지금부터 `leftSec`초 뒤에 끝나는 타이머 (createdAt + durationSec 규칙) */
function timer(leftSec: number, extra: Partial<Reminder> = {}): Reminder {
  const durationSec = 600;
  const createdAt = new Date(NOW.getTime() + leftSec * 1000 - durationSec * 1000).toISOString();
  return {
    id: `t${leftSec}`,
    kind: "timer",
    label: "",
    at: "",
    durationSec,
    createdAt,
    ...extra,
  } as unknown as Reminder;
}

describe("메뉴 막대 타이머 (SYS-16)", () => {
  it("1시간 미만은 mm:ss, 그 이상은 h:mm:ss로 보인다", () => {
    expect(formatTrayTimer(0)).toBe("00:00");
    expect(formatTrayTimer(65)).toBe("01:05");
    expect(formatTrayTimer(1199)).toBe("19:59");
    expect(formatTrayTimer(3600)).toBe("1:00:00");
    expect(formatTrayTimer(3723)).toBe("1:02:03");
    expect(formatTrayTimer(-5)).toBe("00:00");
  });

  it("달리는 타이머 중 가장 먼저 끝나는 것의 남은 초를 고른다. 끝났거나 끝난 표시가 있으면 뺀다", () => {
    const list = [timer(300), timer(120), timer(-10), timer(30, { done: true })];
    expect(nearestTimerLeft(list, NOW)).toBe(120);
  });

  it("달리는 타이머가 없으면 null", () => {
    expect(nearestTimerLeft([], NOW)).toBeNull();
    expect(nearestTimerLeft([timer(-1)], NOW)).toBeNull();
  });
});

describe("startTrayTimerStatus", () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));
  afterEach(() => vi.useRealTimers());

  it("1초마다 가장 가까운 타이머를 보내고, 글자가 바뀔 때만 보낸다. 없어지면 지운다", async () => {
    let list: Reminder[] = [timer(65)];
    const send = vi.fn<(text: string | null) => Promise<void>>(() => Promise.resolve());
    const stop = startTrayTimerStatus({
      list: () => list,
      now: () => new Date(),
      send,
      sendUpcoming: vi.fn(() => Promise.resolve()),
    });
    expect(send).toHaveBeenLastCalledWith("01:05");

    await vi.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenLastCalledWith("01:04");

    list = [];
    await vi.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenLastCalledWith(null);
    const calls = send.mock.calls.length;

    await vi.advanceTimersByTimeAsync(3000);
    expect(send.mock.calls.length).toBe(calls);
    stop();
  });
});

/** 지금부터 `addMin`분 뒤에 울리는 알람 */
function alarm(at: Date, label = "", extra: Partial<Reminder> = {}): Reminder {
  return {
    id: `a${at.getTime()}`,
    kind: "alarm",
    label,
    at: formatLocal(at),
    target: { type: "none" },
    createdAt: new Date(NOW.getTime() - 60_000).toISOString(),
    ...extra,
  } as unknown as Reminder;
}

describe("다가오는 알림 줄 (SYS-16)", () => {
  it("오늘은 시각만, 내일과 그 밖은 날짜를 붙인다", () => {
    expect(formatTrayAlarmWhen(new Date(2026, 10, 27, 15, 1), NOW)).toBe("15:01");
    expect(formatTrayAlarmWhen(new Date(2026, 10, 28, 9, 0), NOW)).toMatch(/9:00$/);
    expect(formatTrayAlarmWhen(new Date(2026, 11, 3, 9, 0), NOW)).toMatch(/12월 3일 9:00$/);
  });

  it("끝나지 않은 알람만 울릴 시각 순으로 최대 3줄, 라벨 없으면 기본 이름", () => {
    const list = [
      alarm(new Date(2026, 10, 27, 15, 1), "물 마시기"),
      alarm(new Date(2026, 10, 27, 12, 30)),
      alarm(new Date(2026, 10, 27, 8, 0), "지난 알람"),
      alarm(new Date(2026, 10, 27, 18, 0), "done", { done: true }),
      alarm(new Date(2026, 10, 27, 11, 0), "회의"),
      alarm(new Date(2026, 10, 27, 20, 0), "저녁"),
      timer(300),
    ];
    const lines = upcomingTrayLines(list, NOW);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("11:00 회의");
    expect(lines[1]).toMatch(/^12:30 \S/);
    expect(lines[1]).not.toBe("12:30 ");
    expect(lines[2]).toBe("15:01 물 마시기");
  });

  it("보낼 줄이 바뀔 때만 보낸다", async () => {
    vi.useFakeTimers({ now: NOW });
    const list: Reminder[] = [alarm(new Date(2026, 10, 27, 15, 1), "물 마시기")];
    const sendUpcoming = vi.fn<(items: string[]) => Promise<void>>(() => Promise.resolve());
    const stop = startTrayTimerStatus({
      list: () => list,
      now: () => NOW,
      send: () => Promise.resolve(),
      sendUpcoming,
    });
    await vi.advanceTimersByTimeAsync(3000);
    expect(sendUpcoming).toHaveBeenCalledTimes(1);
    expect(sendUpcoming).toHaveBeenLastCalledWith(["15:01 물 마시기"]);
    stop();
    vi.useRealTimers();
  });
});
