import { describe, expect, it, vi, afterEach } from "vitest";
import { createSaveQueue } from "./save-queue";

afterEach(() => vi.useRealTimers());

describe("save queue 자동 재시도 (DATA-02)", () => {
  it("실패하면 2초·5초 뒤 다시 쓰고, 성공하면 저장됨으로 돌아간다", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const states: string[] = [];
    const q = createSaveQueue({
      write: async () => {
        calls++;
        if (calls <= 2) throw new Error("disk");
      },
      delay: 0,
      generation: () => 1,
      onStateChange: (s) => states.push(s),
    });
    q.schedule({ id: "01JD0000000000000000000000" } as never);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    expect(q.state).toBe("error");
    await vi.advanceTimersByTimeAsync(1_999);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(2);
    expect(q.state).toBe("error");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(calls).toBe(3);
    expect(q.state).toBe("saved");
    expect(states).toContain("error");
  });
});
