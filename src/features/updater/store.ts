import { createStore } from "zustand/vanilla";
import type { UpdateInfo, Updater } from "@/lib/updater/types";
import { msg } from "@/lib/i18n";
import { isNewerVersion } from "./version";

/** 업데이트 상태 (SYS-07). idle = 아직 확인 안 함 */
export type UpdateStatus = "idle" | "checking" | "latest" | "available" | "downloading" | "error";

export type CheckResult =
  | { kind: "available"; update: UpdateInfo }
  | { kind: "latest" }
  | { kind: "error"; message: string };

export type UpdaterState = {
  currentVersion: string | null;
  status: UpdateStatus;
  /** 새 버전 정보 (available·downloading·설치 실패일 때) */
  update: UpdateInfo | null;
  /** 내려받기 진행률 0–100, 모르면 null */
  progress: number | null;
  /** 내려받기가 끝나 저장·다시 열기를 하는 중(설치는 끝났다) */
  finishing: boolean;
  /** 오류가 난 단계 — 다시 시도할 동작을 고른다. relaunch는 설치가 끝난 뒤라 다시 시도하지 않는다 */
  errorStep: "check" | "install" | "relaunch" | null;
  error: string | null;
  /** 마지막 확인을 시도한 시각(ms). 하루 간격 확인에 쓴다 */
  checkedAt: number | null;
  /** 알림(토스트)을 이미 보여 준 버전 */
  notifiedVersion: string | null;
};

export type UpdaterStore = UpdaterState & {
  /** 새 버전이 있는지 확인한다. silent면 오류를 화면에 남기지 않는다 */
  check(options?: { silent?: boolean }): Promise<CheckResult>;
  /** 찾은 업데이트를 내려받아 설치하고, 저장을 마친 뒤 앱을 다시 연다 */
  install(): Promise<void>;
  /** 설치된 버전을 읽어 currentVersion에 넣는다(설정 화면을 열 때 쓴다) */
  loadVersion(): Promise<void>;
  markNotified(version: string): void;
};

export type UpdaterDeps = {
  updater: Updater;
  /** 다시 열기 전에 남은 저장을 끝낸다. 모두 저장했으면 true */
  flush: () => Promise<boolean>;
  now?: () => number;
};

export function createUpdaterStore({ updater, flush, now = Date.now }: UpdaterDeps) {
  let inflight: Promise<CheckResult> | null = null;
  // 내려받기·설치 중인 요청. 다시 부르면 이 요청이 끝날 때까지 기다린다(진행률·오류를 놓치지 않게)
  let installing: Promise<void> | null = null;

  return createStore<UpdaterStore>()((set, get) => {
    const currentOf = async () => {
      const known = get().currentVersion;
      if (known) return known;
      const v = await updater.currentVersion();
      set({ currentVersion: v });
      return v;
    };

    const runCheck = async (silent: boolean): Promise<CheckResult> => {
      const before = get().status;
      set({ status: "checking", checkedAt: now(), errorStep: null, error: null });
      try {
        const current = await currentOf();
        const info = await updater.check();
        if (info && isNewerVersion(info.version, current)) {
          set({ status: "available", update: info });
          return { kind: "available", update: info };
        }
        set({ status: "latest", update: null, progress: null });
        return { kind: "latest" };
      } catch {
        if (silent) {
          // 자동 확인의 실패는 조용히 넘긴다. 이전 상태(찾은 업데이트 등)는 그대로 둔다
          set({ status: before === "checking" ? "idle" : before });
        } else {
          set({ status: "error", errorStep: "check", error: msg().features.updater.checkError });
        }
        return { kind: "error", message: msg().features.updater.checkError };
      }
    };

    return {
      currentVersion: null,
      status: "idle",
      update: null,
      progress: null,
      finishing: false,
      errorStep: null,
      error: null,
      checkedAt: null,
      notifiedVersion: null,
      check({ silent = false } = {}) {
        // 이미 확인 중이면 같은 결과를 기다린다(자동 확인과 버튼이 겹쳐도 한 번만 요청)
        if (get().status === "checking" && inflight) return inflight;
        inflight = runCheck(silent).finally(() => {
          inflight = null;
        });
        return inflight;
      },
      install() {
        // 이미 내려받는 중이면 새 요청을 만들지 않고, 같은 요청이 끝날 때까지 기다린다
        if (installing) return installing;
        if (!get().update) return Promise.resolve();
        installing = runInstall().finally(() => {
          installing = null;
        });
        return installing;
      },
      async loadVersion() {
        await currentOf();
      },
      markNotified(version) {
        set({ notifiedVersion: version });
      },
    };

    async function runInstall(): Promise<void> {
      set({
        status: "downloading",
        progress: null,
        finishing: false,
        errorStep: null,
        error: null,
      });
      // 마지막 확인 뒤에 더 새 버전이 나왔을 수 있다(확인은 하루에 한 번). 내려받기 직전에 다시 확인해
      // 지금 가장 새 버전을 받는다 — 어느 버전에서든 한 번에 최신으로 간다. 확인이 실패하면 찾아 둔 업데이트로 진행한다
      try {
        const current = await currentOf();
        const latest = await updater.check();
        if (latest && isNewerVersion(latest.version, current)) set({ update: latest });
        else {
          set({ status: "latest", update: null, progress: null });
          return;
        }
      } catch {
        // 다시 확인하지 못했다 — 이미 찾은 업데이트로 진행
      }
      try {
        await updater.downloadAndInstall((progress) => set({ progress }));
      } catch {
        set({
          status: "error",
          errorStep: "install",
          progress: null,
          finishing: false,
          error: msg().features.updater.installError,
        });
        return;
      }
      // 설치는 끝났다. 남은 저장을 끝낸 뒤에만 다시 연다
      set({ finishing: true });
      const saved = await flush().catch(() => false);
      if (!saved) {
        set({
          status: "error",
          errorStep: "install",
          progress: null,
          finishing: false,
          error: msg().features.updater.saveBeforeRestart,
        });
        return;
      }
      try {
        await updater.relaunch();
      } catch {
        // 설치는 이미 끝났으므로 다시 설치하지 않고 직접 열어 달라고만 한다
        set({
          status: "error",
          errorStep: "relaunch",
          progress: null,
          finishing: false,
          error: msg().features.updater.relaunchError,
        });
      }
    }
  });
}

export type UpdaterStoreApi = ReturnType<typeof createUpdaterStore>;
