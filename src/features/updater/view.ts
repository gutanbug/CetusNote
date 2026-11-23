import type { UpdaterState } from "./store";

/** 설정 › 일반 › 업데이트 행이 그릴 내용. 화면은 이 값을 그대로 쓴다 */
export type UpdateView = {
  /** 행 설명 줄 */
  message: string;
  /** 버튼: 없음 · 확인 · 설치 · 다시 시도. busy면 로딩 표시 */
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
        message: "새 버전이 있는지 확인하고 있어요",
        action: "check",
        actionLabel: "확인 중…",
        busy: true,
        actionDisabled: true,
      };
    case "latest":
      return { ...base, message: "최신 버전이에요", action: "check", actionLabel: "업데이트 확인" };
    case "available":
      return {
        ...base,
        message: `새 버전 ${s.update?.version ?? ""}이 나왔어요`,
        action: "install",
        actionLabel: "업데이트",
      };
    case "downloading":
      return {
        ...base,
        message: s.progress === null ? "내려받는 중이에요" : `내려받는 중 ${s.progress}%`,
        action: "install",
        actionLabel: "설치 중…",
        actionDisabled: true,
        busy: true,
        progress: s.progress,
      };
    case "error":
      return {
        ...base,
        message: s.error ?? "업데이트를 확인하지 못했어요.",
        action: "retry",
        actionLabel: "다시 시도",
        error: true,
      };
    default:
      return { ...base, message: "", action: "check", actionLabel: "업데이트 확인" };
  }
}
