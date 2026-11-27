import { msg, useMessages } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { statusColor } from "@/components/ui/status-chip";
import type { SoftColor } from "@/components/ui/tag-chip";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { rangeOf } from "@/features/collection/calendar-span";
import {
  clipToWeek,
  dayOffset,
  passedThreshold,
  rangeFromDrag,
  rescheduleRecord,
  shiftDate,
  type RescheduleChange,
  type ScheduleProps,
} from "@/features/collection/calendar-range";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
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
  /** 레코드의 원래 시작·마감 */
  start: string | null;
  due: string | null;
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

export type CalendarMode = "month" | "week";

type CalendarViewProps = {
  /** 예: "2026년 11월" (주 보기면 "11월 22일 – 11월 28일") */
  monthLabel: string;
  /** 월 보기: 일요일부터 6주(42칸). 주 보기: 7칸 */
  days: CalendarDay[];
  /** 주 줄 — 막대 배치 결과 */
  weeks: CalendarWeekView[];
  /** 날짜별로 걸친 레코드 */
  dayItems: Record<string, CalendarDayItem[]>;
  /** 보기 방식. 없으면 월 보기로만 그린다 */
  mode?: CalendarMode;
  onModeChange?: (mode: CalendarMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** 레코드 열기 — ⌘(⌃)를 누른 채면 e로 알린다 (COLL-07: 뒤 탭에 열기) */
  onOpen: (id: string, e?: OpenModifiers) => void;
  /** 그 날짜를 마감으로 하는 레코드 만들기 */
  onNew: (date: string) => void;
  /** 막대를 끌어 옮기거나 가장자리를 끌어 늘였다 — 바뀐 날짜 변경만 보낸다 */
  onReschedule?: (id: string, change: RescheduleChange) => void;
  /** 빈 날을 끌어 만든 범위로 새 레코드 만들기 */
  onCreateRange?: (range: ScheduleProps) => void;
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

type BarChange = "move" | "start" | "due";

/** 끄는 중인 동작. 몸통(move)·가장자리(start/due)·빈 날(create) */
type Gesture = {
  x: number;
  y: number;
  change: BarChange | "create";
  bar: CalendarBar | null;
  /** 몸통: 잡은 날짜 · 만들기: 누른 날짜 */
  anchor: string;
  moved: boolean;
  target: string | null;
  latest: RescheduleChange | null;
  stop: () => void;
};

/** 화면에 그리는 미리보기 */
type Preview =
  | { kind: "bar"; id: string; lane: number; next: ScheduleProps | null }
  | { kind: "create"; range: ScheduleProps };

/** 이벤트 아래의 날짜 칸 (막대 위에서도 칸을 찾는다) */
function dateAt(e: { target: EventTarget | null; clientX: number; clientY: number }) {
  if (e.target instanceof Element) {
    const own = e.target.closest<HTMLElement>("[data-date]");
    if (own?.dataset.date) return own.dataset.date;
  }
  const hit = document
    .elementsFromPoint(e.clientX, e.clientY)
    .find((el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.date);
  return hit?.dataset.date ?? null;
}

/** 막대 한 조각. 같은 레코드가 주마다 나오면 각 조각이 제목을 보여 준다 */
function Bar({
  bar,
  dates,
  dragging,
  onOpen,
  onBegin,
  onKey,
}: {
  bar: CalendarBar;
  /** 이 주의 날짜 7칸 (몸통을 잡은 칸을 찾는다) */
  dates: string[];
  dragging: boolean;
  onOpen: CalendarViewProps["onOpen"];
  onBegin: (
    e: React.PointerEvent<HTMLElement>,
    bar: CalendarBar,
    change: BarChange,
    dates: string[],
  ) => void;
  onKey: (bar: CalendarBar, change: RescheduleChange) => void;
}) {
  const m = useMessages();
  const title = bar.title || m.collection.untitled;
  const range = m.collection.calendar.spanLabel(title, dateName(bar.from), dateName(bar.to));
  const edge = (side: "start" | "due") => (
    <span
      aria-hidden
      data-handle={side}
      onPointerDown={(e) => onBegin(e, bar, side, dates)}
      className={cn(
        "absolute inset-y-0 w-1.5 cursor-ew-resize",
        side === "start" ? "left-0 rounded-l-pill" : "right-0 rounded-r-pill",
      )}
    />
  );
  return (
    <button
      type="button"
      data-bar-id={bar.id}
      onClick={(e) => onOpen(bar.id, e)}
      onPointerDown={(e) => onBegin(e, bar, "move", dates)}
      onKeyDown={(e) => {
        if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        e.preventDefault();
        const step = e.key === "ArrowRight" ? 1 : -1;
        // ⌥⌘←/→ 시작 · ⌥⇧←/→ 마감 · ⌥←/→ 몸통 (⌃+방향키는 macOS 스페이스 전환과 겹쳐 쓰지 않는다)
        if (e.metaKey) {
          if (!bar.continuesBefore)
            onKey(bar, { kind: "start", date: shiftDate(bar.start ?? bar.from, step) });
          return;
        }
        onKey(
          bar,
          e.shiftKey
            ? { kind: "due", date: shiftDate(bar.due ?? bar.to, step) }
            : { kind: "move", days: step },
        );
      }}
      aria-label={range}
      // 말줄임된 제목은 마우스를 올리면 전체가 보인다
      title={title}
      data-dragging={dragging || undefined}
      style={{ gridColumn: `${bar.col + 1} / span ${bar.span}`, gridRow: bar.lane + 2 }}
      className={cn(
        "relative flex min-h-6 min-w-0 items-center gap-1 px-1.5 text-left text-label",
        !bar.continuesBefore && "rounded-l-pill",
        !bar.continuesAfter && "rounded-r-pill",
        "transition-opacity duration-(--dur-fast) hover:opacity-90 force-hover:opacity-90",
        "data-dragging:pointer-events-none data-dragging:opacity-45",
        CHIP[colorOf(bar.status, bar.statusColor)],
        focusRing,
      )}
    >
      {bar.continuesBefore ? null : <i aria-hidden className="size-1.5 shrink-0 rounded-pill" />}
      <span aria-hidden className="min-w-0 flex-1 truncate">
        {title}
      </span>
      {bar.continuesBefore ? null : edge("start")}
      {bar.continuesAfter ? null : edge("due")}
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
        "flex min-h-6 w-full min-w-0 items-center gap-1 rounded-pill px-1.5 text-left text-label",
        "transition-opacity duration-(--dur-fast) hover:opacity-90 force-hover:opacity-90",
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
 * CL-CalendarView — 캘린더 뷰 (프로토타입 §14). 월 보기(7열×6주)와 주 보기(7열×1주).
 * 시작·마감이 있는 레코드는 그 기간만큼 이어진 막대로, 한쪽만 있으면 그 날 하루짜리 막대로 보인다.
 * 막대 몸통을 끌면 기간 전체가, 가장자리를 끌면 시작 또는 마감만 옮겨진다 (Esc로 취소).
 * 빈 날을 끌면 그 범위로 새 레코드를 만든다. 막대에 포커스가 있으면 ⌥←/→ 로 옮기고 ⌥⇧←/→ 로 마감을, ⌥⌘←/→ 로 시작을 바꾼다.
 */
function CalendarView({
  monthLabel,
  days,
  weeks,
  dayItems,
  mode = "month",
  onModeChange,
  onPrev,
  onNext,
  onToday,
  onOpen,
  onNew,
  onReschedule,
  onCreateRange,
  maxLanes = 3,
  empty,
  className,
}: CalendarViewProps) {
  const m = useMessages();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [announce, setAnnounce] = useState("");
  const gesture = useRef<Gesture | null>(null);
  // 끌기가 끝난 뒤 따라오는 click은 레코드를 열지 않는다
  const suppressClick = useRef(false);
  // 키보드로 옮긴 막대는 다시 그려진 뒤 같은 레코드 막대에 포커스를 되돌린다
  const focusId = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const none = !days.some((d) => !d.out && dayItems[d.date]?.length);
  // 줄 다음 줄 — "+N" 펼침 버튼이 놓이는 줄 (헤더는 1, 막대 줄은 2부터)
  const moreRow = maxLanes + 2;
  const weekMode = mode === "week";

  useEffect(() => () => gesture.current?.stop(), []);
  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-bar-id="${id}"]`);
    if (el) {
      el.focus();
      focusId.current = null;
    }
  });

  const rangeText = (title: string, r: ScheduleProps) =>
    m.collection.calendar.spanLabel(
      title || m.collection.untitled,
      dateName((r.start ?? r.due)!),
      dateName((r.due ?? r.start)!),
    );

  /** 막대를 옮긴다 (끌기 끝·키보드 공통). 실제로 바뀌면 true */
  const commitChange = (bar: CalendarBar, change: RescheduleChange) => {
    const next = rescheduleRecord({ start: bar.start, due: bar.due }, change);
    if (!next) return false;
    onReschedule?.(bar.id, change);
    setAnnounce(m.collection.calendar.moved(rangeText(bar.title, next)));
    return true;
  };

  const finish = (commit: boolean) => {
    const g = gesture.current;
    if (!g) return;
    g.stop();
    gesture.current = null;
    setPreview(null);
    if (g.moved) suppressClick.current = true;
    if (!commit || !g.moved || !g.target) return;
    if (g.change === "create") {
      if (g.target !== g.anchor) onCreateRange?.(rangeFromDrag(g.anchor, g.target));
      return;
    }
    if (g.bar && g.latest) commitChange(g.bar, g.latest);
  };

  const begin = (
    e: React.PointerEvent<HTMLElement>,
    init: Pick<Gesture, "change" | "bar" | "anchor">,
  ) => {
    if (e.button !== 0) return;
    gesture.current?.stop();
    suppressClick.current = false;
    const onMove = (ev: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      if (!g.moved) {
        if (!passedThreshold(ev.clientX - g.x, ev.clientY - g.y)) return;
        g.moved = true;
      }
      const d = dateAt(ev);
      if (d) g.target = d;
      if (!g.target) return;
      if (g.change === "create") {
        setPreview({ kind: "create", range: rangeFromDrag(g.anchor, g.target) });
        return;
      }
      const bar = g.bar!;
      const change: RescheduleChange =
        g.change === "move"
          ? { kind: "move", days: dayOffset(g.anchor, g.target) }
          : { kind: g.change, date: g.target };
      g.latest = change;
      setPreview({
        kind: "bar",
        id: bar.id,
        lane: bar.lane,
        next: rescheduleRecord({ start: bar.start, due: bar.due }, change),
      });
    };
    const onUp = () => finish(true);
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      finish(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKeyDown, true);
    gesture.current = {
      ...init,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      target: null,
      latest: null,
      stop: () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("keydown", onKeyDown, true);
      },
    };
  };

  const beginBar = (
    e: React.PointerEvent<HTMLElement>,
    bar: CalendarBar,
    change: BarChange,
    dates: string[],
  ) => {
    // 가장자리 손잡이가 몸통 핸들러까지 올라가지 않게
    e.stopPropagation();
    let anchor = bar.from;
    if (change === "move") {
      // 잡은 자리의 칸을 기준으로 옮긴 일수를 잰다
      const rect = e.currentTarget.getBoundingClientRect();
      const i = Math.min(
        bar.span - 1,
        Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * bar.span)),
      );
      anchor = dates[bar.col + i] ?? bar.from;
    }
    begin(e, { change, bar, anchor });
  };

  const beginCreate = (e: React.PointerEvent<HTMLElement>) => {
    if (!onCreateRange || e.button !== 0) return;
    const target = e.target instanceof Element ? e.target : null;
    // 막대·+ 버튼 위에서 누른 것은 따로 다룬다
    if (!target || target.closest("button")) return;
    const cell = target.closest<HTMLElement>("[data-date]");
    if (!cell?.dataset.date) return;
    begin(e, { change: "create", bar: null, anchor: cell.dataset.date });
  };

  const openBar = (id: string, e?: OpenModifiers) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onOpen(id, e);
  };

  const nudge = (bar: CalendarBar, change: RescheduleChange) => {
    if (commitChange(bar, change)) focusId.current = bar.id;
  };

  /** 주 칸 위의 미리보기 막대 (옮기는 중인 레코드의 새 기간) */
  const ghostFor = (dates: string[]) => {
    if (preview?.kind !== "bar" || !preview.next) return null;
    const r = rangeOf(preview.next.start, preview.next.due);
    const c = r && clipToWeek(r, dates);
    if (!c) return null;
    return (
      <div
        key="ghost"
        aria-hidden
        data-slot="calendar-ghost"
        style={{ gridColumn: `${c.col + 1} / span ${c.span}`, gridRow: preview.lane + 2 }}
        className="pointer-events-none flex min-h-6 items-center rounded-pill border border-dashed border-accent bg-elevated px-1.5 text-label text-secondary"
      />
    );
  };

  /** 빈 날 끌기의 선택 범위 표시 */
  const createFor = (dates: string[]) => {
    if (preview?.kind !== "create") return null;
    const r = rangeOf(preview.range.start, preview.range.due);
    const c = r && clipToWeek(r, dates);
    if (!c) return null;
    return (
      <div
        key="create"
        aria-hidden
        data-slot="calendar-create"
        style={{ gridColumn: `${c.col + 1} / span ${c.span}`, gridRow: `1 / ${moreRow + 1}` }}
        className="pointer-events-none bg-hover"
      />
    );
  };

  return (
    <div data-slot="collection-calendar" className={className} ref={rootRef}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-body font-semibold text-primary">{monthLabel}</h2>
        {onModeChange ? (
          <div className="flex items-center gap-1">
            {(["month", "week"] as const).map((v) => (
              <Button
                key={v}
                variant={mode === v ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={mode === v}
                onClick={() => onModeChange(v)}
              >
                {v === "month" ? m.collection.calendar.modeMonth : m.collection.calendar.modeWeek}
              </Button>
            ))}
          </div>
        ) : null}
        <IconButton
          label={weekMode ? m.collection.calendar.prevWeek : m.collection.calendar.prevMonth}
          onClick={onPrev}
        >
          <ChevronLeft strokeWidth={1.5} />
        </IconButton>
        <Button variant="secondary" size="sm" onClick={onToday}>
          {m.collection.calendar.today}
        </Button>
        <IconButton
          label={weekMode ? m.collection.calendar.nextWeek : m.collection.calendar.nextMonth}
          onClick={onNext}
        >
          <ChevronRight strokeWidth={1.5} />
        </IconButton>
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
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
          const dates = cells.map((c) => c.date);
          return (
            <div
              key={cells[0]?.date ?? w}
              data-slot="calendar-week"
              onPointerDown={beginCreate}
              className={cn(
                "grid auto-rows-max grid-cols-7 content-start gap-y-0.5 select-none",
                weekMode ? "min-h-56" : "min-h-26",
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
                    data-date={d.date}
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
              {createFor(dates)}
              {cells.map((d, i) => (
                <div
                  key={`h-${d.date}`}
                  data-date={d.date}
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
                <Bar
                  key={bar.id}
                  bar={bar}
                  dates={dates}
                  dragging={preview?.kind === "bar" && preview.id === bar.id}
                  onOpen={openBar}
                  onBegin={beginBar}
                  onKey={nudge}
                />
              ))}
              {preview?.kind === "bar" ? ghostFor(dates) : null}
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
