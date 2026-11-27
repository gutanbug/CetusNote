import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { isTauri } from "./default";

/**
 * 창 닫기 요청을 가로챈다. handler가 끝난 뒤 preventClose()를 부르지 않았으면 창이 닫힌다.
 * 등록을 풀 함수를 돌려준다. (권한: core:window:allow-destroy)
 */
export async function onWindowCloseRequested(
  handler: (preventClose: () => void) => Promise<void>,
): Promise<() => void> {
  return getCurrentWindow().onCloseRequested((event) => handler(() => event.preventDefault()));
}

/**
 * 저장이 끝난 뒤 메인 창을 닫는다. 「메뉴 막대에 남기」가 켜져 있으면 숨기고(앱은 남는다), 아니면 닫는다 (SYS-15).
 * Rust가 판단한다(main_window_close). 권한: app-prefs
 */
export async function destroyCurrentWindow(): Promise<void> {
  await invoke("main_window_close");
}

/** 빠른 입력 창을 숨긴다 (Esc·저장 뒤). 권한: core:window:allow-hide */
/** 메인 창을 보이게 하고 앞으로 가져온다 (QN-03·SYS-16). 메뉴 막대에 숨어 있어도 연다 */
export async function showMainWindow(): Promise<void> {
  await invoke("main_window_show");
}

export async function hideCurrentWindow(): Promise<void> {
  // 빠른 입력 창은 Rust가 닫는다: 띄우기 전 앱 상태(가려짐·뒤에 있음)로 돌려야 메인 창이 앞으로 나오지 않는다 (QN-03)
  if (getCurrentWindow().label === "quick") {
    await invoke("quick_hide");
    return;
  }
  await getCurrentWindow().hide();
}

/**
 * 빠른 입력 창의 크기를 바꾼다 (결과가 나오면 늘린다). Rust(quick_resize)가 입력 줄 위치 규칙을 다시 적용한다.
 * setSize를 직접 쓰면 창이 화면 아래로 자라므로 쓰지 않는다.
 */
export async function resizeCurrentWindow(width: number, height: number): Promise<void> {
  await invoke("quick_resize", { width, height });
}

/** 메뉴 막대 상주·로그인 시작·빠른 입력 단축키·두 번 누르기 설정을 Rust에 적용한다 (SYS-15, QN-03) */
export interface AppPrefsInput {
  menuBarResident: boolean;
  launchAtLogin: boolean;
  quickShortcut: string;
  doubleTap: "off" | "control" | "shift" | "command";
}

/** 실패하면 Rust 사유 코드(예 shortcut_unavailable)를 담은 오류를 던진다 */
export async function applyAppPrefs(prefs: AppPrefsInput): Promise<void> {
  await invoke("app_prefs_apply", { prefs });
}

/** Cmd+Q·메뉴 종료 요청을 받는다 (Rust가 종료를 막고 이 이벤트를 보낸다). 저장을 끝낸 뒤 confirmQuit을 불러야 종료된다 */
export function onQuitRequested(handler: () => void): Promise<() => void> {
  return listen("app://quit-requested", () => handler());
}

/** 저장을 마쳤으니 종료한다 (Rust의 confirm_quit) */
export async function confirmQuit(): Promise<void> {
  await invoke("confirm_quit");
}

/** 지금 창이 메인 창인가. Tauri 밖(브라우저 미리보기)에서는 false (SYS-16 타이머 표시는 메인 창에서만) */
export function isMainWindow(): boolean {
  try {
    return getCurrentWindow().label === "main";
  } catch {
    return false;
  }
}

/** 메뉴 막대 글자(예 "24:13")와 메뉴 맨 위 흐린 줄을 바꾼다. null이면 둘 다 지운다 (SYS-16). 권한: storage */
export async function setTrayStatus(text: string | null): Promise<void> {
  await invoke("tray_set_status", { text });
}

/** 메뉴 맨 위에 다가오는 알림 줄을 보인다 (최대 3줄, 예 「15:01 물 마시기」). 빈 배열이면 지운다 (SYS-16). 권한: storage */
export async function setTrayUpcoming(items: string[]): Promise<void> {
  if (!isTauri()) return;
  await invoke("tray_set_upcoming", { items });
}

/** 알림 패널(빠른 입력 창)을 띄우고 알림 id를 넘긴다. 메인 창이 보이지 않을 때 쓴다 (SYS-16). 권한: storage */
export async function showQuickAlert(ids: string[]): Promise<void> {
  if (!isTauri()) return;
  await invoke("quick_alert", { ids });
}

/** 패널이 아직 가져가지 않은 알림 id를 받아 비운다. 패널이 뜰 때와 `quick://alert`를 받을 때 부른다. 권한: quick */
export async function takeQuickAlert(): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>("quick_pending_alert");
}
