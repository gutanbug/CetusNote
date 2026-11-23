import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { inputClass } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DEFAULT_STATUS_OPTIONS,
  StatusChip,
  type Status,
  type StatusOption,
} from "@/components/ui/status-chip";
import { focusRing, menuItem } from "@/components/ui/styles";
import { valueButton } from "./styles";
import type { SoftColor } from "@/components/ui/tag-chip";
import { cn } from "@/lib/utils";
import { CalendarDays, CalendarX, Check, X } from "lucide-react";
import * as React from "react";

/** 여는 클릭의 보조 키 — ⌘(⌃)면 뒤 탭에 연다 */
export type OpenModifiers = { metaKey: boolean; ctrlKey: boolean };

/** 레코드 한 줄 — 표·보드·캘린더·상세가 함께 쓴다 (COLL-01) */
export type RecordItem = {
  id: string;
  title: string;
  emoji?: string;
  status?: Status;
  /** 상태 색 — 컬렉션 상태 목록의 색 */
  statusColor?: SoftColor;
  assignee?: string;
  /** 마감 — 날짜(YYYY-MM-DD)와 표시 문구 */
  due?: { date: string; text: string; late: boolean };
  tags: { name: string; color: SoftColor }[];
  /** 보드 카드에 작게 보일 사용자 속성 (COLL-08) — 값이 있는 것만, 글로 */
  extra?: {
    key: string;
    name: string;
    text: string;
    chips?: { name: string; color: SoftColor }[];
  }[];
};

/** 빈 값 */
export function EmptyValue() {
  // 값 칸에 올리면 바탕이 진해져 한 단계 진한 글자색으로 대비를 지킨다
  return (
    <span className="text-tertiary group-hover/val:text-secondary force-hover:text-secondary">
      비어 있음
    </span>
  );
}

/**
 * 마감 표시. 지났으면 아이콘을 위험 색으로 바꾸고 "지남"을 붙인다
 * (글자는 보조 색 그대로 — hover 바탕에서도 대비 4.5:1을 지키게).
 */
export function DueText({ due }: { due: NonNullable<RecordItem["due"]> }) {
  const Icon = due.late ? CalendarX : CalendarDays;
  return (
    <span
      data-late={due.late || undefined}
      className="inline-flex items-center gap-1 text-label whitespace-nowrap text-secondary"
    >
      <Icon strokeWidth={1.5} aria-hidden className={cn("size-3.5", due.late && "text-danger")} />
      {due.text}
      {due.late ? <span className="font-medium"> · 지남</span> : null}
    </span>
  );
}

/** 담당 표시 — 이니셜 아바타 + 이름 */
export function Owner({ name }: { name: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-label whitespace-nowrap text-secondary">
      <Avatar name={name} aria-hidden aria-label={undefined} role={undefined} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** 상태 고르기 — 메뉴 (같은 값을 다시 고르면 비운다) */
export function StatusPicker({
  value,
  color,
  options = DEFAULT_STATUS_OPTIONS,
  onChange,
  label,
  className,
}: {
  value?: Status;
  /** 지금 값의 색 */
  color?: SoftColor;
  /** 고를 수 있는 상태 (기본 4단계) */
  options?: StatusOption[];
  onChange: (status: Status | undefined) => void;
  /** 접근성 이름 앞부분 — 예: "스프린트 리뷰 준비 상태" */
  label: string;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(valueButton, className)}>
        <span className="sr-only">{label}: </span>
        {value ? (
          <StatusChip
            status={value}
            color={color ?? options.find((o) => o.name === value)?.color}
          />
        ) : (
          <EmptyValue />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {/* 값은 항목의 onSelect 한 곳에서만 정한다. 그룹의 onValueChange를 함께 쓰면
            Radix가 같은 값을 다시 알려 줘서 비운 값이 되돌아온다. */}
        <DropdownMenuRadioGroup value={value ?? ""}>
          {options.map((o) => (
            <DropdownMenuRadioItem
              key={o.name}
              value={o.name}
              // 이미 고른 상태를 다시 고르면 비운다 (기존 체크 해제 동작)
              onSelect={() => onChange(o.name === value ? undefined : o.name)}
            >
              <StatusChip status={o.name} color={o.color} />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 담당 고르기 — 이름을 적거나, 전에 쓴 이름을 고른다 */
export function AssigneePicker({
  value,
  choices,
  onChange,
  label,
  className,
}: {
  value?: string;
  /** 전에 쓴 이름들 */
  choices: string[];
  onChange: (name: string | undefined) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const q = draft.trim();
  const shown = choices.filter((c) => !q || c.toLocaleLowerCase().includes(q.toLocaleLowerCase()));
  const pick = (name: string | undefined) => {
    onChange(name);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft("");
      }}
    >
      <PopoverTrigger className={cn(valueButton, className)}>
        <span className="sr-only">{label}: </span>
        {value ? <Owner name={value} /> : <EmptyValue />}
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q) pick(q.slice(0, 80));
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="담당 이름"
            placeholder="이름을 적고 Enter"
            className={cn(inputClass, "h-7.5 min-h-7.5 text-caption")}
          />
        </form>
        <div
          role="listbox"
          aria-label="전에 쓴 이름"
          className="mt-1 grid max-h-56 overflow-y-auto"
        >
          {shown.map((name) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={name === value}
              onClick={() => pick(name)}
              className={cn(menuItem, focusRing)}
            >
              <Owner name={name} />
              {name === value ? <Check strokeWidth={1.5} aria-hidden className="ml-auto" /> : null}
            </button>
          ))}
          {q && !choices.includes(q) ? (
            <button type="button" onClick={() => pick(q)} className={cn(menuItem, focusRing)}>
              “{q}” 담당으로
            </button>
          ) : null}
          {value ? (
            <button
              type="button"
              onClick={() => pick(undefined)}
              className={cn(menuItem, focusRing, "text-secondary")}
            >
              <X strokeWidth={1.5} aria-hidden />
              담당 비우기
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** 마감 고르기 — 시스템 날짜 입력 */
export function DuePicker({
  value,
  onChange,
  label,
  className,
}: {
  value?: RecordItem["due"];
  onChange: (date: string | undefined) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(valueButton, className)}>
        <span className="sr-only">{label}: </span>
        {value ? <DueText due={value} /> : <EmptyValue />}
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2">
        <input
          type="date"
          autoFocus
          aria-label="마감 날짜"
          defaultValue={value?.date}
          onKeyDown={(e) => {
            if (e.key === "Enter") setOpen(false);
          }}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={cn(inputClass, "h-7.5 min-h-7.5 text-caption")}
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className={cn(menuItem, focusRing, "mt-1 text-secondary")}
          >
            <X strokeWidth={1.5} aria-hidden />
            마감 비우기
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
