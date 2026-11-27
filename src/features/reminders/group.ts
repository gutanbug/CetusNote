import { dueAt, type Reminder } from "./model";

/**
 * 알림 보기(SYS-16)의 묶음. 순서는 화면 순서와 같다.
 * - running: 돌고 있는 타이머(아직 끝나지 않음)
 * - overdue: 울릴 시각이 지났는데 끝내지 않은 알림
 * - today·tomorrow·thisWeek·later: 울릴 날짜 기준 묶음(반복 알람 제외)
 * - repeating: 반복 알람(다음 울림 시각 순)
 * - done: 끝낸 알림(최근 순)
 */
export type ReminderGroups = {
  running: Reminder[];
  overdue: Reminder[];
  today: Reminder[];
  tomorrow: Reminder[];
  thisWeek: Reminder[];
  later: Reminder[];
  repeating: Reminder[];
  done: Reminder[];
};

const byDue = (a: Reminder, b: Reminder) => (dueAt(a)?.getTime() ?? 0) - (dueAt(b)?.getTime() ?? 0);

/**
 * 알림 목록을 보기 묶음으로 나눈다. 순수 함수 — `now`만 보고 날짜를 정한다.
 * 이번 주는 월요일 시작, 일요일 끝(지역 시간). 날짜가 없는 항목(깨진 시각)은 나중에 묶는다.
 */
export function groupReminders(list: readonly Reminder[], now: Date): ReminderGroups {
  const groups: ReminderGroups = {
    running: [],
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
    repeating: [],
    done: [],
  };
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (n: number) =>
    new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + n);
  const tomorrowStart = day(1);
  const dayAfterStart = day(2);
  // 월=0 … 일=6. 이번 주의 다음 월요일 0시가 이번 주 끝
  const weekIndex = (now.getDay() + 6) % 7;
  const weekEnd = day(7 - weekIndex);

  for (const rem of [...list].sort(byDue)) {
    if (rem.done) {
      groups.done.push(rem);
      continue;
    }
    const due = dueAt(rem);
    const t = due?.getTime() ?? Number.NaN;
    if (rem.kind === "timer") {
      if (due && t > now.getTime()) groups.running.push(rem);
      else groups.overdue.push(rem);
      continue;
    }
    if (rem.repeat) {
      groups.repeating.push(rem);
      continue;
    }
    if (!due || Number.isNaN(t)) groups.later.push(rem);
    else if (t < now.getTime()) groups.overdue.push(rem);
    else if (t < tomorrowStart.getTime()) groups.today.push(rem);
    else if (t < dayAfterStart.getTime()) groups.tomorrow.push(rem);
    else if (t < weekEnd.getTime()) groups.thisWeek.push(rem);
    else groups.later.push(rem);
  }
  groups.done.reverse();
  return groups;
}
