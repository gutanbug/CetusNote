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
