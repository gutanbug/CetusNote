import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reminder } from "./model";
import { formatTrayTimer, nearestTimerLeft, startTrayTimerStatus } from "./tray-timer";

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
