import type { PageVersion } from "@/lib/storage";

/** 목록 한 줄에 그릴 값 (시각·상대 시각·글자 수는 문자열로 만든다) */
export type VersionRow = {
  id: string;
  time: string;
  relative: string;
  chars: string;
};

export type VersionGroup = { label: string; rows: VersionRow[] };

const pad = (n: number) => String(n).padStart(2, "0");

/** 지역 날짜의 자정 (하루 단위 비교용) */
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** 하루 단위 그룹 이름: 오늘 · 어제 · 같은 해면 "M월 D일" · 그 밖은 "YYYY년 M월 D일" */
export function dayLabel(date: Date, now: Date): string {
  const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  const base = `${date.getMonth() + 1}월 ${date.getDate()}일`;
  return date.getFullYear() === now.getFullYear() ? base : `${date.getFullYear()}년 ${base}`;
}

/** 지금부터 얼마나 됐는지: 방금 전 · N분 전 · N시간 전 · N일 전 */
export function relativeTime(date: Date, now: Date): string {
  const min = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

/** 버전을 날짜 그룹(최근 것이 앞)으로 나눈다. 입력은 최근 것이 앞이어야 한다 */
export function groupVersions(versions: PageVersion[], now: Date): VersionGroup[] {
  const groups: VersionGroup[] = [];
  for (const v of versions) {
    const date = new Date(v.savedAt);
    if (Number.isNaN(date.getTime())) continue;
    const label = dayLabel(date, now);
    const row: VersionRow = {
      id: v.id,
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
      relative: relativeTime(date, now),
      chars: `${v.chars.toLocaleString("ko-KR")}자`,
    };
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}
