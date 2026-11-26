import { createFakeUpdater } from "@/lib/updater/fake";
import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { INSTALL_ERROR_MESSAGE, RELAUNCH_ERROR_MESSAGE, createUpdaterStore } from "./store";
import { UPDATE_TOAST_ID, announceUpdateToast, runInstallWithToast } from "./announce";

const toastMock = vi.hoisted(() => {
  const fn = vi.fn();
  return Object.assign(fn, { error: vi.fn(), dismiss: vi.fn() });
});

const openLinkMock = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@/components/ui/toast", () => ({
  toast: toastMock,
  // 테스트에서는 요소의 props(onClick)만 읽으면 되므로 함수 자체를 돌려준다
  ToastCancelButton: (props: unknown) => props,
}));

vi.mock("@/lib/storage/open-link", () => ({ openLink: openLinkMock }));

const NEW = { version: "0.2.0", notes: null, date: null };

type Opts = {
  id?: string;
  duration?: number;
  dismissible?: boolean;
  action?: { label: string; onClick: (e: { preventDefault: () => void }) => void };
  cancel?: unknown;
};

/** 마지막으로 토스트에 넘긴 옵션 */
function lastOpts(mock: typeof toastMock | typeof toastMock.error): Opts {
  const calls = mock.mock.calls;
  return calls[calls.length - 1]?.[1] as Opts;
}

function clickCancel(opts: Opts) {
  if (!isValidElement(opts.cancel)) throw new Error("닫기 버튼이 없어요");
  (opts.cancel as ReactElement<{ onClick: () => void }>).props.onClick();
}

const preventDefault = () => {};

beforeEach(() => {
  toastMock.mockClear();
  toastMock.error.mockClear();
  toastMock.dismiss.mockClear();
});

describe("새 버전 토스트 (SYS-07)", () => {
  it("자동으로 사라지지 않고, 밀어서 닫을 수도 없다", () => {
    const store = createUpdaterStore({
      updater: createFakeUpdater({ latest: NEW }),
      flush: async () => true,
    });
    announceUpdateToast(store, "0.2.0");
    expect(toastMock).toHaveBeenCalledWith("새 버전 0.2.0이 나왔어요", expect.any(Object));
    expect(lastOpts(toastMock)).toMatchObject({
      id: UPDATE_TOAST_ID,
      duration: Infinity,
      dismissible: false,
      action: { label: "업데이트" },
    });
  });

  it("릴리스 보기는 새 버전의 GitHub 릴리스를 열고 토스트를 지운다 (SYS-12)", () => {
    const store = createUpdaterStore({
      updater: createFakeUpdater({ latest: NEW }),
      flush: async () => true,
    });
    announceUpdateToast(store, "0.2.0");
    const opts = lastOpts(toastMock);
    expect(isValidElement(opts.cancel)).toBe(true);
    expect((opts.cancel as ReactElement<{ children: string }>).props.children).toBe("릴리스 보기");
    clickCancel(opts);
    expect(openLinkMock).toHaveBeenCalledWith(
      "https://github.com/gutanbug/CetusNote/releases/tag/v0.2.0",
    );
    expect(toastMock.dismiss).toHaveBeenCalledWith(UPDATE_TOAST_ID);
  });

  it("업데이트를 누르면 토스트를 지우지 않고 내려받아 다시 연다", async () => {
    const updater = createFakeUpdater({ latest: NEW, steps: 2 });
    const store = createUpdaterStore({ updater, flush: async () => true });
    await store.getState().check();
    announceUpdateToast(store, "0.2.0");
    const event = { preventDefault: vi.fn() };
    lastOpts(toastMock).action?.onClick(event);
    expect(event.preventDefault).toHaveBeenCalled();
    await vi.waitFor(() => expect(updater.relaunched).toBe(true));
  });
});

