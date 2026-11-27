import { msg } from "@/lib/i18n";
import { dayDiff, parseIsoDate, type IsoDate, type TimeOfDay } from "./local-date";

/** 상대 표시를 쓰는 가까운 날 범위(앞으로 N일). EDIT-36 「3일 뒤」 */
const RELATIVE_FUTURE_DAYS = 6;

function absolute(date: Date, now: Date): string {
  return msg().features.dates.absoluteDay(date, date.getFullYear() !== now.getFullYear());
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
  const d = msg().features.dates;
  if (diff === 0) return d.today;
  if (diff === 1) return d.tomorrow;
  if (diff === -1) return d.yesterday;
  if (diff >= 2 && diff <= RELATIVE_FUTURE_DAYS) return d.daysLater(diff);
  return absolute(date, now);
}

/** 마우스를 올렸을 때 보이는 절대 표시: "2026년 11월 28일 (토) 09:00" */
export function formatAbsoluteLabel(value: IsoDate, time?: TimeOfDay | null): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  const day = msg().features.dates.absoluteDay(date, true);
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
