import { emit, listen } from "@tauri-apps/api/event";

/**
 * 빠른 입력 창(QN-03)과 메인 창 사이의 알림 이름. 보내는 쪽과 듣는 쪽이 같은 이름을 쓴다.
 * - quick://open-page: 빠른 입력이 페이지를 열어 달라고 한다 ({ id })
 * - quick://changed: 메모·페이지가 바뀌었으니 메인 창이 워크스페이스 메타·페이지 목록을 다시 읽는다
 * - reminders://changed: 알림 파일이 바뀌었으니 메인 창이 알림 목록을 다시 읽는다
 */
export type AppEventName = "quick://open-page" | "quick://changed" | "reminders://changed";

export function emitAppEvent(name: AppEventName, payload?: unknown): Promise<void> {
  return emit(name, payload);
}

export function listenAppEvent<T = unknown>(
  name: AppEventName,
  handler: (payload: T) => void,
): Promise<() => void> {
  return listen<T>(name, (e) => handler(e.payload));
}
