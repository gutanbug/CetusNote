/**
 * 달력 날짜(YYYY-MM-DD) 유틸. 날짜는 사용자의 로컬 달력 날짜로만 다룬다.
 * `Date.parse`나 `toISOString`은 UTC로 밀려 하루가 어긋나므로 쓰지 않는다.
 */

/** 로컬 달력 날짜 문자열 "YYYY-MM-DD" */
export type IsoDate = string;

/** 로컬 시각 "HH:mm" (24시간) */
export type TimeOfDay = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** 로컬 자정의 Date로 바꾼다. 존재하지 않는 날짜(2월 30일 등)는 null */
export function parseIsoDate(value: string): Date | null {
  const m = ISO_RE.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  return date.getFullYear() === y && date.getMonth() === mo && date.getDate() === d ? date : null;
}

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === "string" && parseIsoDate(value) !== null;
}

/** Date의 로컬 달력 날짜를 "YYYY-MM-DD"로 */
export function toIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isTimeOfDay(value: unknown): value is TimeOfDay {
  return typeof value === "string" && TIME_RE.test(value);
}

/** 로컬 날짜(자정)에 시각을 더한 Date. 시각이 없거나 잘못되면 null */
export function atTime(date: Date, time: TimeOfDay | null | undefined): Date | null {
  if (!time) return null;
  const m = TIME_RE.exec(time);
  if (!m) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(m[1]), Number(m[2]));
}

/** 로컬 달력 기준으로 n일 뒤(음수면 앞). 시간대·서머타임 영향을 받지 않는다. */
export function addDays(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

/** 로컬 달력 기준 일수 차이 (to - from). 시각은 무시한다. */
export function dayDiff(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY_MS);
}

/** 이번 주의 시작 요일(weekStartsOn)에서 date의 요일 위치 0–6 */
export function weekdayIndex(date: Date, weekStartsOn: 0 | 1): number {
  return (date.getDay() - weekStartsOn + 7) % 7;
}

/** 다음 주 월요일(오늘이 월요일이면 7일 뒤) */
export function nextMonday(today: Date): Date {
  const ahead = (1 - today.getDay() + 7) % 7 || 7;
  return addDays(today, ahead);
}
