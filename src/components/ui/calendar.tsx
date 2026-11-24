import { cn } from "@/lib/utils";
import {
  addDays,
  isIsoDate,
  type IsoDate,
  parseIsoDate,
  toIsoDate,
  weekdayIndex,
} from "@/lib/dates/local-date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { IconButton } from "./icon-button";
import { focusRing } from "./styles";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
/** 월 격자는 항상 6주(42칸)라 달이 바뀌어도 높이가 흔들리지 않는다 */
const CELLS = 42;

export type CalendarProps = {
  /** 선택한 날짜 (ISO "YYYY-MM-DD") */
  value?: IsoDate | null;
  onChange?: (date: IsoDate) => void;
  /** 이 날짜 이전·이후는 고를 수 없다 (칸은 보이고 흐리게) */
  min?: IsoDate;
  max?: IsoDate;
  /** 한 주의 첫 날. 0 = 일요일(기본), 1 = 월요일 */
  weekStartsOn?: 0 | 1;
  /** 오늘 기준 날짜. 기본은 지금 — 스토리·테스트에서 고정할 때 쓴다 */
  today?: Date;
  /** 처음 보여 줄 달 (value가 없을 때). 기본은 오늘이 있는 달 */
  defaultMonth?: IsoDate;
  /** Esc를 눌렀을 때 (팝오버 안에서는 팝오버가 함께 닫힌다) */
  onEscape?: () => void;
  /** 격자 이름 (스크린 리더). 기본 "달력" */
  label?: string;
  className?: string;
};

const addMonths = (d: Date, n: number) => {
  // 31일에서 한 달 뒤로 가면 말일로 맞춘다(3월 3일 → 2월 3일이 아니라 3월 31일 → 2월 28일)
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
};

const startOfWeek = (d: Date, weekStartsOn: 0 | 1) => addDays(d, -weekdayIndex(d, weekStartsOn));

function clampDay(d: Date, min: Date | null, max: Date | null): Date {
  if (min && d < min) return min;
  if (max && d > max) return max;
  return d;
}

/**
 * UI-Calendar — 월 격자 날짜 고르기. 팝오버 안(ED-DateChip)과 CL-CalendarView 확장에 쓴다.
 * 키보드: 방향키 한 칸·한 주, Home/End 주의 처음·끝, PageUp/PageDown 달, Shift+PageUp/Down 해,
 * Enter·Space 고르기, Esc는 onEscape. 격자는 한 칸만 Tab으로 들어간다(roving).
 */
