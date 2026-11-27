import { msg } from "@/lib/i18n";
import { dueAt, remaining, type Reminder, type RepeatRule } from "./model";

/**
 * 알림의 시각 표시 (SYS-16). 목록·알림 대화상자에서 쓴다.
 * 예: 「오늘 15:00」 「내일 9:00」 「3/5 9:00」 「매일 9:00」 「25분 남음」.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

function hm(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function repeatLabel(rule: RepeatRule): string {
  const r = msg().features.reminders;
  switch (rule) {
    case "day":
      return r.repeatDay;
    case "weekday":
      return r.repeatWeekday;
    case "week":
      return r.repeatWeek;
    case "month":
      return r.repeatMonth;
  }
}

/** 남은 시간 문구. 1분 미만이면 「곧 울려요」 */
function leftText(ms: number): string {
  const r = msg().features.reminders;
  const minutes = Math.ceil(ms / MINUTE_MS);
  return ms < MINUTE_MS ? r.remainingSoon : r.remainingMinutes(minutes);
}

/** 알림이 언제 울리는지 한 줄로 쓴다 (`now` 기준) */
export function formatReminderWhen(rem: Reminder, now: Date): string {
  const r = msg().features.reminders;
  if (rem.kind === "timer") {
    const left = remaining(rem, now);
    if (left === null || left <= 0) return r.notifyTimerDone;
    return leftText(left * 1000);
  }
  const due = dueAt(rem);
  if (!due) return "";
  if (rem.repeat) return r.whenRepeat(repeatLabel(rem.repeat), hm(due));
  const diff = due.getTime() - now.getTime();
  if (diff > 0 && diff < HOUR_MS) return leftText(diff);
  if (sameDay(due, now)) return r.whenToday(hm(due));
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (sameDay(due, tomorrow)) return r.whenTomorrow(hm(due));
  return r.whenDate(due.getMonth() + 1, due.getDate(), hm(due));
}
