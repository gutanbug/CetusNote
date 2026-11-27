import { msg } from "@/lib/i18n";

/** 날짜 알림 안내 문구. 읽을 때의 언어로 나온다 */
export const REMINDER_COPY = {
  get permissionExplain() {
    return msg().features.reminders.permissionExplain;
  },
  get permissionDenied() {
    return msg().features.reminders.permissionDenied;
  },
  get fallback() {
    return msg().features.reminders.fallback;
  },
  get allowButton() {
    return msg().features.reminders.allowButton;
  },
  missedTitle: (count: number) => msg().features.reminders.missedTitle(count),
  get untitled() {
    return msg().features.reminders.untitled;
  },
};
