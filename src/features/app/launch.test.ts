import { describe, expect, it, vi } from "vitest";
import { scheduleAutoBackup } from "./auto-backup";
import { createLaunchGate, openWorkspaceForLaunch } from "./open-order";

describe("워크스페이스 열기 뒤 준비 완료 (SYS-09)", () => {
  it("불러오기 단계가 하나라도 실패하면 준비 완료로 표시하지 않는다", async () => {
    const gate = createLaunchGate();
    const ok = await openWorkspaceForLaunch(
      "/w/A",
      [
        async () => {
          throw new Error("denied");
        },
        async () => {},
      ],
      gate,
      () => true,
    );
    expect(ok).toBe(false);
    expect(gate.isReady("/w/A")).toBe(false);
  });

  it("모든 단계가 성공하고 아직 현재 워크스페이스면 준비 완료", async () => {
    const gate = createLaunchGate();
    const ok = await openWorkspaceForLaunch("/w/A", [async () => {}], gate, () => true);
    expect(ok).toBe(true);
    expect(gate.isReady("/w/A")).toBe(true);
    expect(gate.isReady("/w/B")).toBe(false);
  });

  it("끝난 시점에 이미 다른 워크스페이스로 바뀌었으면 준비 완료로 보지 않는다", async () => {
    const gate = createLaunchGate();
    await openWorkspaceForLaunch("/w/A", [async () => {}], gate, () => false);
    expect(gate.isReady("/w/A")).toBe(false);
  });
});

describe("자동 백업 예약 (DATA-05)", () => {
  it("예약한 뒤 같은 워크스페이스면 백업한다", async () => {
    vi.useFakeTimers();
    const backup = vi.fn(async () => true);
    scheduleAutoBackup({ delay: 3000, isCurrent: () => true, backup, onFailed: vi.fn() });
    await vi.advanceTimersByTimeAsync(3000);
    expect(backup).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("기다리는 사이 워크스페이스가 바뀌었으면 백업하지 않는다", async () => {
    vi.useFakeTimers();
    let current = true;
    const backup = vi.fn(async () => true);
    scheduleAutoBackup({ delay: 3000, isCurrent: () => current, backup, onFailed: vi.fn() });
    current = false;
    await vi.advanceTimersByTimeAsync(3000);
    expect(backup).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("백업이 실패하면 한 번 알린다", async () => {
    vi.useFakeTimers();
    const onFailed = vi.fn();
    scheduleAutoBackup({
      delay: 3000,
      isCurrent: () => true,
      backup: async () => false,
      onFailed,
    });
    await vi.advanceTimersByTimeAsync(3000);
    expect(onFailed).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("취소하면 백업하지 않는다", async () => {
    vi.useFakeTimers();
    const backup = vi.fn(async () => true);
    const cancel = scheduleAutoBackup({
      delay: 3000,
      isCurrent: () => true,
      backup,
      onFailed: vi.fn(),
    });
    cancel();
    await vi.advanceTimersByTimeAsync(3000);
    expect(backup).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
