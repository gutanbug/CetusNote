import { describe, expect, it, vi } from "vitest";
import type { Page } from "@/lib/storage";
import { StorageError } from "@/lib/storage";
import { createSaveQueue } from "./save-queue";

const page = (id: string) => ({ id }) as unknown as Page;

describe("워크스페이스가 바뀐 뒤 도착한 쓰기 (DATA-03)", () => {
  it("stale_workspace는 다시 쓰지 않고 한 번만 시도한 뒤 오류로 남긴다", async () => {
    const write = vi.fn().mockRejectedValue(new StorageError("stale_workspace", "x"));
    const q = createSaveQueue({ write, delay: 0 });
    q.schedule(page("p1"));
    await vi.waitFor(() => expect(q.state).toBe("error"));
    expect(q.hasUnsaved).toBe(false);
    expect(await q.flush()).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("일반 오류는 내용을 들고 있다가 다시 쓴다", async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(new StorageError("disk_full", "x"))
      .mockResolvedValue(undefined);
    const q = createSaveQueue({ write, delay: 0 });
    q.schedule(page("p1"));
    await vi.waitFor(() => expect(q.state).toBe("error"));
    expect(await q.retry()).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
  });
});
