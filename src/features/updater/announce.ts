import { createElement } from "react";
import { toast, ToastCancelButton } from "@/components/ui/toast";
import type { UpdaterStoreApi } from "./store";
import { downloadMessage } from "./view";

/** 업데이트 토스트 하나가 알림·내려받기 진행률·오류를 이어서 보여 준다 */
export const UPDATE_TOAST_ID = "app-update";

/** 닫기 버튼 — 토스트를 밀어서 치울 수 없으므로(dismissible: false) 버튼으로만 닫는다 */
function closeButton(onClose: () => void = () => toast.dismiss(UPDATE_TOAST_ID)) {
  return createElement(ToastCancelButton, {
    onClick: onClose,
    children: "닫기",
  });
}

/**
 * 「업데이트」·「다시 시도」 버튼. sonner는 버튼을 누르면 토스트를 지우는데,
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
 * 새 버전 토스트 (SYS-07). 자동으로 사라지지 않고, 「닫기」나 「업데이트」로만 넘어간다.
 * 같은 버전 알림 중복은 호출하는 쪽이 markNotified로 막는다.
 */
export function announceUpdateToast(store: UpdaterStoreApi, version: string) {
  toast(`새 버전 ${version}이 나왔어요`, {
    id: UPDATE_TOAST_ID,
    duration: Infinity,
    dismissible: false,
    action: installAction("업데이트", () => runInstallWithToast(store)),
    cancel: closeButton(),
  });
}

/**
 * 같은 토스트에서 내려받기 진행률과 오류를 보여 준다. 끝나면 저장을 마치고 앱을 다시 연다.
 * 내려받는 동안에는 「닫기」로 토스트를 치울 수 있다. 내려받기는 계속되고 설정 화면에 진행률이 남는다.
 * 오류가 나면 다시 열리며, 설치 단계 오류만 「다시 시도」를 보인다.
 */
export function runInstallWithToast(store: UpdaterStoreApi) {
  if (!store.getState().update) {
    toast.dismiss(UPDATE_TOAST_ID);
    return;
  }
  // 닫기로 치운 뒤에는 진행 갱신으로 다시 띄우지 않는다. 오류가 나면 그때만 다시 보인다
  let hidden = false;
  const hide = () => {
    hidden = true;
    toast.dismiss(UPDATE_TOAST_ID);
  };
  const showProgress = (s: { progress: number | null; finishing: boolean }) => {
    toast(downloadMessage(s.progress, s.finishing), {
      id: UPDATE_TOAST_ID,
      duration: Infinity,
      dismissible: false,
      action: undefined,
      cancel: closeButton(hide),
    });
  };
  showProgress(store.getState());
  const unsub = store.subscribe((s, prev) => {
    if (s.status === "downloading") {
      if (!hidden && (s.progress !== prev.progress || s.finishing !== prev.finishing)) {
        showProgress(s);
      }
    } else if (s.status === "error" && s.error) {
      hidden = false;
      toast.error(s.error, {
        id: UPDATE_TOAST_ID,
        duration: Infinity,
        dismissible: false,
        // 설치가 끝난 뒤의 실패(relaunch)는 다시 설치하지 않으므로 「닫기」만 남긴다
        action:
          s.errorStep === "install"
            ? installAction("다시 시도", () => runInstallWithToast(store))
            : undefined,
        cancel: closeButton(),
      });
    }
  });
  void store
    .getState()
    .install()
    .finally(() => unsub());
}
