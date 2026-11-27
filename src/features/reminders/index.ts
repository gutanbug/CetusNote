import { useStore } from "zustand";
import { getStorage } from "../../lib/storage/default";
import { createRemindersStore, type RemindersState } from "./store";
import { addReminderFromText as addFromText } from "./text";
import type { ReminderTarget } from "./model";
import { StoreReminderScheduler, type StoreSchedulerDeps } from "./store-scheduler";
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
    "pageTitle" | "onPermissionNeeded" | "onFallback" | "onMissed" | "wasMissable"
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
export function attachWakeListeners(scheduler: { wake(): void }): () => void {
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

/** 알림 목록 저장소 (앱에서 하나). 워크스페이스를 열 때 `load`, 종료·전환 때 `flush`를 부른다 */
export const remindersStore = createRemindersStore(getStorage());

/** 알림 목록을 구독한다. 화면은 필요한 조각만 고른다: `useReminders((s) => s.list)` */
export function useReminders<T>(selector: (s: RemindersState) => T): T {
  return useStore(remindersStore, selector);
}

/** 한 줄 입력으로 알림을 만든다 (「내일 9시 회의」). 시각을 못 알아들으면 null */
export function addReminderFromText(text: string, target: ReminderTarget, now?: Date) {
  return addFromText(remindersStore.getState(), text, target, now);
}

export { formatReminderWhen } from "./present";
export { StoreReminderScheduler, type StoreDue } from "./store-scheduler";
export { createRemindersStore, type RemindersState } from "./store";

/** 알림 목록(SYS-16) 스케줄러. 목록이 바뀔 때 `setList`를 부른다 */
export function createStoreReminderScheduler(
  callbacks: Pick<StoreSchedulerDeps, "onFallback" | "onMissed" | "isFocused" | "onFocused">,
): StoreReminderScheduler {
  return new StoreReminderScheduler({
    now: () => new Date(),
    setTimer: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimer: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
    permission: notificationPermission,
    send: sendOsNotification,
    fired: createFiredStore(),
    ...callbacks,
  });
}
