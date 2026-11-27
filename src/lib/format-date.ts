import { intlLocale, msg } from "@/lib/i18n";

/** 날짜 문구 (해요체 UI). 시간대는 사용자의 지역 시간 */

/** "2026년 11월 19일" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat(intlLocale(), {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(d);
}

/** "방금" · "5분 전" · "3시간 전" · "2일 전" · 일주일이 넘으면 날짜 */
export function formatAgo(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const min = Math.floor((now.getTime() - d.getTime()) / 60_000);
  const t = msg().features.dates;
  if (min < 1) return t.justNow;
  if (min < 60) return t.minutesAgo(min);
  const hours = Math.floor(min / 60);
  if (hours < 24) return t.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  if (days < 7) return t.daysAgo(days);
  return formatDate(iso);
}
