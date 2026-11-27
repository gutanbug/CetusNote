import { dueAt, isDue, type Reminder } from "./model";

/**
 * 지금 울릴 새 알림 고르기 (SYS-16, 스케줄러의 순수 부분). 같은 울림은 한 번만 보낸다.
 * 키는 「id + 울릴 시각」이다. 미루기·반복으로 시각이 바뀌면 새 키가 되어 다시 울린다.
 * 예약·타이머·OS 알림은 스케줄러가 맡는다(scheduler.ts, 아직 알람 목록과 연결하지 않았다).
 */

export type FiredSet = { has(key: string): boolean; add(key: string): void };

export function reminderFireKey(rem: Reminder): string | null {
  const due = dueAt(rem);
  return due ? `${rem.id}|${due.getTime()}` : null;
}

/** 울릴 알림들. 보낸 것은 `fired`에 표시한다 (호출자가 실제로 보내는 것과 맞춘다) */
export function collectDue(list: readonly Reminder[], now: Date, fired: FiredSet): Reminder[] {
  const out: Reminder[] = [];
  for (const rem of list) {
    if (!isDue(rem, now)) continue;
    const key = reminderFireKey(rem);
    if (!key || fired.has(key)) continue;
    fired.add(key);
    out.push(rem);
  }
  return out;
}
