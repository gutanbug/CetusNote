import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { statusColor } from "@/components/ui/status-chip";
import type { SoftColor } from "@/components/ui/tag-chip";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type * as React from "react";
import type { OpenModifiers, RecordItem } from "./fields";

export type CalendarDay = {
  /** YYYY-MM-DD */
  date: string;
  day: number;
  /** 이번 달이 아닌 날 */
  out?: boolean;
  today?: boolean;
  items: RecordItem[];
};

type CalendarViewProps = {
  /** 예: "2026년 11월" */
  monthLabel: string;
  /** 일요일부터 6주(42칸) */
  days: CalendarDay[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** 레코드 열기 — ⌘(⌃)를 누른 채면 e로 알린다 (COLL-07: 뒤 탭에 열기) */
  onOpen: (id: string, e?: OpenModifiers) => void;
  /** 그 날짜가 마감인 레코드 만들기 */
  onNew: (date: string) => void;
  /** 칸마다 보이는 레코드 수 — 넘으면 "+N개 더" */
  maxPerDay?: number;
  /** 이번 달에 마감인 레코드가 없을 때 격자 위에 보일 안내 */
  empty?: React.ReactNode;
  className?: string;
};

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
/** 칩 색 — 레코드의 상태 색 */
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

const dateName = (date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일`;
};

function Chip({ item, onOpen }: { item: RecordItem; onOpen: CalendarViewProps["onOpen"] }) {
  return (
    <button
      type="button"
      onClick={(e) => onOpen(item.id, e)}
      className={cn(
        "flex min-h-5.5 w-full min-w-0 items-center gap-1 rounded-pill px-1.5 text-left text-label",
        "transition-[filter] duration-(--dur-fast) hover:brightness-96 force-hover:brightness-96",
        CHIP[item.statusColor ?? (item.status ? statusColor(item.status) : "gray")],
        focusRing,
      )}
    >
      <i aria-hidden className="size-1.5 shrink-0 rounded-pill" />
      <span className="min-w-0 flex-1 truncate">{item.title || "제목 없음"}</span>
      {item.status ? <span className="sr-only">, {item.status}</span> : null}
    </button>
  );
}

/**
 * CL-CalendarView — 캘린더 뷰 (프로토타입 §14). 월 단위 7열 격자, 레코드는 마감일 칸에 놓인다.
 * 이번 달이 아닌 날은 흐리게, 오늘은 포인트 테두리와 포인트 색 숫자로만 구분한다.
 * 날짜 칸에 올리면 ＋가 나타나 그 날짜가 마감인 레코드를 만든다.
 */
function CalendarView({
  monthLabel,
  days,
  onPrev,
  onNext,
  onToday,
  onOpen,
  onNew,
  maxPerDay = 3,
  empty,
  className,
}: CalendarViewProps) {
  const none = !days.some((d) => !d.out && d.items.length);
  return (
    <div data-slot="collection-calendar" className={className}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-body font-semibold text-primary" aria-live="polite">
          {monthLabel}
        </h2>
        <IconButton label="이전 달" onClick={onPrev}>
          <ChevronLeft strokeWidth={1.5} />
        </IconButton>
        <Button variant="secondary" size="sm" onClick={onToday}>
          오늘
        </Button>
        <IconButton label="다음 달" onClick={onNext}>
          <ChevronRight strokeWidth={1.5} />
        </IconButton>
      </div>
      {none && empty ? <div className="mb-3">{empty}</div> : null}
      <div className="overflow-hidden rounded-lg border border-line">
        <div aria-hidden className="grid grid-cols-7 border-b border-line bg-subtle">
          {DOW.map((d) => (
            <span key={d} className="p-2 text-center text-label font-medium text-secondary">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const shown = d.items.slice(0, maxPerDay);
            const more = d.items.length - shown.length;
            const name = `${dateName(d.date)}${d.today ? " (오늘)" : ""}`;
            return (
              <div
                key={d.date}
                role="group"
                aria-label={`${name}, 레코드 ${d.items.length}개`}
                data-out={d.out || undefined}
                data-today={d.today || undefined}
                className={cn(
                  "group/day grid min-h-26 grid-rows-[auto_1fr] content-start gap-0.5 border-line p-1",
                  (i + 1) % 7 !== 0 && "border-r",
                  i < days.length - 7 && "border-b",
                  "data-out:bg-subtle data-today:ring-2 data-today:ring-accent data-today:ring-inset",
                )}
              >
                <div className="flex items-center gap-1 px-1">
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
                    aria-label={`${dateName(d.date)} 마감 레코드 만들기`}
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
                <div className="grid content-start gap-0.5">
                  {shown.map((item) => (
                    <Chip key={item.id} item={item} onOpen={onOpen} />
                  ))}
                  {more > 0 ? (
                    <Popover>
                      <PopoverTrigger
                        className={cn(
                          "rounded-pill px-1.5 py-0.5 text-left text-label text-secondary",
                          "hover:bg-hover hover:text-primary force-hover:bg-hover force-hover:text-primary",
                          focusRing,
                        )}
                      >
                        +{more}개 더<span className="sr-only">, {dateName(d.date)}</span>
                      </PopoverTrigger>
                      <PopoverContent className="grid w-60 gap-0.5 p-2">
                        <p className="px-1 pb-1 text-label font-medium text-secondary">
                          {dateName(d.date)}
                        </p>
                        {d.items.map((item) => (
                          <Chip key={item.id} item={item} onOpen={onOpen} />
                        ))}
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { CalendarView, type CalendarViewProps };
