import { toast } from "@/components/ui/toast";
import { metaStore } from "@/features/meta";
import { pagesStore } from "@/features/pages";
import { sessionStore } from "@/features/session";
import { createUpdater } from "@/lib/updater";
import { useEffect } from "react";
import { useStore } from "zustand";
import { createAutoChecker } from "./schedule";
import { createUpdaterStore, type UpdaterStore } from "./store";

/** 다시 열기 전에 노트·메타·화면 상태 저장을 모두 끝낸다 (SYS-07) */
async function flushAllSaves(): Promise<boolean> {
  const [pages, meta] = await Promise.all([
    pagesStore.getState().flushAll(),
    metaStore.getState().flush(),
  ]);
  await sessionStore.getState().flush();
  return pages && meta;
}

/** 앱 업데이트 상태 (SYS-07). Tauri 창이 아니면 가짜 업데이트를 쓴다 */
export const updaterStore = createUpdaterStore({
  updater: createUpdater(),
  flush: flushAllSaves,
});

export function useUpdater<T>(select: (s: UpdaterStore) => T): T {
  return useStore(updaterStore, select);
}

const TOAST_ID = "app-update";
/** 내려받기 중 토스트는 사용자가 닫을 때까지 두되, 0이 되지 않도록 긴 시간을 쓴다 */
const LONG_MS = 10 * 60 * 1000;

/** "새 버전 x.y.z이 나왔어요 · 업데이트" 토스트 */
export function announceUpdate(version: string) {
  toast(`새 버전 ${version}이 나왔어요`, {
    id: TOAST_ID,
    duration: 12_000,
    action: { label: "업데이트", onClick: () => installWithToast() },
  });
}

/** 토스트 한 개가 내려받기 진행률과 오류를 이어서 보여 준다. 끝나면 앱을 다시 연다 */
export function installWithToast() {
  if (!updaterStore.getState().update) {
    toast.dismiss(TOAST_ID);
    return;
  }
  toast("업데이트를 내려받고 있어요", { id: TOAST_ID, duration: LONG_MS });
  const unsub = updaterStore.subscribe((s, prev) => {
    if (
      s.status === "downloading" &&
      (s.progress !== prev.progress || prev.status !== "downloading")
    ) {
      toast(s.progress === null ? "내려받는 중이에요" : `내려받는 중 ${s.progress}%`, {
        id: TOAST_ID,
        duration: LONG_MS,
      });
    } else if (s.status === "error" && s.error) {
      toast.error(s.error, { id: TOAST_ID, duration: 8_000 });
    }
  });
  void updaterStore
    .getState()
    .install()
    .finally(() => unsub());
}

/** ⌘K「업데이트 확인」 — 결과를 토스트로 알린다 */
export async function checkForUpdates() {
  const r = await updaterStore.getState().check();
  if (r.kind === "available") {
    updaterStore.getState().markNotified(r.update.version);
    announceUpdate(r.update.version);
  } else if (r.kind === "latest") {
    toast(`최신 버전이에요 (${updaterStore.getState().currentVersion ?? ""})`);
  } else {
    toast.error(r.message);
  }
}

/**
 * 앱이 준비되면 자동 확인을 시작한다 (SYS-07). 설정을 막 켰을 때도 한 번 본다.
 * 실패는 조용히 넘기고, 같은 버전은 토스트를 한 번만 띄운다.
 */
export function useAutoUpdateChecks() {
  useEffect(() => {
    const auto = createAutoChecker({
      store: updaterStore,
      enabled: () => {
        const s = sessionStore.getState();
        return s.loaded && s.autoUpdateCheck;
      },
      notify: announceUpdate,
    });
    const stop = auto.start();
    let wasOn = sessionStore.getState().autoUpdateCheck;
    const unsub = sessionStore.subscribe((s) => {
      if (s.autoUpdateCheck && !wasOn) auto.run();
      wasOn = s.autoUpdateCheck;
    });
    return () => {
      stop();
      unsub();
    };
  }, []);
}
