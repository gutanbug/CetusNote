import type { UpdaterStoreApi } from "./store";
import { isCheckDue } from "./version";

/** 앱이 준비된 뒤 첫 확인까지 기다리는 시간 — 첫 화면을 그리는 일과 겹치지 않게 */
export const FIRST_CHECK_DELAY_MS = 5_000;
/** 앱이 켜져 있는 동안 간격 확인을 살피는 주기. 실제 확인은 하루 한 번만 한다 */
export const TICK_MS = 60 * 60 * 1000;

export type AutoCheckDeps = {
  store: UpdaterStoreApi;
  /** 자동 확인 설정이 켜져 있고 설정을 읽었는지 */
  enabled: () => boolean;
  /** 새 버전을 처음 찾았을 때 알린다 (토스트) */
  notify: (version: string) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

/**
 * 자동 확인 (SYS-07). 실행 때 한 번(조금 뒤에), 이후 켜져 있는 동안 하루에 한 번.
 * 실패는 조용히 넘기고, 같은 버전은 한 번만 알린다. 설치는 사용자가 누를 때만 한다.
 */
export function createAutoChecker({
  store,
  enabled,
  notify,
  now = Date.now,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}: AutoCheckDeps) {
  const run = () => {
    const s = store.getState();
    if (!enabled() || s.status === "checking" || s.status === "downloading") return;
    if (!isCheckDue(s.checkedAt, now())) return;
    void store
      .getState()
      .check({ silent: true })
      .then((r) => {
        if (r.kind !== "available") return;
        const { notifiedVersion } = store.getState();
        if (notifiedVersion === r.update.version) return;
        store.getState().markNotified(r.update.version);
        notify(r.update.version);
      });
  };
  return {
    run,
    /** 자동 확인을 시작한다. 반환값을 부르면 멈춘다 */
    start(): () => void {
      const first = setTimer(run, FIRST_CHECK_DELAY_MS);
      const tick = setInterval(run, TICK_MS);
      return () => {
        clearTimer(first);
        clearInterval(tick);
      };
    },
  };
}
