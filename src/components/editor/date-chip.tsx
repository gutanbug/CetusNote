import { describeDateChip, type DateChipValue } from "@/lib/dates/date-chip";
import {
  addDays,
  nextMonday,
  toIsoDate,
  type IsoDate,
  type TimeOfDay,
} from "@/lib/dates/local-date";
import {
  customReminderTime,
  followChipTime,
  isReminderOptionEnabled,
  NO_REMINDER,
  REMINDER_OPTIONS,
  reminderOptionKey,
  type ReminderOptionKey,
  type ReminderRule,
} from "@/lib/dates/reminder";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { inputClass } from "@/components/ui/input";
import { focusRing, press } from "@/components/ui/styles";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type DateChipProps = Omit<React.ComponentProps<"button">, "value"> & {
  value: DateChipValue;
  /** 기준 시각 (상대 문구·기한 지남 판정). 기본은 지금 */
  now?: Date;
  /** 노드가 선택된 상태 (방향키로 고른 뒤) */
  selected?: boolean;
  /** 날짜 팝오버가 열린 상태 */
  open?: boolean;
};

/**
 * ED-DateChip — 본문의 날짜 칩. 상대 문구(오늘·내일·2일 뒤·11월 28일 (토))를 보여 주고,
 * 기한이 지났으면 빨갛게, 완료했으면 줄을 긋는다. 알림이 있으면 종 아이콘을 붙인다.
 * 누르면 날짜 팝오버(DateChipEditor)가 열린다 — 부르는 쪽이 PopoverTrigger로 감싼다.
 */
function DateChip({ value, now, selected, open, className, ...props }: DateChipProps) {
  const view = describeDateChip(value, now);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-slot="date-chip"
          data-overdue={view.overdue || undefined}
          data-done={view.done || undefined}
          data-reminder={view.hasReminder || undefined}
          data-open={open || undefined}
          aria-haspopup="dialog"
          aria-expanded={open ?? false}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm bg-subtle px-1.5 py-0.5 align-baseline text-ui text-secondary select-none",
            "hover:bg-hover hover:text-primary force-hover:bg-hover force-hover:text-primary",
            "data-[open=true]:bg-accent-soft data-[open=true]:text-accent",
            // 기한 지남은 빨간 글자 대신 빨간 배경 — 빨간 글자는 연한 배경에서 대비가 4.5:1에 못 미친다
            view.overdue && "bg-danger-soft text-primary",
            view.done && "text-tertiary line-through",
            selected && "outline-2 outline-offset-1 outline-accent outline-solid",
            focusRing,
            press,
            className,
          )}
          {...props}
        >
          <span>{view.label}</span>
          {view.hasReminder ? (
            <Bell
              role="img"
              aria-label="알림 설정됨"
              className="size-4 shrink-0"
              strokeWidth={1.5}
            />
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent>{view.title}</TooltipContent>
    </Tooltip>
  );
}

export type DateChipPatch = Partial<Pick<DateChipValue, "date" | "time" | "reminder" | "done">>;

export type DateChipEditorProps = {
  value: DateChipValue;
  /** 기준 시각. 기본은 지금 */
  now?: Date;
  onChange: (patch: DateChipPatch) => void;
  /** 주면 「제거」 버튼을 보인다 */
  onRemove?: () => void;
  className?: string;
};

/**
 * 날짜 칩의 편집 내용 — OV-Popover 안에 넣는다.
 * 빠른 선택(오늘·내일·다음 주 월요일) · 달력 · 시간 · 알림 · 완료 · 제거.
 * 시각을 지우면 「N분 전」·「시간 지정」 알림은 없음으로 바뀐다(시각 기준이 없어진다).
 */
function DateChipEditor({ value, now, onChange, onRemove, className }: DateChipEditorProps) {
  const today = now ?? new Date();
  const key = reminderOptionKey(value.reminder);

  const setReminder = (next: ReminderRule) => onChange({ reminder: next });
  const reminderHintId = React.useId();

  return (
    <div data-slot="date-chip-editor" className={cn("grid w-70 gap-3 p-1", className)}>
      <div role="group" aria-label="빠른 선택" className="flex flex-wrap gap-1.5">
        {(
          [
            ["오늘", toIsoDate(today)],
            ["내일", toIsoDate(addDays(today, 1))],
            ["다음 주 월요일", toIsoDate(nextMonday(today))],
          ] as const
        ).map(([label, date]) => (
          <Button
            key={label}
            size="sm"
            variant="secondary"
            aria-pressed={value.date === date}
            onClick={() => onChange({ date })}
          >
            {label}
          </Button>
        ))}
      </div>

      <Calendar
        value={value.date}
        today={today}
        label="날짜 고르기"
        onChange={(date: IsoDate) => onChange({ date })}
      />

      <div className="grid gap-2">
        <label className="flex items-center justify-between gap-3 text-label font-medium text-secondary">
          시간
          <input
            type="time"
            name="time"
            autoComplete="off"
            value={value.time ?? ""}
            onChange={(e) => {
              const time: TimeOfDay | null = e.target.value || null;
              // 시각이 없어지면 시각 기준 알림은 쓸 수 없다. 있으면 「시간 지정」 알림이 새 시각을 따라간다
              const keep = time !== null || isReminderOptionEnabled(key, null);
              onChange({
                time,
                reminder: keep ? followChipTime(value.reminder, value.time, time) : NO_REMINDER,
              });
            }}
            className={cn(inputClass, "min-h-8 w-32")}
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-label font-medium text-secondary">
          알림
          <span className="flex items-center gap-2">
            {value.reminder.kind === "custom" ? (
              <input
                type="time"
                name="reminder-time"
                autoComplete="off"
                aria-label="알림 시각"
                value={value.reminder.time}
                onChange={(e) =>
                  e.target.value && setReminder({ kind: "custom", time: e.target.value })
                }
                className={cn(inputClass, "min-h-8 w-28")}
              />
            ) : null}
            <select
              name="reminder"
              aria-label="알림"
              aria-describedby={key === "custom" ? reminderHintId : undefined}
              value={key}
              onChange={(e) => {
                const option = REMINDER_OPTIONS.find((o) => o.key === e.target.value);
                if (!option) return;
                setReminder(
                  option.key === "custom"
                    ? { kind: "custom", time: customReminderTime(value.time) }
                    : option.rule,
                );
              }}
              className={cn(inputClass, "min-h-8 w-32")}
            >
              {REMINDER_OPTIONS.map((o) => (
                <option
                  key={o.key}
                  value={o.key}
                  disabled={!isReminderOptionEnabled(o.key as ReminderOptionKey, value.time)}
                >
                  {o.label}
                </option>
              ))}
            </select>
          </span>
        </label>
        {value.reminder.kind === "custom" ? (
          <p id={reminderHintId} className="text-caption text-tertiary">
            {value.reminder.time === value.time
              ? "시간과 같은 시각에 알려요"
              : "시간과 따로 정한 시각에 알려요"}
          </p>
        ) : null}

        <label className="flex items-center justify-between gap-3 text-label font-medium text-secondary">
          완료
          <Checkbox
            checked={value.done}
            onCheckedChange={(checked) => onChange({ done: checked === true })}
          />
        </label>
      </div>

      {onRemove ? (
        <div className="flex justify-end border-t border-line pt-2">
          <Button size="sm" variant="ghost" onClick={onRemove}>
            날짜 제거
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export { DateChip, DateChipEditor };