function Calendar({
  value,
  onChange,
  min,
  max,
  weekStartsOn = 0,
  today,
  defaultMonth,
  onEscape,
  label = "달력",
  className,
}: CalendarProps) {
  const now = today ?? new Date();
  const minDate = min ? parseIsoDate(min) : null;
  const maxDate = max ? parseIsoDate(max) : null;
  const selected = value && isIsoDate(value) ? parseIsoDate(value) : null;

  /** 키보드가 가리키는 날짜. 보이는 달은 이 날짜의 달을 따른다 */
  const [focus, setFocus] = React.useState<Date>(() =>
    clampDay(
      selected ?? (defaultMonth ? parseIsoDate(defaultMonth) : null) ?? now,
      minDate,
      maxDate,
    ),
  );
  const focusKey = toIsoDate(focus);

  // 밖에서 값이 바뀌면(예: 빠른 선택 버튼) 그 날짜로 옮긴다
  const valueKey = selected ? toIsoDate(selected) : null;
  const [lastValue, setLastValue] = React.useState(valueKey);
  if (valueKey !== lastValue) {
    setLastValue(valueKey);
    if (selected) setFocus(selected);
  }

  const gridRef = React.useRef<HTMLDivElement>(null);
  // 키보드로 옮긴 뒤에만 포커스를 옮긴다(이전·다음 버튼을 누를 때 포커스를 뺏지 않게)
  const wantFocus = React.useRef(false);
  React.useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusKey}"]`)?.focus();
  }, [focusKey]);

  const viewYear = focus.getFullYear();
  const viewMonth = focus.getMonth();
  const monthStart = new Date(viewYear, viewMonth, 1);
  const first = startOfWeek(monthStart, weekStartsOn);
  const days = Array.from({ length: CELLS }, (_, i) => addDays(first, i));
  const captionId = React.useId();
  const todayKey = toIsoDate(now);

  const isDisabled = (d: Date) =>
    (minDate !== null && d < minDate) || (maxDate !== null && d > maxDate);

  const move = (next: Date) => {
    wantFocus.current = true;
    setFocus(clampDay(next, minDate, maxDate));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, day: Date) => {
    let next: Date;
    switch (e.key) {
      case "ArrowLeft":
        next = addDays(day, -1);
        break;
      case "ArrowRight":
        next = addDays(day, 1);
        break;
      case "ArrowUp":
        next = addDays(day, -7);
        break;
      case "ArrowDown":
        next = addDays(day, 7);
        break;
      case "Home":
        next = startOfWeek(day, weekStartsOn);
        break;
      case "End":
        next = addDays(startOfWeek(day, weekStartsOn), 6);
        break;
      case "PageUp":
        next = e.shiftKey ? addMonths(day, -12) : addMonths(day, -1);
        break;
      case "PageDown":
        next = e.shiftKey ? addMonths(day, 12) : addMonths(day, 1);
        break;
      case "Escape":
        if (onEscape) {
          e.preventDefault();
          onEscape();
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    move(next);
  };

  const pick = (day: Date) => {
    if (isDisabled(day)) return;
    const iso = toIsoDate(day);
    setFocus(day);
    onChange?.(iso);
  };

  const weekdays = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);

  return (
    <div data-slot="calendar" className={cn("grid w-70 gap-2 text-body text-primary", className)}>
      <div className="flex items-center justify-between gap-2">
        <IconButton label="이전 달" size="sm" onClick={() => move(addMonths(focus, -1))}>
          <ChevronLeft strokeWidth={1.5} />
        </IconButton>
        <div id={captionId} aria-live="polite" className="text-ui font-medium">
          {viewYear}년 {viewMonth + 1}월
        </div>
        <IconButton label="다음 달" size="sm" onClick={() => move(addMonths(focus, 1))}>
          <ChevronRight strokeWidth={1.5} />
        </IconButton>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-labelledby={captionId}
        aria-label={label}
        className="grid gap-0.5"
      >
        <div role="row" className="grid grid-cols-7">
          {weekdays.map((w) => (
            <div
              key={w}
              role="columnheader"
              aria-label={WEEKDAY_NAMES[w]}
              className="grid h-7 place-items-center text-label font-medium text-tertiary"
            >
              {WEEKDAY_LABELS[w]}
            </div>
          ))}
        </div>

        {Array.from({ length: CELLS / 7 }, (_, week) => (
          // 행은 그 주의 첫 날짜로 키를 준다 — 달이 바뀌어도 같은 주의 DOM이 남아 포커스가 빠지지 않는다
          <div key={toIsoDate(days[week * 7])} role="row" className="grid grid-cols-7">
            {days.slice(week * 7, week * 7 + 7).map((day) => {
              const iso = toIsoDate(day);
              const isSelected = valueKey === iso;
              const isToday = iso === todayKey;
              const outside = day.getMonth() !== viewMonth;
              const disabled = isDisabled(day);
              return (
                <div
                  key={iso}
                  role="gridcell"
                  aria-selected={isSelected}
                  className="grid place-items-center p-0.5"
                >
                  <button
                    type="button"
                    data-iso={iso}
                    tabIndex={iso === focusKey ? 0 : -1}
                    // 이름은 화면의 날짜 숫자 그대로 둔다(aria-label이 숫자와 어긋나면 WCAG 2.5.3에 걸린다). 전체 날짜는 title로.
                    title={`${day.getFullYear()}년 ${day.getMonth() + 1}월 ${day.getDate()}일 ${WEEKDAY_NAMES[day.getDay()]}`}
                    aria-current={isToday ? "date" : undefined}
                    aria-disabled={disabled || undefined}
                    onClick={() => pick(day)}
                    onKeyDown={(e) => onKeyDown(e, day)}
                    onFocus={() => {
                      // 마우스로 옆 칸에 포커스가 가도 키보드 기준점이 따라온다
                      if (iso !== focusKey) setFocus(day);
                    }}
                    className={cn(
                      "grid size-8 place-items-center rounded-md text-ui tabular-nums transition-colors",
                      "hover:bg-hover force-hover:bg-hover",
                      outside && "text-tertiary",
                      isToday && !isSelected && "border border-accent text-accent",
                      isSelected && "bg-accent-soft font-semibold text-accent",
                      disabled && "pointer-events-none text-tertiary opacity-40",
                      focusRing,
                    )}
                  >
                    {day.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export { Calendar };
