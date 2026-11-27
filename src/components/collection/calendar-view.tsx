import { msg, useMessages } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { statusColor } from "@/components/ui/status-chip";
import type { SoftColor } from "@/components/ui/tag-chip";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type * as React from "react";
import type { OpenModifiers } from "./fields";

export type CalendarDay = {
  /** YYYY-MM-DD */
  date: string;
  day: number;
  /** 이번 달이 아닌 날 */
  out?: boolean;
  today?: boolean;
};

/** 주 한 줄 안의 막대 조각 — 레이아웃(features/collection/calendar-span)이 만든다 */
export type CalendarBar = {
  id: string;
  title: string;
  status?: string;
  statusColor?: string;
  /** 주 안에서 시작하는 칸 (0 = 일요일) */
  col: number;
  span: number;
  /** 줄 번호 (0부터) */
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  /** 범위 시작·끝 (YYYY-MM-DD) — 접근성 이름에 쓴다 */
  from: string;
  to: string;
};

export type CalendarWeekView = {
  segments: CalendarBar[];
  /** 칸마다 줄 수를 넘어 숨은 레코드 수 */
  hidden: number[];
};

/** 날짜 칸에 걸친 레코드 (숨은 것 포함, "+N" 펼침에 쓴다) */
export type CalendarDayItem = {
  id: string;
  title: string;
  status?: string;
  statusColor?: string;
};

type CalendarViewProps = {
  /** 예: "2026년 11월" */
  monthLabel: string;
  /** 일요일부터 6주(42칸) */
  days: CalendarDay[];
  /** 주 6줄 — 막대 배치 결과 */
  weeks: CalendarWeekView[];
  /** 날짜별로 걸친 레코드 */
  dayItems: Record<string, CalendarDayItem[]>;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** 레코드 열기 — ⌘(⌃)를 누른 채면 e로 알린다 (COLL-07: 뒤 탭에 열기) */
  onOpen: (id: string, e?: OpenModifiers) => void;
  /** 그 날짜를 마감으로 하는 레코드 만들기 */
  onNew: (date: string) => void;
  /** 막대 줄 수 — 넘치면 칸에 "+N개 더" */
  maxLanes?: number;
  /** 이번 달에 날짜가 있는 레코드가 없을 때 격자 위에 보일 안내 */
  empty?: React.ReactNode;
  className?: string;
};

/** 막대 색 — 레코드의 상태 색 */
const CHIP: Record<SoftColor, string> = {
  gray: "bg-gray-bg text-gray-fg [&>i]:bg-gray-fg",
  brown: "bg-brown-bg text-brown-fg [&>i]:bg-brown-fg",
  orange: "bg-orange-bg text-orange-fg [&>i]:bg-orange-fg",
  yellow: "bg-yellow-bg text-yellow-fg [&>i]:bg-yellow-fg",
  green: "bg-green-bg text-green-fg [&>i]:bg-green-fg",
  blue: "bg-blue-bg text-blue-fg [&>i]:bg-blue-fg",
  purple: "bg-purple-bg text-purple-fg [&>i]:bg-purple-fg",
  pink: "bg-pink-bg text-pink-fg [&>i]:bg-pink-fg",
  red: "bg-red-bg text-red-fg [&>i]:bg-red-fg",
};

const colorOf = (status?: string, color?: string): SoftColor =>
  (color as SoftColor | undefined) ?? (status ? statusColor(status) : "gray");

const dateName = (date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return msg().collection.calendar.monthDay(m, d);
};

/** 막대 한 조각. 같은 레코드가 주마다 나오면 각 조각이 제목을 보여 준다 */
function Bar({ bar, onOpen }: { bar: CalendarBar; onOpen: CalendarViewProps["onOpen"] }) {
  const m = useMessages();
  const title = bar.title || m.collection.untitled;
  const range = m.collection.calendar.spanLabel(title, dateName(bar.from), dateName(bar.to));
  return (
    <button
      type="button"
      onClick={(e) => onOpen(bar.id, e)}
      aria-label={range}
      // 말줄임된 제목은 마우스를 올리면 전체가 보인다
      title={title}
      style={{ gridColumn: `${bar.col + 1} / span ${bar.span}`, gridRow: bar.lane + 2 }}
      className={cn(
        "flex min-h-5.5 min-w-0 items-center gap-1 px-1.5 text-left text-label",
        !bar.continuesBefore && "rounded-l-pill",
        !bar.continuesAfter && "rounded-r-pill",
        "transition-[filter] duration-(--dur-fast) hover:brightness-96 force-hover:brightness-96",
        CHIP[colorOf(bar.status, bar.statusColor)],
        focusRing,
      )}
    >
      {bar.continuesBefore ? null : <i aria-hidden className="size-1.5 shrink-0 rounded-pill" />}
      <span aria-hidden className="min-w-0 flex-1 truncate">
        {title}
      </span>
    </button>
  );
}

/** 펼친 목록의 한 줄 (단일 날짜 칩과 같은 색) */
function Chip({ item, onOpen }: { item: CalendarDayItem; onOpen: CalendarViewProps["onOpen"] }) {
  const m = useMessages();
  const title = item.title || m.collection.untitled;
  return (
    <button
      type="button"
      onClick={(e) => onOpen(item.id, e)}
      title={title}
      className={cn(
        "flex min-h-5.5 w-full min-w-0 items-center gap-1 rounded-pill px-1.5 text-left text-label",
        "transition-[filter] duration-(--dur-fast) hover:brightness-96 force-hover:brightness-96",
        CHIP[colorOf(item.status, item.statusColor)],
        focusRing,
      )}
    >
      <i aria-hidden className="size-1.5 shrink-0 rounded-pill" />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {item.status ? <span className="sr-only">, {item.status}</span> : null}
    </button>
  );
}

