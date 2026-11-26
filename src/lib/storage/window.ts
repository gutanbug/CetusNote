import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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

/** 창을 바로 닫는다 (닫기 요청을 막은 뒤 저장이 끝났을 때). 권한: core:window:allow-destroy */
export async function destroyCurrentWindow(): Promise<void> {
  await getCurrentWindow().destroy();
}

/** Cmd+Q·메뉴 종료 요청을 받는다 (Rust가 종료를 막고 이 이벤트를 보낸다). 저장을 끝낸 뒤 confirmQuit을 불러야 종료된다 */
export function onQuitRequested(handler: () => void): Promise<() => void> {
  return listen("app://quit-requested", () => handler());
}

/** 저장을 마쳤으니 종료한다 (Rust의 confirm_quit) */
export async function confirmQuit(): Promise<void> {
  await invoke("confirm_quit");
}
