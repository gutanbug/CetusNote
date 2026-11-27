/**
 * 캘린더 막대 배치 (COLL-03). 시작·마감이 있는 레코드를 한 주(7칸) 단위 조각으로 나눠
 * 줄(lane)에 쌓는다. 순수 함수 — 화면은 결과만 그린다.
 */

export type CalendarSpanInput = {
  id: string;
  title: string;
  status?: string;
  statusColor?: string;
  /** 시작 YYYY-MM-DD 또는 null */
  start: string | null;
  /** 마감 YYYY-MM-DD 또는 null */
  due: string | null;
};

export type DateRange = { from: string; to: string };

const DAY_MS = 86_400_000;
/** YYYY-MM-DD → 그레고리 날짜 번호 (날짜 차이 계산용) */
const dayNum = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

/**
 * 시작·마감으로 날짜 범위를 정한다.
 * 둘 다 있고 시작이 마감보다 늦으면 값은 그대로 두고 범위만 시작 하루짜리로 본다(자동으로 고치지 않는다).
 */
export function rangeOf(start: string | null, due: string | null): DateRange | null {
  if (start && due) return start <= due ? { from: start, to: due } : { from: start, to: start };
  if (due) return { from: due, to: due };
  if (start) return { from: start, to: start };
  return null;
}

export type CalendarSegment = {
  id: string;
  title: string;
  status?: string;
  statusColor?: string;
  /** 주 안에서 시작하는 칸 (0 = 일요일) */
  col: number;
  /** 차지하는 칸 수 (1~7) */
  span: number;
  /** 줄 번호 (0부터). maxLanes 미만만 담긴다 */
  lane: number;
  /** 이전 주에서 이어진다 — 왼쪽 끝을 네모로 */
  continuesBefore: boolean;
  /** 다음 주로 이어진다 — 오른쪽 끝을 네모로 */
  continuesAfter: boolean;
  from: string;
  to: string;
  /** 레코드의 원래 시작·마감 (드래그 미리보기·손잡이에 쓴다) */
  start: string | null;
  due: string | null;
};

export type CalendarWeek = {
  segments: CalendarSegment[];
  /** 칸마다 줄 수를 넘어 숨은 레코드 수 (길이 7) */
  hidden: number[];
};

export type CalendarLayout = {
  weeks: CalendarWeek[];
  /** 날짜별로 그 날에 걸친 레코드 (숨은 것 포함) */
  dayItems: Record<string, CalendarSpanInput[]>;
};

/**
 * 날짜 격자(일요일 시작, 7의 배수 칸)에 레코드 막대를 배치한다.
 * 정렬: 시작일 빠른 순 → 기간 긴 순 → id. 줄은 그 순서대로 가장 위의 빈 줄에 넣는다.
 */
export function layoutCalendar(
  dates: readonly string[],
  records: readonly CalendarSpanInput[],
  maxLanes = 3,
): CalendarLayout {
  const items = records
    .flatMap((r) => {
      const range = rangeOf(r.start, r.due);
      return range ? [{ r, range }] : [];
    })
    .sort(
      (a, b) =>
        (a.range.from < b.range.from ? -1 : a.range.from > b.range.from ? 1 : 0) ||
        dayNum(b.range.to) - dayNum(b.range.from) - (dayNum(a.range.to) - dayNum(a.range.from)) ||
        (a.r.id < b.r.id ? -1 : a.r.id > b.r.id ? 1 : 0),
    );

  const dayItems: Record<string, CalendarSpanInput[]> = {};
  for (const d of dates)
    dayItems[d] = items.filter((x) => x.range.from <= d && d <= x.range.to).map((x) => x.r);

  const weeks: CalendarWeek[] = [];
  for (let w = 0; w * 7 < dates.length; w++) {
    const first = dayNum(dates[w * 7]);
    const last = first + 6;
    const laneEnd: number[] = []; // 줄마다 마지막으로 차지한 칸 (포함)
    const segments: CalendarSegment[] = [];
    const hidden = [0, 0, 0, 0, 0, 0, 0];
    for (const { r, range } of items) {
      const from = dayNum(range.from);
      const to = dayNum(range.to);
      if (to < first || from > last) continue;
      const startCol = Math.max(0, from - first);
      const endCol = Math.min(6, to - first);
      let lane = 0;
      while (laneEnd[lane] !== undefined && laneEnd[lane] >= startCol) lane++;
      laneEnd[lane] = endCol;
      if (lane >= maxLanes) {
        for (let c = startCol; c <= endCol; c++) hidden[c]++;
        continue;
      }
      segments.push({
        id: r.id,
        title: r.title,
        status: r.status,
        statusColor: r.statusColor,
        col: startCol,
        span: endCol - startCol + 1,
        lane,
        continuesBefore: from < first,
        continuesAfter: to > last,
        from: range.from,
        to: range.to,
        start: r.start,
        due: r.due,
      });
    }
    segments.sort((a, b) => a.lane - b.lane || a.col - b.col);
    weeks.push({ segments, hidden });
  }
  return { weeks, dayItems };
}
