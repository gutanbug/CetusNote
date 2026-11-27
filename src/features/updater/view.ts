import { msg } from "@/lib/i18n";
import type { UpdaterState } from "./store";

/**
 * 내려받기·설치 문구. 토스트와 설정 화면이 같이 쓴다.
 * 내려받는 중 → 「내려받는 중 n%」, 내려받기가 끝나 저장·다시 여는 중 → 「설치하고 다시 여는 중이에요」
 */
export function downloadMessage(progress: number | null, finishing: boolean): string {
  if (finishing) return msg().features.updater.finishing;
  return progress === null
    ? msg().features.updater.downloading
    : msg().features.updater.downloadingPercent(progress);
}

/** 설정 › 일반 › 업데이트 행이 그릴 내용. 화면은 이 값을 그대로 쓴다 */
export type UpdateView = {
  /** 행 설명 줄 */
  message: string;
  /** 버튼: 없음 · 확인 · 설치 · 다시 시도. busy면 로딩 표시. 없음이면 버튼을 그리지 않는다 */
  action: "none" | "check" | "install" | "retry";
  actionLabel: string;
  actionDisabled: boolean;
  busy: boolean;
  /** 내려받는 중일 때 막대 값(0–100, 모르면 null) */
  progress: number | null;
  error: boolean;
};

export function updateView(s: UpdaterState): UpdateView {
  const base = { progress: null, error: false, busy: false, actionDisabled: false };
  switch (s.status) {
    case "checking":
      return {
        ...base,
        message: msg().features.updater.checking,
        action: "check",
        actionLabel: msg().features.updater.checkingAction,
        busy: true,
        actionDisabled: true,
      };
    case "latest":
      return {
        ...base,
        message: msg().features.updater.latest,
        action: "check",
        actionLabel: msg().features.updater.checkAction,
      };
    case "available":
      return {
        ...base,
        message: msg().features.updater.newVersion(s.update?.version ?? ""),
        action: "install",
        actionLabel: msg().features.updater.installAction,
      };
    case "downloading":
      return {
        ...base,
        message: downloadMessage(s.progress, s.finishing),
        action: "install",
        actionLabel: msg().features.updater.installAction,
        actionDisabled: true,
        busy: true,
        progress: s.progress,
      };
    case "error":
      if (s.errorStep === "relaunch") {
        // 설치는 끝났다. 다시 설치하는 버튼 대신 직접 열어 달라는 문구만 남긴다
        return { ...base, message: s.error ?? "", action: "none", actionLabel: "", error: true };
      }
      return {
        ...base,
        message: s.error ?? msg().features.updater.checkFailed,
        action: "retry",
        actionLabel: msg().features.updater.retryAction,
        error: true,
      };
    default:
      return {
        ...base,
        message: "",
        action: "check",
        actionLabel: msg().features.updater.checkAction,
      };
  }
}
