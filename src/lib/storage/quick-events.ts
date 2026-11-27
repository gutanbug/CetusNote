import { emit, listen } from "@tauri-apps/api/event";
import { isTauri } from "./default";

/**
 * 빠른 입력 창(QN-03)과 메인 창 사이의 알림 이름. 보내는 쪽과 듣는 쪽이 같은 이름을 쓴다.
 * - quick://open-page: 빠른 입력이 페이지를 열어 달라고 한다 ({ id })
 * - quick://changed: 메모·페이지가 바뀌었으니 메인 창이 워크스페이스 메타·페이지 목록을 다시 읽는다
 * - reminders://changed: 알림 파일이 바뀌었으니 메인 창이 알림 목록을 다시 읽는다
 * - quick://shown: 빠른 입력 창이 떴다 (Rust → 빠른 입력 창). 입력 칸에 포커스를 준다
 * - quick://alert: 알림이 울렸다 (Rust → 빠른 입력 창, { ids: string[] }). 알림 대응 상태를 보인다
 */
export type AppEventName =
  | "quick://open-page"
  | "quick://changed"
  | "reminders://changed"
  | "quick://shown"
  | "quick://alert";

export function emitAppEvent(name: AppEventName, payload?: unknown): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return emit(name, payload);
}

export function listenAppEvent<T = unknown>(
  name: AppEventName,
  handler: (payload: T) => void,
): Promise<() => void> {
  // 웹 미리보기·테스트에는 Tauri 이벤트가 없다
  if (!isTauri()) return Promise.resolve(() => {});
  return listen<T>(name, (e) => handler(e.payload));
}
