/**
 * 캘린더 날짜 계산 (COLL-04). 끌어서 옮기기·가장자리 늘이기·빈 날 끌어 만들기·주 격자.
 * 순수 함수 — 화면은 결과만 쓰고, 저장은 호출하는 쪽이 한 번에 한다.
 */
import { rangeOf } from "./calendar-span";

const DAY_MS = 86_400_000;

/** YYYY-MM-DD → 날짜 번호 (UTC 기준, 차이 계산용) */
const dayNum = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

const isoOfNum = (n: number) => {
  const d = new Date(n * DAY_MS);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** 날짜를 days일 옮긴다 (음수 가능) */
export function shiftDate(date: string, days: number): string {
  return isoOfNum(dayNum(date) + days);
}

/** from에서 to까지 날 수 차이 (to - from) */
export function dayOffset(from: string, to: string): number {
  return dayNum(to) - dayNum(from);
}

/** 끌기를 시작했다고 볼 최소 이동 거리 (px). 이보다 적게 움직이면 클릭이다 */
export const DRAG_THRESHOLD = 4;

export function passedThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD;
}

/** 기준 날짜가 든 주의 날짜 7개 (일요일 시작) */
export function weekDates(anchor: string): string[] {
  const first = dayNum(anchor) - new Date(dayNum(anchor) * DAY_MS).getUTCDay();
  return Array.from({ length: 7 }, (_, i) => isoOfNum(first + i));
}

export type ScheduleProps = { start: string | null; due: string | null };

/**
 * 막대에서 하는 변경.
 * - move: 몸통을 끌었다 — 있는 날짜를 모두 같은 일수만큼 옮긴다
 * - start / due: 가장자리 손잡이를 끌었다 — 그 날짜만 바꾼다 (시작 ≤ 마감으로 자른다)
 */
export type RescheduleChange =
  { kind: "move"; days: number } | { kind: "start" | "due"; date: string };

/**
 * 변경을 적용한 새 시작·마감. 바뀌는 게 없으면 null.
 * 날짜가 하나도 없는 레코드는 옮길 수 없어 null.
 */
export function rescheduleRecord(
  current: ScheduleProps,
  change: RescheduleChange,
): ScheduleProps | null {
  if (change.kind === "move") {
    if (change.days === 0 || (!current.start && !current.due)) return null;
    return {
      start: current.start ? shiftDate(current.start, change.days) : null,
      due: current.due ? shiftDate(current.due, change.days) : null,
    };
  }
  if (change.kind === "start") {
    // 시작은 마감을 넘지 못한다
    const start = current.due && change.date > current.due ? current.due : change.date;
    return start === current.start ? null : { start, due: current.due };
  }
  // 마감은 시작보다 앞서지 못한다
  const due = current.start && change.date < current.start ? current.start : change.date;
  return due === current.due ? null : { start: current.start, due };
}

/** 빈 날에서 끌어 만든 범위: 먼저 누른 날 ~ 지금 날 (앞뒤 무관) */
export function rangeFromDrag(anchor: string, current: string): ScheduleProps {
  return anchor <= current ? { start: anchor, due: current } : { start: current, due: anchor };
}

/**
 * 한 주(dates 7칸) 안에 보이는 막대 조각 (미리보기용). 주와 겹치지 않으면 null.
 * col은 주 안 칸 번호(0 = 일요일), span은 칸 수.
 */
export function clipToWeek(
  range: { from: string; to: string },
  dates: readonly string[],
): { col: number; span: number; continuesBefore: boolean; continuesAfter: boolean } | null {
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  if (range.to < first || range.from > last) return null;
  const col = Math.max(0, dayOffset(first, range.from));
  const endCol = Math.min(dates.length - 1, dayOffset(first, range.to));
  return {
    col,
    span: endCol - col + 1,
    continuesBefore: range.from < first,
    continuesAfter: range.to > last,
  };
}

/** 미리보기용: 새 시작·마감의 날짜 범위 (rangeOf와 같은 규칙) */
export function previewRange(next: ScheduleProps) {
  return rangeOf(next.start, next.due);
}