describe("내려받기 진행 토스트 (SYS-07)", () => {
  it("진행률을 같은 토스트에 보여 주고, 버튼은 남기지 않는다", async () => {
    const updater = createFakeUpdater({ latest: NEW, steps: 2 });
    const store = createUpdaterStore({ updater, flush: async () => true });
    await store.getState().check();
    runInstallWithToast(store);
    await vi.waitFor(() => expect(updater.relaunched).toBe(true));
    // 내려받기 토스트 본문은 「글 + 진행률 막대」 요소다. 글만 꺼내 비교하고, 막대 값도 확인한다
    const messages = toastMock.mock.calls.map((c) =>
      typeof c[0] === "string" ? c[0] : c[0].props.children[0].props.children,
    );
    const bar50 = toastMock.mock.calls.find(
      (c) =>
        typeof c[0] !== "string" && c[0].props.children[0].props.children === "내려받는 중 50%",
    );
    expect(bar50?.[0].props.children[1].props.value).toBe(50);
    expect(messages).toEqual(
      expect.arrayContaining([
        "내려받는 중이에요",
        "내려받는 중 50%",
        "내려받는 중 100%",
        "설치하고 다시 여는 중이에요",
      ]),
    );
    for (const call of toastMock.mock.calls) {
      expect(call[1]).toMatchObject({
        id: UPDATE_TOAST_ID,
        duration: Infinity,
        dismissible: false,
        action: undefined,
      });
      expect(isValidElement(call[1].cancel)).toBe(true);
    }
  });

  it("닫기를 누르면 토스트는 사라지고, 내려받기는 계속돼 다시 띄우지 않는다", async () => {
    const updater = createFakeUpdater({ latest: NEW, steps: 2, delayMs: 5 });
    const store = createUpdaterStore({ updater, flush: async () => true });
    await store.getState().check();
    runInstallWithToast(store);
    clickCancel(lastOpts(toastMock));
    expect(toastMock.dismiss).toHaveBeenCalledWith(UPDATE_TOAST_ID);
    const calls = toastMock.mock.calls.length;
    await vi.waitFor(() => expect(updater.relaunched).toBe(true));
    expect(toastMock.mock.calls.length).toBe(calls);
    expect(store.getState().progress).toBe(100);
  });

  it("앱을 다시 여는 데 실패하면 닫기만 남기고 다시 시도는 없다", async () => {
    const updater = createFakeUpdater({ latest: NEW, relaunchError: "relaunch" });
    const store = createUpdaterStore({ updater, flush: async () => true });
    await store.getState().check();
    runInstallWithToast(store);
    await vi.waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(toastMock.error).toHaveBeenCalledWith(RELAUNCH_ERROR_MESSAGE, expect.any(Object));
    const opts = lastOpts(toastMock.error);
    expect(opts).toMatchObject({ id: UPDATE_TOAST_ID, action: undefined });
    expect(isValidElement(opts.cancel)).toBe(true);
  });

  it("내려받기가 실패하면 다시 시도와 닫기를 보여 준다", async () => {
    const updater = createFakeUpdater({ latest: NEW, installError: "disk" });
    const store = createUpdaterStore({ updater, flush: async () => true });
    await store.getState().check();
    runInstallWithToast(store);
    await vi.waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    const opts = lastOpts(toastMock.error);
    expect(toastMock.error).toHaveBeenCalledWith(INSTALL_ERROR_MESSAGE, expect.any(Object));
    expect(opts).toMatchObject({
      id: UPDATE_TOAST_ID,
      duration: Infinity,
      dismissible: false,
      action: { label: "다시 시도" },
    });
    clickCancel(opts);
    expect(toastMock.dismiss).toHaveBeenCalledWith(UPDATE_TOAST_ID);
  });

  it("다시 시도를 누르면 설치를 한 번 더 한다", async () => {
    const updater = createFakeUpdater({ latest: NEW, installError: "disk" });
    const store = createUpdaterStore({ updater, flush: async () => true });
    await store.getState().check();
    runInstallWithToast(store);
    await vi.waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1));
    const retry = vi.spyOn(updater, "downloadAndInstall");
    lastOpts(toastMock.error).action?.onClick({ preventDefault });
    await vi.waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(2));
  });

  it("설정에서 내려받는 중에 토스트의 업데이트를 누르면, 진행률과 완료를 토스트가 끝까지 받는다", async () => {
    const { updater, release } = gatedUpdater();
    const store = createUpdaterStore({ updater, flush: async () => true });
    await store.getState().check();
    // 설정 화면이 먼저 내려받기를 시작한다(25%에서 멈춰 있다)
    const fromSettings = store.getState().install();
    expect(store.getState().progress).toBe(25);
    // 토스트의 「업데이트」는 진행 중인 내려받기에 합류해야 한다
    runInstallWithToast(store);
    release();
    await fromSettings;
    await vi.waitFor(() => expect(updater.relaunched).toBe(true));
    const messages = toastMessages();
    expect(messages).toEqual(
      expect.arrayContaining([
        "내려받는 중 25%",
        "내려받는 중 100%",
        "설치하고 다시 여는 중이에요",
      ]),
    );
  });

  it("설정에서 내려받는 중에 토스트를 연 뒤 내려받기가 실패하면, 토스트가 오류와 다시 시도를 보여 준다", async () => {
    const { updater, release } = gatedUpdater({ installError: "disk" });
    const store = createUpdaterStore({ updater, flush: async () => true });
    await store.getState().check();
    const fromSettings = store.getState().install();
    runInstallWithToast(store);
    release();
    await fromSettings;
    await vi.waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1));
    expect(lastOpts(toastMock.error).action?.label).toBe("다시 시도");
  });
});

/** 내려받기를 release()로 한 단계씩 풀어 주는 가짜 업데이트. 토스트가 중간에 합류하는 순서를 고정한다 */
function gatedUpdater(options: { installError?: string } = {}) {
  const base = createFakeUpdater({ latest: NEW });
  let release: () => void = () => {};
  const updater = {
    currentVersion: base.currentVersion,
    check: base.check,
    relaunch: base.relaunch,
    get relaunched() {
      return base.relaunched;
    },
    async downloadAndInstall(onProgress: (p: number) => void) {
      onProgress(25);
      await new Promise<void>((resolve) => (release = resolve));
      if (options.installError) throw new Error(options.installError);
      onProgress(100);
    },
  };
  return { updater, release: () => release() };
}

function toastMessages() {
  return toastMock.mock.calls.map((c) =>
    typeof c[0] === "string" ? c[0] : c[0].props.children[0].props.children,
  );
}