/**
 * CL-CalendarView — 캘린더 뷰 (프로토타입 §14). 월 단위 7열 격자.
 * 시작·마감이 있는 레코드는 그 기간만큼 이어진 막대로, 한쪽만 있으면 그 날 하루짜리 막대로 보인다.
 * 주가 바뀌면 막대는 잘리고 끝을 네모로 남긴다. 이번 달이 아닌 날은 흐리게, 오늘은 포인트 테두리로 구분한다.
 * 날짜 칸에 올리면 ＋가 나타나 그 날짜를 마감으로 하는 레코드를 만든다.
 */
function CalendarView({
  monthLabel,
  days,
  weeks,
  dayItems,
  onPrev,
  onNext,
  onToday,
  onOpen,
  onNew,
  maxLanes = 3,
  empty,
  className,
}: CalendarViewProps) {
  const m = useMessages();
  const none = !days.some((d) => !d.out && dayItems[d.date]?.length);
  // 줄 다음 줄 — "+N" 펼침 버튼이 놓이는 줄 (헤더는 1, 막대 줄은 2부터)
  const moreRow = maxLanes + 2;
  return (
    <div data-slot="collection-calendar" className={className}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-body font-semibold text-primary" aria-live="polite">
          {monthLabel}
        </h2>
        <IconButton label={m.collection.calendar.prevMonth} onClick={onPrev}>
          <ChevronLeft strokeWidth={1.5} />
        </IconButton>
        <Button variant="secondary" size="sm" onClick={onToday}>
          {m.collection.calendar.today}
        </Button>
        <IconButton label={m.collection.calendar.nextMonth} onClick={onNext}>
          <ChevronRight strokeWidth={1.5} />
        </IconButton>
      </div>
      {none && empty ? <div className="mb-3">{empty}</div> : null}
      <div className="overflow-hidden rounded-lg border border-line">
        <div aria-hidden className="grid grid-cols-7 border-b border-line bg-subtle">
          {m.collection.calendar.dow.map((d) => (
            <span key={d} className="p-2 text-center text-label font-medium text-secondary">
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week, w) => {
          const cells = days.slice(w * 7, w * 7 + 7);
          return (
            <div
              key={cells[0]?.date ?? w}
              data-slot="calendar-week"
              className={cn(
                "grid min-h-26 auto-rows-max grid-cols-7 content-start gap-y-0.5",
                w < weeks.length - 1 && "border-b border-line",
              )}
            >
              {cells.map((d, i) => {
                const count = dayItems[d.date]?.length ?? 0;
                const name = `${dateName(d.date)}${d.today ? ` (${m.collection.calendar.today})` : ""}`;
                return (
                  <div
                    key={d.date}
                    role="group"
                    aria-label={m.collection.calendar.dayLabel(
                      name,
                      m.collection.model.count(count),
                    )}
                    data-out={d.out || undefined}
                    data-today={d.today || undefined}
                    style={{ gridColumn: i + 1, gridRow: `1 / ${moreRow + 1}` }}
                    className={cn(
                      "border-line",
                      (i + 1) % 7 !== 0 && "border-r",
                      "data-out:bg-subtle data-today:ring-2 data-today:ring-accent data-today:ring-inset",
                    )}
                  />
                );
              })}
              {cells.map((d, i) => (
                <div
                  key={`h-${d.date}`}
                  style={{ gridColumn: i + 1, gridRow: 1 }}
                  className="group/day flex items-center gap-1 p-1 pl-2"
                >
                  <span
                    className={cn(
                      "flex-1 text-label text-secondary",
                      d.out && "text-tertiary",
                      d.today && "font-semibold text-accent",
                    )}
                  >
                    {d.day}
                  </span>
                  <button
                    type="button"
                    aria-label={m.collection.calendar.newOn(dateName(d.date))}
                    onClick={() => onNew(d.date)}
                    className={cn(
                      "grid size-4.5 place-items-center rounded-pill text-tertiary opacity-0 [&_svg]:size-3",
                      "transition-opacity duration-(--dur-fast) group-hover/day:opacity-100 focus-visible:opacity-100 force-hover:opacity-100",
                      "hover:bg-active hover:text-primary force-hover:bg-active",
                      focusRing,
                    )}
                  >
                    <Plus strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
              ))}
              {week.segments.map((bar) => (
                <Bar key={`${bar.id}-${bar.from}`} bar={bar} onOpen={onOpen} />
              ))}
              {week.hidden.map((n, i) =>
                n > 0 ? (
                  <Popover key={`more-${i}`}>
                    <PopoverTrigger
                      style={{ gridColumn: i + 1, gridRow: moreRow }}
                      className={cn(
                        "justify-self-start rounded-pill px-1.5 py-0.5 text-left text-label text-secondary",
                        "hover:bg-hover hover:text-primary force-hover:bg-hover force-hover:text-primary",
                        focusRing,
                      )}
                    >
                      {m.collection.calendar.more(n)}
                      <span className="sr-only">, {dateName(cells[i].date)}</span>
                    </PopoverTrigger>
                    <PopoverContent className="grid w-60 gap-0.5 p-2">
                      <p className="px-1 pb-1 text-label font-medium text-secondary">
                        {dateName(cells[i].date)}
                      </p>
                      {(dayItems[cells[i].date] ?? []).map((item) => (
                        <Chip key={item.id} item={item} onOpen={onOpen} />
                      ))}
                    </PopoverContent>
                  </Popover>
                ) : null,
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { CalendarView, type CalendarViewProps };
