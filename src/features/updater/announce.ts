import { createElement } from "react";
import { toast, ToastCancelButton } from "@/components/ui/toast";
import type { UpdaterStoreApi } from "./store";

/** 업데이트 토스트 하나가 알림·내려받기 진행률·오류를 이어서 보여 준다 */
export const UPDATE_TOAST_ID = "app-update";

/** 닫기 버튼 — 토스트를 밀어서 치울 수 없으므로(dismissible: false) 버튼으로만 닫는다 */
function closeButton() {
  return createElement(ToastCancelButton, {
    onClick: () => {
      toast.dismiss(UPDATE_TOAST_ID);
    },
    children: "닫기",
  });
}

/**
 * 「다운로드 후 업데이트」·「다시 시도」 버튼. sonner는 버튼을 누르면 토스트를 지우는데,
 * preventDefault로 막아 같은 토스트에서 진행률을 이어서 보여 준다.
 */
function installAction(label: string, run: () => void) {
  return {
    label,
    onClick: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      run();
    },
  };
}

/**
 * 새 버전 토스트 (SYS-07). 자동으로 사라지지 않고, 「닫기」나 「다운로드 후 업데이트」로만 넘어간다.
 * 같은 버전 알림 중복은 호출하는 쪽이 markNotified로 막는다.
 */
export function announceUpdateToast(store: UpdaterStoreApi, version: string) {
  toast(`새 버전 ${version}이 나왔어요`, {
    id: UPDATE_TOAST_ID,
    duration: Infinity,
    dismissible: false,
    action: installAction("다운로드 후 업데이트", () => runInstallWithToast(store)),
    cancel: closeButton(),
  });
}

/**
 * 같은 토스트에서 내려받기 진행률과 오류를 보여 준다. 끝나면 저장을 마치고 앱을 다시 연다.
 * 오류가 나면 「다시 시도」와 「닫기」를 보인다.
 */
export function runInstallWithToast(store: UpdaterStoreApi) {
  if (!store.getState().update) {
    toast.dismiss(UPDATE_TOAST_ID);
    return;
  }
  // 같은 id로 다시 부르면 이전 옵션과 합쳐지므로, 버튼은 명시적으로 지운다
  toast("업데이트를 내려받고 있어요", {
    id: UPDATE_TOAST_ID,
    duration: Infinity,
    dismissible: false,
    action: undefined,
    cancel: undefined,
  });
  const unsub = store.subscribe((s, prev) => {
    if (
      s.status === "downloading" &&
      (s.progress !== prev.progress || prev.status !== "downloading")
    ) {
      toast(s.progress === null ? "내려받는 중이에요" : `내려받는 중 ${s.progress}%`, {
        id: UPDATE_TOAST_ID,
        duration: Infinity,
        dismissible: false,
        action: undefined,
        cancel: undefined,
      });
    } else if (s.status === "error" && s.error) {
      toast.error(s.error, {
        id: UPDATE_TOAST_ID,
        duration: Infinity,
        dismissible: false,
        action: installAction("다시 시도", () => runInstallWithToast(store)),
        cancel: closeButton(),
      });
    }
  });
  void store
    .getState()
    .install()
    .finally(() => unsub());
}
