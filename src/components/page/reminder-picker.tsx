import { Trash2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fieldFocus, focusRing } from "@/components/ui/styles";
import { toIsoDate, type IsoDate } from "@/lib/dates/local-date";
import { useMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * 알림 고르기 패널 (SYS-16). 팝오버 안에 넣어 쓴다. 자연어 해석·저장은 화면 층이 맡고,
 * 이 컴포넌트는 값과 콜백만 받는다. 「parse」는 입력 줄 아래 미리보기에 쓴다.
 */

export type RepeatChoice = "none" | "day" | "weekday" | "week" | "month";

export type ReminderPickerItem = {
  id: string;
  label: string;
  /** 시각 표시(「오늘 15:00」 · 「25분 남음」) */
  when: string;
};

export type ReminderPickerOption = {
  id: string;
  label: string;
  /** 울릴 시각 표시 */
  when: string;
};

export type ReminderPreview = { label: string; when: string };

export type ReminderPickerProps = {
  /** 이 대상에 걸린 알림 */
  items: ReminderPickerItem[];
  /** 빠른 시각 선택 (10분 뒤 · 오늘 저녁 6시 …) */
  presets: ReminderPickerOption[];
  /** 타이머 길이(분). 기본 25·50 */
  timerMinutes?: number[];
  /** 입력 줄의 자연어를 해석한다. 시각을 못 찾으면 null */
  parse: (text: string) => ReminderPreview | null;
  /** Enter로 제출. 만들었으면 true(입력을 비운다) */
  onSubmitText: (text: string) => boolean;
  onPreset: (id: string) => void;
  onTimer: (minutes: number) => void;
  onManual: (input: { date: IsoDate; time: string; repeat: RepeatChoice }) => void;
  onRemove: (id: string) => void;
  /** 오늘 날짜 기준(테스트·스토리용) */
  today?: Date;
  className?: string;
};

const REPEATS: RepeatChoice[] = ["none", "day", "weekday", "week", "month"];

export function ReminderPicker({
  items,
  presets,
  timerMinutes = [25, 50],
  parse,
  onSubmitText,
  onPreset,
  onTimer,
  onManual,
  onRemove,
  today,
  className,
}: ReminderPickerProps) {
  const m = useMessages();
  const copy = m.page.reminderPicker;
  const [text, setText] = React.useState("");
  const [date, setDate] = React.useState<IsoDate>(() => toIsoDate(today ?? new Date()));
  const [time, setTime] = React.useState("09:00");
  const [repeat, setRepeat] = React.useState<RepeatChoice>("none");

  const trimmed = text.trim();
  const preview = trimmed ? parse(trimmed) : null;
  const repeatLabel: Record<RepeatChoice, string> = {
    none: copy.repeatNone,
    day: copy.repeatDay,
    weekday: copy.repeatWeekday,
    week: copy.repeatWeek,
    month: copy.repeatMonth,
  };

  return (
    <div className={cn("flex w-80 flex-col gap-4 p-3", className)}>
      <form
        className="flex flex-col gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed && onSubmitText(trimmed)) setText("");
        }}
      >
        <Input
          aria-label={copy.inputLabel}
          placeholder={copy.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        {trimmed ? (
          <p className="text-caption text-secondary" aria-live="polite">
            {preview ? `${copy.previewPrefix} ${preview.when}` : copy.noTime}
          </p>
        ) : null}
      </form>

      <section className="flex flex-col gap-1" aria-label={copy.presets}>
        <h3 className="text-caption text-secondary">{copy.presets}</h3>
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <Button
              key={p.id}
              variant="secondary"
              size="sm"
              onClick={() => onPreset(p.id)}
              title={p.when}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1" aria-label={copy.timer}>
        <h3 className="text-caption text-secondary">{copy.timer}</h3>
        <div className="flex gap-1">
          {timerMinutes.map((n) => (
            <Button key={n} variant="secondary" size="sm" onClick={() => onTimer(n)}>
              {copy.timerMinutes(n)}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label={copy.manual}>
        <h3 className="text-caption text-secondary">{copy.manual}</h3>
        <Calendar value={date} onChange={setDate} label={copy.dateLabel} today={today} />
        <div className="flex items-center gap-2">
          <label className="text-caption text-secondary" htmlFor="reminder-time">
            {copy.timeLabel}
          </label>
          <input
            id="reminder-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={cn(
              "rounded-md border border-line-strong bg-elevated px-2 py-1 text-body text-primary",
              fieldFocus,
            )}
          />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label={copy.repeat}>
          {REPEATS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={repeat === r}
              onClick={() => setRepeat(r)}
              className={cn(
                "rounded-pill px-3 py-1 text-caption hover:bg-hover force-hover:bg-hover",
                repeat === r ? "bg-hover text-primary" : "text-secondary",
                focusRing,
              )}
            >
              {repeatLabel[r]}
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={() => onManual({ date, time, repeat })}>
          {copy.add}
        </Button>
      </section>

      <section className="flex flex-col gap-1" aria-label={copy.listHeading}>
        <h3 className="text-caption text-secondary">{copy.listHeading}</h3>
        {items.length === 0 ? (
          <p className="text-caption text-tertiary">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-hover force-hover:bg-hover"
              >
                <span className="min-w-0 flex-1 truncate text-body text-primary">{item.label}</span>
                <span className="shrink-0 text-caption text-secondary">{item.when}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={copy.removeLabel(item.label)}
                      onClick={() => onRemove(item.id)}
                      className={cn("rounded-md p-1 text-secondary hover:text-primary", focusRing)}
                    >
                      <Trash2 className="size-4" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{copy.remove}</TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
