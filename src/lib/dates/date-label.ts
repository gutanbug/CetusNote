import { dayDiff, parseIsoDate, type IsoDate, type TimeOfDay } from "./local-date";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 상대 표시를 쓰는 가까운 날 범위(앞으로 N일). EDIT-36 「3일 뒤」 */
const RELATIVE_FUTURE_DAYS = 6;

function absolute(date: Date, now: Date): string {
  const md = `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
  return date.getFullYear() === now.getFullYear() ? md : `${date.getFullYear()}년 ${md}`;
}

/**
 * 날짜 칩의 표시 문구. `now` 기준 로컬 날짜로 판단한다.
 * 오늘 · 내일 · 어제 · 2–6일 뒤 · 그 밖은 "11월 28일 (토)" (다른 해면 "2027년 1월 3일 (일)").
 * 잘못된 값은 그대로 돌려준다.
 */
export function formatDateLabel(value: IsoDate, now: Date = new Date()): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  const diff = dayDiff(now, date);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === -1) return "어제";
  if (diff >= 2 && diff <= RELATIVE_FUTURE_DAYS) return `${diff}일 뒤`;
  return absolute(date, now);
}

/** 마우스를 올렸을 때 보이는 절대 표시: "2026년 11월 28일 (토) 09:00" */
export function formatAbsoluteLabel(value: IsoDate, time?: TimeOfDay | null): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  const day = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
  return time ? `${day} ${time}` : day;
}

/** 상대 표시 + 시각: "내일 14:30" */
export function formatDateTimeLabel(
  value: IsoDate,
  time?: TimeOfDay | null,
  now: Date = new Date(),
): string {
  const label = formatDateLabel(value, now);
  return time ? `${label} ${time}` : label;
}
