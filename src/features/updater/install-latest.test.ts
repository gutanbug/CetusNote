import { describe, expect, it } from "vitest";
import type { UpdateInfo, Updater } from "@/lib/updater/types";
import { createUpdaterStore } from "./store";

const info = (version: string): UpdateInfo => ({ version, notes: null, date: null });

/** 서버의 최신 버전을 바꿀 수 있는 가짜 업데이트. 내려받기는 마지막 check()가 찾은 것을 받는다(실제 플러그인과 같다) */
function server(current: string, latest: string | null) {
  let now = latest;
  let pending: string | null = null;
  const installed: string[] = [];
  const updater: Updater = {
    currentVersion: async () => current,
    async check() {
      pending = now;
      return now ? info(now) : null;
    },
    async downloadAndInstall(onProgress) {
      if (!pending) throw new Error("확인된 업데이트가 없어요");
      installed.push(pending);
      onProgress(100);
    },
    relaunch: async () => {},
  };
  return { updater, installed, release: (v: string | null) => (now = v) };
}

describe("업데이트는 늘 지금의 최신 버전을 받는다 (SYS-07)", () => {
  it("0.1.5를 찾은 뒤 0.1.7이 나왔으면 설치할 때 0.1.7을 받는다", async () => {
    const s = server("0.1.4", "0.1.5");
    const store = createUpdaterStore({ updater: s.updater, flush: async () => true });
    await store.getState().check();
    expect(store.getState().update?.version).toBe("0.1.5");
    s.release("0.1.7");
    await store.getState().install();
    expect(s.installed).toEqual(["0.1.7"]);
    expect(store.getState().update?.version).toBe("0.1.7");
  });

  it("다시 확인해 보니 이미 최신이면 설치하지 않고 최신 상태로 둔다", async () => {
    const s = server("0.1.7", "0.1.8");
    const store = createUpdaterStore({ updater: s.updater, flush: async () => true });
    await store.getState().check();
    s.release(null);
    await store.getState().install();
    expect(s.installed).toEqual([]);
    expect(store.getState().status).toBe("latest");
  });

  it("다시 확인이 실패하면 찾아 둔 업데이트로 진행한다", async () => {
    const s = server("0.1.4", "0.1.6");
    const store = createUpdaterStore({ updater: s.updater, flush: async () => true });
    await store.getState().check();
    const check = s.updater.check;
    s.updater.check = async () => {
      throw new Error("offline");
    };
    await store.getState().install();
    s.updater.check = check;
    expect(s.installed).toEqual(["0.1.6"]);
  });
});
