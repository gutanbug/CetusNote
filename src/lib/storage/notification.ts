/** 날짜 알림용 OS 알림 래퍼 (EDIT-37, tauri-plugin-notification 2.7.0). 앱이 켜져 있을 때만 쓴다 */
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

/** 알림 권한 상태. 거절 여부는 요청해 보기 전에는 알 수 없다 */
export type NotificationPermissionState = "granted" | "default" | "denied" | "unsupported";

/** OS 알림 한 건 */
export type OsNotification = { title: string; body: string };

/** Tauri 창 안에서 도는가. 브라우저 미리보기에서는 OS 알림이 없다 */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** 현재 권한. 거절 여부는 요청해 보기 전에는 알 수 없어 거절·미정은 "default"로 합친다 */
export async function notificationPermission(): Promise<NotificationPermissionState> {
  if (!isTauriRuntime()) return "unsupported";
  try {
    return (await isPermissionGranted()) ? "granted" : "default";
  } catch {
    return "unsupported";
  }
}

/** 권한 요청 (사용자가 「허용」을 눌렀을 때만 부른다) */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isTauriRuntime()) return "unsupported";
  try {
    const result = await requestPermission();
    if (result === "granted") return "granted";
    return result === "denied" ? "denied" : "default";
  } catch {
    return "unsupported";
  }
}

/** OS 알림 보내기. 실패하면 failed (호출한 쪽이 앱 안 알림으로 대신한다) */
export async function sendOsNotification(n: OsNotification): Promise<"sent" | "failed"> {
  try {
    sendNotification({ title: n.title, body: n.body });
    return "sent";
  } catch {
    return "failed";
  }
}
