import { intlLocale, msg } from "@/lib/i18n";
import { setTrayStatus, setTrayUpcoming } from "@/lib/storage/window";
import { remindersStore } from "./index";
import { dueAt, remaining, type Reminder } from "./model";

/** 메뉴 맨 위에 보이는 다가오는 알림 줄 수 상한 (SYS-16) */
export const UPCOMING_TRAY_MAX = 3;

/** 메뉴 막대 타이머 글자 (SYS-16). 1시간 미만은 mm:ss, 그 이상은 h:mm:ss */
export function formatTrayTimer(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** 아직 끝나지 않은 타이머 가운데 가장 먼저 끝나는 것의 남은 초. 없으면 null */
export function nearestTimerLeft(list: readonly Reminder[], now: Date): number | null {
  let best: number | null = null;
  for (const rem of list) {
    if (rem.done) continue;
    const left = remaining(rem, now);
    if (left === null || left <= 0) continue;
    if (best === null || left < best) best = left;
  }
  return best;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * 메뉴 줄의 시각 문구 (SYS-16). 오늘은 「15:01」, 내일은 「내일 9:00」, 그 밖은 「12월 3일 9:00」.
 * 날짜 부분은 앱 언어 로캘로 쓴다. 시각은 앞자리 0 없이 쓴다.
 */
export function formatTrayAlarmWhen(due: Date, now: Date): string {
  const hm = `${due.getHours()}:${String(due.getMinutes()).padStart(2, "0")}`;
  if (sameDay(due, now)) return hm;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (sameDay(due, tomorrow)) return msg().features.reminders.whenTomorrow(hm);
  const date = new Intl.DateTimeFormat(intlLocale(), { month: "long", day: "numeric" }).format(due);
  return `${date} ${hm}`;
}

/** 메뉴 맨 위에 보일 다가오는 알람 줄. 끝나지 않은 알람 가운데 울릴 시각이 지금 이후인 것을 가까운 순으로 최대 `max`개 (예 「15:01 물 마시기」) */
export function upcomingTrayLines(
  list: readonly Reminder[],
  now: Date,
  max: number = UPCOMING_TRAY_MAX,
): string[] {
  const untitled = msg().features.reminders.notifyTitle;
  const due: { rem: Reminder; at: Date }[] = [];
  for (const rem of list) {
    if (rem.kind !== "alarm" || rem.done) continue;
    const at = dueAt(rem);
    if (at && at.getTime() >= now.getTime()) due.push({ rem, at });
  }
  due.sort((a, b) => a.at.getTime() - b.at.getTime());
  return due
    .slice(0, max)
    .map(({ rem, at }) => `${formatTrayAlarmWhen(at, now)} ${rem.label.trim() || untitled}`);
}

export interface TrayTimerDeps {
  list(): readonly Reminder[];
  now(): Date;
  send(text: string | null): Promise<void>;
  sendUpcoming(items: string[]): Promise<void>;
}

const defaultDeps: TrayTimerDeps = {
  list: () => remindersStore.getState().list,
  now: () => new Date(),
  send: setTrayStatus,
  sendUpcoming: setTrayUpcoming,
};

/**
 * 메뉴 막대 타이머 표시와 다가오는 알림 줄을 1초마다 맞춘다 (메인 창에서만 돈다).
 * 타이머 글자와 알림 줄은 각각 바뀔 때만 Rust에 보낸다. 돌려주는 함수로 멈춘다.
 */
export function startTrayTimerStatus(deps: TrayTimerDeps = defaultDeps): () => void {
  let shown: string | null | undefined;
  let shownUpcoming: string | undefined;
  const tick = () => {
    const now = deps.now();
    const list = deps.list();
    const left = nearestTimerLeft(list, now);
    const text = left === null ? null : formatTrayTimer(left);
    if (text !== shown) {
      shown = text;
      deps.send(text).catch(() => undefined);
    }
    const upcoming = upcomingTrayLines(list, now);
    const upcomingKey = JSON.stringify(upcoming);
    if (upcomingKey !== shownUpcoming) {
      shownUpcoming = upcomingKey;
      deps.sendUpcoming(upcoming).catch(() => undefined);
    }
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}
