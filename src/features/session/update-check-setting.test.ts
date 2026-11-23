import { createMemoryStorage } from "@/lib/storage";
import { describe, expect, it, vi } from "vitest";
import { createSessionStore } from "./store";

describe("자동 업데이트 확인 설정 (SYS-07)", () => {
  it("기본은 켜짐이고, 끄면 설정 파일에 남아 다음 실행에 이어진다", async () => {
    const storage = createMemoryStorage();
    const a = createSessionStore(storage, { delay: 10 });
    await a.getState().load("/notes/A");
    expect(a.getState().autoUpdateCheck).toBe(true);

    a.getState().setAutoUpdateCheck(false);
    await a.getState().flush();
    expect(await storage.readSettings()).toMatchObject({ autoUpdateCheck: false });

    const b = createSessionStore(storage, { delay: 10 });
    await b.getState().load("/notes/A");
    expect(b.getState().autoUpdateCheck).toBe(false);
  });

  it("설정 값이 없거나 이상하면 켜짐으로 연다. 다른 설정 키는 지우지 않는다", async () => {
    const storage = createMemoryStorage();
    await storage.writeSettings({ theme: "dark", autoUpdateCheck: "no" });
    const s = createSessionStore(storage);
    await s.getState().load("/notes/A");
    expect(s.getState().autoUpdateCheck).toBe(true);

    s.getState().setAutoUpdateCheck(true);
    await s.getState().flush();
    expect(await storage.readSettings()).toMatchObject({ theme: "dark", autoUpdateCheck: true });
  });

  it("바꾸면 짧은 지연 뒤 저장된다", async () => {
    vi.useFakeTimers();
    try {
      const storage = createMemoryStorage();
      const s = createSessionStore(storage, { delay: 10 });
      await s.getState().load("/notes/A");
      s.getState().setAutoUpdateCheck(false);
      await vi.advanceTimersByTimeAsync(10);
      expect(await storage.readSettings()).toMatchObject({ autoUpdateCheck: false });
    } finally {
      vi.useRealTimers();
    }
  });
});
