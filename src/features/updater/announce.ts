import { createElement } from "react";
import { Progress } from "@/components/ui/progress";
import { toast, ToastCancelButton, ToastCloseButton } from "@/components/ui/toast";
import { releaseUrl } from "@/features/release-notes/release-url";
import { openLink } from "@/lib/storage/open-link";
import type { UpdaterStoreApi } from "./store";
import { msg } from "@/lib/i18n";
import { downloadMessage } from "./view";

/** 업데이트 토스트 하나가 알림·내려받기 진행률·오류를 이어서 보여 준다 */
export const UPDATE_TOAST_ID = "app-update";

/**
 * 내려받기 토스트 본문: 글 한 줄 + 가는 진행률 막대(UI-Progress, role=progressbar).
 * 크기를 모르면(null) 막대 없이 글만 둔다 — 가짜 값을 그리지 않는다.
 */
function downloadBody(text: string, progress: number | null) {
  return createElement(
    "span",
    { className: "grid w-40 gap-1.5" },
    createElement("span", null, text),
    progress === null
      ? null
      : createElement(Progress, {
          value: progress,
          "aria-label": msg().features.updater.progressLabel,
        }),
  );
}

/** 닫기 버튼 — 토스트를 밀어서 치울 수 없으므로(dismissible: false) 버튼으로만 닫는다 */
function closeButton(onClose: () => void = () => toast.dismiss(UPDATE_TOAST_ID)) {
  return createElement(ToastCancelButton, {
    onClick: onClose,
    children: msg().features.updater.close,
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
 * 「릴리스 보기」 — 새 버전의 GitHub 릴리스 페이지를 브라우저로 열고 토스트를 치운다 (SYS-12).
 * 업데이트는 설정 › 일반 › 업데이트에 그대로 남는다.
 */
function releaseButton(version: string) {
  return createElement(ToastCancelButton, {
    onClick: () => {
      void openLink(releaseUrl(version));
      toast.dismiss(UPDATE_TOAST_ID);
    },
    children: msg().features.updater.releaseLink,
  });
}

/**
 * 새 버전 토스트 (SYS-07). 자동으로 사라지지 않고, 「릴리스 보기」나 「업데이트」로만 넘어간다.
 * 같은 버전 알림 중복은 호출하는 쪽이 markNotified로 막는다.
 */
export function announceUpdateToast(store: UpdaterStoreApi, version: string) {
  toast(msg().features.updater.newVersion(version), {
    id: UPDATE_TOAST_ID,
    duration: Infinity,
    dismissible: false,
    action: installAction(msg().features.updater.installAction, () => runInstallWithToast(store)),
    // 「릴리스 보기」와 아이콘 전용 ✕를 한 줄에 둔다(sonner의 cancel 슬롯은 요소 하나만 받는다)
    cancel: createElement(
      "span",
      { className: "flex items-center gap-1" },
      releaseButton(version),
      createElement(ToastCloseButton, { onClick: () => toast.dismiss(UPDATE_TOAST_ID) }),
    ),
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
    toast(downloadBody(downloadMessage(s.progress, s.finishing), s.finishing ? null : s.progress), {
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
            ? installAction(msg().features.updater.retryAction, () => runInstallWithToast(store))
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
