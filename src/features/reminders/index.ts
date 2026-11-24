import { createFiredStore } from "./fired-store";
import { notificationPermission, sendOsNotification } from "../../lib/storage/notification";
import { ReminderScheduler, type MissedReminder, type ReminderSchedulerDeps } from "./scheduler";

export { REMINDER_COPY } from "./copy";
export { requestNotificationPermission } from "../../lib/storage/notification";
export { ReminderScheduler, reminderKey, TICK_MS, type MissedReminder } from "./scheduler";

/**
 * 앱에서 쓰는 알림 스케줄러. 페이지 저장 때 `setPage`, 워크스페이스 전환 때 `reset`을 부른다.
 * 알림 목록(놓친 알림·권한 안내·대체 알림)은 콜백으로 받아 화면(UI-Toast 등)이 그린다.
 */
export function createReminderScheduler(
  callbacks: Pick<
    ReminderSchedulerDeps,
    "pageTitle" | "onPermissionNeeded" | "onFallback" | "onMissed"
  > & { onMissed?: (items: MissedReminder[]) => void },
): ReminderScheduler {
  return new ReminderScheduler({
    now: () => new Date(),
    setTimer: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimer: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
    permission: notificationPermission,
    send: sendOsNotification,
    fired: createFiredStore(),
    ...callbacks,
  });
}

/** 화면이 다시 보이거나 포커스를 얻으면 스케줄러를 깨운다(잠자기 뒤 밀린 알림). 해제 함수를 돌려준다 */
export function attachWakeListeners(scheduler: ReminderScheduler): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") scheduler.wake();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
  };
}
