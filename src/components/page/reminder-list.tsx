import { AlarmClock, Bell, Check, Square, Trash2 } from "lucide-react";
import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { focusRing } from "@/components/ui/styles";
import { useMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * 알림 보기 목록 (SYS-16). 묶음 나누기·자연어 시각 표시·저장은 화면 층(reminders-view)이 맡고,
 * 이 컴포넌트는 값과 콜백만 받는다. 타이머 남은 시간은 `now`로 계산한다.
 * 키보드: ↑/↓로 행 사이를 옮기고(roving), Enter로 대상을 연다.
 */

export type ReminderListSectionKey =
  "running" | "overdue" | "today" | "tomorrow" | "thisWeek" | "later" | "repeating" | "done";

export type ReminderListRow = {
  id: string;
  /** 대상 제목(페이지·빠른 메모). 대상이 없으면 알림 내용 */
  title: string;
  /** 대상이 있을 때 알림 내용을 보조로 보인다 */
  note?: string;
  /** 울릴 시각 표시(「오늘 15:00」 등) */
  when: string;
  /** 타이머가 끝나는 시각(ms). 있으면 `now` 기준 mm:ss 카운트다운을 보인다 */
  endsAt?: number;
  /** 끝난 알림 — 완료·미루기 버튼을 숨긴다 */
  done?: boolean;
};

export type ReminderListSection = {
  key: ReminderListSectionKey;
  rows: ReminderListRow[];
};

export type SnoozeChoice = "min10" | "hour1" | "tomorrow9";

export type ReminderListProps = {
  /** 빈 묶음은 넘기지 않는다. 순서대로 그린다 */
  sections: ReminderListSection[];
  /** 카운트다운 기준 시각 */
  now: Date;
  onOpen: (id: string) => void;
  onSnooze: (id: string, by: SnoozeChoice) => void;
  /** 완료 · 타이머는 멈추기 */
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  className?: string;
};

const SNOOZE: SnoozeChoice[] = ["min10", "hour1", "tomorrow9"];

/** 남은 시간을 mm:ss로 (끝났으면 00:00) */
function formatCountdown(endsAt: number, now: Date): string {
  const sec = Math.max(0, Math.ceil((endsAt - now.getTime()) / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(sec / 60))}:${p(sec % 60)}`;
}

export function ReminderList({
  sections,
  now,
  onOpen,
  onSnooze,
  onComplete,
  onDelete,
  className,
}: ReminderListProps) {
  const m = useMessages();
  const copy = m.page.reminderList;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const visible = sections.filter((s) => s.rows.length > 0);
  const flat = visible.flatMap((s) => s.rows);
  // roving: 탭 정지점은 마지막으로 포커스한 행(없으면 첫 행) 하나뿐이다
  const tabStop = flat.some((r) => r.id === activeId) ? activeId : (flat[0]?.id ?? null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const titles = Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>("[data-row-title]") ?? [],
    );
    const at = titles.indexOf(e.target as HTMLButtonElement);
    if (at < 0 || titles.length === 0) return;
    e.preventDefault();
    const next =
      titles[Math.min(titles.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))];
    next?.focus();
  };

  if (flat.length === 0) {
    return (
      <div
        className={cn("flex flex-col items-center gap-2 px-4 py-12 text-center", className)}
        role="status"
      >
        <Bell className="size-5 text-tertiary" strokeWidth={1.5} aria-hidden />
        <p className="text-body text-primary">{copy.empty}</p>
        <p className="text-caption text-secondary">{copy.emptyHint}</p>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={copy.label}
      onKeyDown={onKeyDown}
      className={cn("flex flex-col gap-6", className)}
    >
      {visible.map((section) => (
        <ReminderSection
          key={section.key}
          title={copy.sections[section.key]}
          rows={section.rows}
          tabStop={tabStop}
          now={now}
          onFocusRow={setActiveId}
          onOpen={onOpen}
          onSnooze={onSnooze}
          onComplete={onComplete}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

type SectionProps = {
  title: string;
  rows: ReminderListRow[];
  tabStop: string | null;
  now: Date;
  onFocusRow: (id: string) => void;
  onOpen: (id: string) => void;
  onSnooze: (id: string, by: SnoozeChoice) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
};

function ReminderSection({ title, rows, tabStop, now, onFocusRow, ...handlers }: SectionProps) {
  const headingId = React.useId();
  const m = useMessages();
  const copy = m.page.reminderList;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h3 id={headingId} className="px-2 text-label text-tertiary">
        {title}
      </h3>
      <ul className="flex flex-col">
        {rows.map((row) => {
          const countdown = row.endsAt !== undefined ? formatCountdown(row.endsAt, now) : null;
          return (
            <li
              key={row.id}
              className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1 hover:bg-hover force-hover:bg-hover"
            >
              <button
                type="button"
                data-row-title
                tabIndex={row.id === tabStop ? 0 : -1}
                onFocus={() => onFocusRow(row.id)}
                onClick={() => handlers.onOpen(row.id)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-start rounded-sm text-left",
                  focusRing,
                )}
              >
                <span
                  className={cn(
                    "w-full truncate text-body",
                    row.done ? "text-secondary line-through" : "text-primary",
                  )}
                >
                  {row.title}
                </span>
                {row.note ? (
                  <span className="w-full truncate text-caption text-secondary">{row.note}</span>
                ) : null}
              </button>
              <span className="shrink-0 text-caption text-secondary tabular-nums">
                {countdown ?? row.when}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                {!row.done && countdown === null ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton label={copy.snoozeLabel(row.title)} size="md">
                        <AlarmClock />
                      </IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {SNOOZE.map((by) => (
                        <DropdownMenuItem key={by} onSelect={() => handlers.onSnooze(row.id, by)}>
                          {copy.snooze[by]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
                {!row.done ? (
                  <IconButton
                    label={
                      countdown !== null ? copy.stopLabel(row.title) : copy.completeLabel(row.title)
                    }
                    size="md"
                    onClick={() => handlers.onComplete(row.id)}
                  >
                    {countdown !== null ? <Square /> : <Check />}
                  </IconButton>
                ) : null}
                <IconButton
                  label={copy.deleteLabel(row.title)}
                  size="md"
                  onClick={() => handlers.onDelete(row.id)}
                >
                  <Trash2 />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
