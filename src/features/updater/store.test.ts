import { msg } from "@/lib/i18n";
import { createFakeUpdater } from "@/lib/updater/fake";
import { describe, expect, it, vi } from "vitest";
import { createAutoChecker } from "./schedule";
import { createUpdaterStore } from "./store";
import { updateView } from "./view";
import { CHECK_INTERVAL_MS } from "./version";

const NEW = { version: "0.2.0", notes: null, date: null };

function make(opts: Parameters<typeof createFakeUpdater>[0] = {}, flush = async () => true) {
  let clock = 1_000_000_000;
  const updater = createFakeUpdater(opts);
  const store = createUpdaterStore({ updater, flush, now: () => clock });
  return {
    updater,
    store,
    now: () => clock,
    advance: (ms: number) => (clock += ms),
  };
}

describe("업데이트 상태 전이 (SYS-07)", () => {
  it("새 버전이 있으면 available이 되고 정보를 든다", async () => {
    const { store } = make({ latest: NEW });
    const r = await store.getState().check();
    expect(r).toEqual({ kind: "available", update: NEW });
    expect(store.getState()).toMatchObject({ status: "available", currentVersion: "0.1.0" });
    expect(store.getState().update).toEqual(NEW);
  });

  it("현재 버전과 같거나 낮으면 최신 버전이에요", async () => {
    const { store } = make({ latest: { version: "0.1.0", notes: null, date: null } });
    expect(await store.getState().check()).toEqual({ kind: "latest" });
    expect(store.getState()).toMatchObject({ status: "latest", update: null });
  });

  it("수동 확인이 실패하면 오류와 다시 시도를 보여 준다", async () => {
    const { store } = make({ checkError: "net down" });
    const r = await store.getState().check();
    expect(r).toEqual({ kind: "error", message: msg().features.updater.checkError });
    expect(store.getState()).toMatchObject({
      status: "error",
      errorStep: "check",
      error: msg().features.updater.checkError,
    });
    expect(updateView(store.getState())).toMatchObject({ action: "retry", error: true });
  });

  it("자동 확인이 실패하면 조용히 넘기고 이전 상태를 그대로 둔다", async () => {
    const { store, updater } = make({ latest: NEW });
    await store.getState().check();
    vi.spyOn(updater, "check").mockRejectedValueOnce(new Error("net down"));
    await store.getState().check({ silent: true });
    expect(store.getState()).toMatchObject({ status: "available", error: null });
  });

  it("내려받기 진행률을 0–100으로 올리고, 저장을 마친 뒤 다시 연다", async () => {
    const flush = vi.fn(async () => true);
    const { store, updater } = make({ latest: NEW, steps: 2 }, flush);
    await store.getState().check();
    const seen: (number | null)[] = [];
    const unsub = store.subscribe((s) => {
      // 저장 단계 표시(finishing)로 같은 진행률이 다시 올 수 있어 값이 바뀔 때만 모은다
      if (s.status === "downloading" && s.progress !== seen[seen.length - 1]) {
        seen.push(s.progress);
      }
    });
    await store.getState().install();
    unsub();
    expect(seen).toEqual([null, 50, 100]);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(updater.relaunched).toBe(true);
  });

  it("저장하지 못하면 다시 열지 않고 알린다", async () => {
    const { store, updater } = make({ latest: NEW }, async () => false);
    await store.getState().check();
    await store.getState().install();
    expect(updater.relaunched).toBe(false);
    expect(store.getState()).toMatchObject({
      status: "error",
      errorStep: "install",
      error: msg().features.updater.saveBeforeRestart,
    });
  });

  it("내려받기가 실패하면 설치 단계 오류로 남고 다시 시도는 설치다", async () => {
    const { store } = make({ latest: NEW, installError: "disk" });
    await store.getState().check();
    await store.getState().install();
    expect(store.getState()).toMatchObject({
      status: "error",
      errorStep: "install",
      error: msg().features.updater.installError,
    });
    expect(updateView(store.getState())).toMatchObject({
      action: "retry",
      actionLabel: "다시 시도",
    });
  });

  it("내려받기가 끝나 저장하는 동안에는 설치 완료 문구를 보인다", async () => {
    let during: ReturnType<typeof updateView> | null = null;
    const { store } = make({ latest: NEW, steps: 2 }, async () => {
      during = updateView(store.getState());
      return true;
    });
    await store.getState().check();
    await store.getState().install();
    expect(during).toMatchObject({ message: "설치하고 다시 여는 중이에요", busy: true });
  });

  it("앱을 다시 여는 데 실패하면 relaunch 오류로 남고, 다시 설치하지 않는다", async () => {
    const { store, updater } = make({ latest: NEW, relaunchError: "x" });
    await store.getState().check();
    const install = vi.spyOn(updater, "downloadAndInstall");
    await store.getState().install();
    expect(install).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({
      status: "error",
      errorStep: "relaunch",
      error: msg().features.updater.relaunchError,
    });
    expect(updateView(store.getState())).toMatchObject({
      action: "none",
      message: msg().features.updater.relaunchError,
      error: true,
    });
  });

  it("확인 중에 또 확인하면 같은 요청을 기다린다", async () => {
    const { store, updater } = make({ latest: NEW });
    const spy = vi.spyOn(updater, "check");
    const a = store.getState().check();
    const b = store.getState().check();
    await Promise.all([a, b]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("내려받는 중에 설치를 또 부르면 새로 내려받지 않고, 같은 요청이 끝날 때까지 기다린다", async () => {
    const { store, updater } = make({ latest: NEW, steps: 2, delayMs: 1 });
    await store.getState().check();
    const spy = vi.spyOn(updater, "downloadAndInstall");
    const first = store.getState().install();
    const second = store.getState().install();
    let secondDone = false;
    void second.then(() => (secondDone = true));
    await vi.waitFor(() => expect(store.getState().status).toBe("downloading"));
    expect(secondDone).toBe(false);
    await Promise.all([first, second]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(updater.relaunched).toBe(true);
  });
});

describe("자동 확인 (SYS-07)", () => {
  it("하루 안에는 다시 확인하지 않고, 하루가 지나면 다시 확인한다", async () => {
    const { store, updater, advance, now } = make({ latest: null });
    const spy = vi.spyOn(updater, "check");
    const auto = createAutoChecker({ store, enabled: () => true, notify: () => {}, now });
    auto.run();
    await vi.waitFor(() => expect(store.getState().status).toBe("latest"));
    auto.run();
    expect(spy).toHaveBeenCalledTimes(1);
    advance(CHECK_INTERVAL_MS);
    auto.run();
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });

  it("설정이 꺼져 있으면 확인하지 않는다", () => {
    const { store, updater } = make({ latest: NEW });
    const spy = vi.spyOn(updater, "check");
    createAutoChecker({ store, enabled: () => false, notify: () => {} }).run();
    expect(spy).not.toHaveBeenCalled();
  });

  it("같은 버전은 알림을 한 번만 띄운다", async () => {
    const { store } = make({ latest: NEW });
    const notify = vi.fn();
    const auto = createAutoChecker({ store, enabled: () => true, notify, now: () => 1 });
    auto.run();
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith("0.2.0"));
    store.setState({ checkedAt: null, status: "idle" });
    auto.run();
    await vi.waitFor(() => expect(store.getState().status).toBe("available"));
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
