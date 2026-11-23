import { CalendarDays, CircleDot, Clock, Hash, User, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DEFAULT_STATUS_OPTIONS,
  StatusChip,
  type Status,
  type StatusOption,
} from "@/components/ui/status-chip";
import { focusRing } from "@/components/ui/styles";
import { TagChip, type SoftColor } from "@/components/ui/tag-chip";
import { cn } from "@/lib/utils";
import type * as React from "react";

export type PageTag = { id: string; name: string; color: SoftColor };

type PropertiesProps = {
  tags: PageTag[];
  /** 태그 편집 팝오버 안의 내용 (태그 검색·추가). 없으면 태그 줄은 읽기 전용 */
  tagEditor?: React.ReactNode;
  onRemoveTag?: (id: string) => void;
  status?: Status;
  /** 주면 상태를 고를 수 있다 (없음 = undefined) */
  onStatusChange?: (status: Status | undefined) => void;
  /** 고를 수 있는 상태 — 컬렉션 레코드는 그 컬렉션의 상태 목록 (기본 4단계) */
  statusOptions?: StatusOption[];
  /** 컬렉션 레코드면 담당·마감 칸 (COLL-01) — 값 칸 안에 들어갈 편집기 */
  assignee?: React.ReactNode;
  due?: React.ReactNode;
  /** 컬렉션 레코드의 사용자 속성 행 (COLL-08) — 담당·마감 뒤, 생성일 앞 */
  extra?: { key: string; name: string; icon: LucideIcon; content: React.ReactNode }[];
  /** 표시용 날짜 문구. 예: "2026년 11월 19일" */
  created: string;
  updated?: string;
  className?: string;
};

const valueClass =
  "flex min-h-7.5 min-w-0 flex-1 flex-wrap items-center gap-1 rounded-md px-2 py-1 text-left text-ui";
const valueButton = cn(
  valueClass,
  "transition-colors duration-(--dur-fast) hover:bg-hover force-hover:bg-hover",
  focusRing,
);
const empty = <span className="text-tertiary">비어 있음</span>;

function Row({
  icon: Icon,
  name,
  children,
}: {
  icon: LucideIcon;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div role="row" className="flex items-start gap-2">
      <span
        role="rowheader"
        className="flex min-h-7.5 w-28 shrink-0 items-center gap-2 rounded-md px-2 py-1 text-ui text-secondary"
      >
        <Icon strokeWidth={1.5} aria-hidden className="size-3.5 shrink-0" />
        {name}
      </span>
      <span role="cell" className="flex min-w-0 flex-1">
        {children}
      </span>
    </div>
  );
}

/**
 * PG-Properties — 태그 · 상태 · 생성일/수정일 행 (프로토타입 `.props`, 이름 칸 112px).
 * 값 칸을 누르면 편집한다(태그 = 팝오버, 상태 = 메뉴). 날짜는 읽기 전용.
 */
function Properties({
  tags,
  tagEditor,
  onRemoveTag,
  status,
  onStatusChange,
  assignee,
  due,
  extra,
  created,
  updated,
  className,
  statusOptions = DEFAULT_STATUS_OPTIONS,
}: PropertiesProps) {
  const colorOf = (name: string) => statusOptions.find((o) => o.name === name)?.color;
  const tagChips = tags.length
    ? tags.map((t) => (
        <TagChip
          key={t.id}
          color={t.color}
          onRemove={onRemoveTag ? () => onRemoveTag(t.id) : undefined}
        >
          {t.name}
        </TagChip>
      ))
    : empty;

  return (
    <div
      role="table"
      aria-label="속성"
      data-slot="properties"
      className={cn("mt-4 grid gap-0.5", className)}
    >
      <Row icon={Hash} name="태그">
        {tagEditor ? (
          // 칩의 삭제 버튼과 겹치지 않게, 편집 버튼은 칩 뒤 빈 자리를 채운다
          // 태그가 없으면 "비어 있음"까지 눌러 연다
          <span className={cn(valueClass, "p-0")}>
            {tags.length ? (
              <span className="flex flex-wrap items-center gap-1 px-2 py-1">{tagChips}</span>
            ) : null}
            <Popover>
              <PopoverTrigger
                className={cn(valueButton, "min-w-8 self-stretch", !tags.length && "px-2")}
              >
                <span className="sr-only">태그 편집{tags.length ? "" : ": "}</span>
                {tags.length ? null : tagChips}
              </PopoverTrigger>
              <PopoverContent className="w-70 p-2">{tagEditor}</PopoverContent>
            </Popover>
          </span>
        ) : (
          <span className={valueClass}>{tagChips}</span>
        )}
      </Row>
      <Row icon={CircleDot} name="상태">
        {onStatusChange ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={valueButton}
              aria-label={`상태 편집, 지금은 ${status ?? "비어 있음"}`}
            >
              {status ? <StatusChip status={status} color={colorOf(status)} /> : empty}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {statusOptions.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.name}
                  checked={o.name === status}
                  onCheckedChange={(on) => onStatusChange(on ? o.name : undefined)}
                >
                  <StatusChip status={o.name} color={o.color} />
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className={valueClass}>
            {status ? <StatusChip status={status} color={colorOf(status)} /> : empty}
          </span>
        )}
      </Row>
      {assignee ? (
        <Row icon={User} name="담당">
          {assignee}
        </Row>
      ) : null}
      {due ? (
        <Row icon={CalendarDays} name="마감">
          {due}
        </Row>
      ) : null}
      {extra?.map((x) => (
        <Row key={x.key} icon={x.icon} name={x.name}>
          {x.content}
        </Row>
      ))}
      <Row icon={Clock} name="생성일">
        <span className={cn(valueClass, "text-secondary")}>{created}</span>
      </Row>
      {updated ? (
        <Row icon={Clock} name="수정일">
          <span className={cn(valueClass, "text-secondary")}>{updated}</span>
        </Row>
      ) : null}
    </div>
  );
}

export { Properties, type PropertiesProps };
