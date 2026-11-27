import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";

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
export async function hideCurrentWindow(): Promise<void> {
  await getCurrentWindow().hide();
}

/** 빠른 입력 창의 높이를 바꾼다 (결과가 나오면 늘린다). 권한: core:window:allow-set-size */
export async function resizeCurrentWindow(width: number, height: number): Promise<void> {
  await getCurrentWindow().setSize(new LogicalSize(width, height));
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
