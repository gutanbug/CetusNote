import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import type { Status, StatusOption } from "@/components/ui/status-chip";
import { TagChip } from "@/components/ui/tag-chip";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import * as React from "react";
import { AssigneePicker, DuePicker, EmptyValue, StatusPicker, type RecordItem } from "./fields";
import { PropertyIcon } from "./property";
import type { BuiltinKey, PropertyEntry } from "./property-types";

/** 상세 속성 행 하나 (COLL-08). 기본 속성은 상세가 편집기를 그리고, 사용자 속성은 content로 받는다 */
export type DetailRow = {
  key: string;
  name: string;
  kind: PropertyEntry["kind"];
  /** 이름 칸을 감싸는 속성 메뉴 (CL-PropertyMenu) */
  menu?: (trigger: React.ReactElement) => React.ReactNode;
  content?: React.ReactNode;
};

const BUILTIN_ROWS: DetailRow[] = [
  { key: "status", name: "상태", kind: "status" },
  { key: "assignee", name: "담당", kind: "assignee" },
  { key: "due", name: "마감", kind: "due" },
  { key: "tags", name: "태그", kind: "tags" },
];
import { valueButton } from "./styles";
import { PageIcon } from "@/components/ui/page-icon";

type RecordDetailProps = {
  /** 모달(기본) 또는 오른쪽 사이드 패널 (COLL-07). 패널 폭은 부르는 쪽이 정한다 */
  variant?: "modal" | "side";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: RecordItem;
  /** 지금 보이는 목록(필터 안)에서의 자리, 1부터 */
  position: { index: number; total: number };
  onPrev?: () => void;
  onNext?: () => void;
  onOpenPage: () => void;
  onTitleChange: (title: string) => void;
  onStatusChange: (status: Status | undefined) => void;
  /** 고를 수 있는 상태 — 컬렉션 상태 목록 */
  statusOptions?: StatusOption[];
  onAssigneeChange: (name: string | undefined) => void;
  onDueChange: (date: string | undefined) => void;
  assigneeChoices: string[];
  /** 태그 편집 팝오버 안 */
  tagEditor?: React.ReactNode;
  onRemoveTag?: (name: string) => void;
  /** 본문 체크리스트 진행률. 할 일이 없으면 주지 않는다 */
  progress?: { done: number; total: number };
  /** 본문 — 페이지와 같은 블록 에디터 */
  children?: React.ReactNode;
  /** 보이는 속성 행 — 순서대로. 없으면 기본 4개 */
  rows?: DetailRow[];
  /** 속성 표 아래 "속성 추가" (CL-AddProperty) */
  addProperty?: React.ReactNode;
  className?: string;
};

const rowHead =
  "flex min-h-7.5 w-28 shrink-0 items-center gap-2 rounded-md px-2 py-1 text-left text-ui text-secondary";

function Row({
  kind,
  name,
  menu,
  children,
}: {
  kind: DetailRow["kind"];
  name: string;
  menu?: DetailRow["menu"];
  children: React.ReactNode;
}) {
  const label = (
    <>
      <PropertyIcon kind={kind} />
      <span className="truncate">{name}</span>
    </>
  );
  return (
    <div role="row" className="flex items-start gap-2">
      <span role="rowheader" className="flex shrink-0">
        {menu ? (
          menu(
            <button
              type="button"
              aria-label={`${name} 속성 메뉴`}
              className={cn(
                rowHead,
                "transition-colors duration-(--dur-fast) hover:bg-hover force-hover:bg-hover",
                focusRing,
              )}
            >
              {label}
            </button>,
          )
        ) : (
          <span className={rowHead}>{label}</span>
        )}
      </span>
      <span role="cell" className="flex min-h-7.5 min-w-0 flex-1 items-center">
        {children}
      </span>
    </div>
  );
}

/**
 * 사이드 패널 껍데기 (COLL-07). 열리면 패널로 포커스를 옮기고, 닫히면 연 자리(표의 제목 버튼 등)로 돌려준다.
 * 패널 안에서 아무도 쓰지 않은 Esc면 닫는다 — 팝오버·메뉴는 포털이라 패널 밖이다.
 */
function SidePanel({
  label,
  onClose,
  className,
  children,
}: {
  label: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => {
      // 닫는 동안 다른 곳으로 옮긴 포커스(새 탭 등)는 건드리지 않는다
      const now = document.activeElement;
      if (from?.isConnected && (!now || now === document.body)) from.focus({ preventScroll: true });
    };
  }, []);
  return (
    <aside
      ref={ref}
      aria-label={label}
      data-slot="record-side"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (
          e.key === "Escape" &&
          !e.defaultPrevented &&
          e.currentTarget.contains(e.target as Node)
        ) {
          e.preventDefault();
          onClose();
        }
      }}
      className={cn(
        "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] border-l border-line bg-app outline-none",
        className,
      )}
    >
      {children}
    </aside>
  );
}

/** 체크리스트 진행률 (프로토타입 §15 `.todo-progress`) */
function ChecklistProgress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const id = React.useId();
  return (
    <div className="mt-3 mb-1 flex items-center gap-3">
      <span id={id} className="shrink-0 text-label whitespace-nowrap text-secondary">
        완료 {done}/{total}
      </span>
      <Progress value={pct} aria-labelledby={id} className="min-w-0 flex-1" />
      <span aria-hidden className="w-9 shrink-0 text-right text-label text-tertiary tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

/**
 * CL-RecordDetail — 레코드 상세 모달 (프로토타입 §15 `.rowmodal`). 페이지와 같은 블록 에디터(children)로 연다.
 * 머리의 ‹ ›로 같은 필터 안의 이전·다음 레코드로 옮긴다. 속성(상태·담당·마감·태그)과 체크리스트 진행률을 보인다.
 */
function RecordDetail({
  variant = "modal",
  open,
  onOpenChange,
  item,
  position,
  onPrev,
  onNext,
  onOpenPage,
  onTitleChange,
  onStatusChange,
  statusOptions,
  onAssigneeChange,
  onDueChange,
  assigneeChoices,
  tagEditor,
  onRemoveTag,
  progress,
  children,
  rows = BUILTIN_ROWS,
  addProperty,
  className,
}: RecordDetailProps) {
  const name = item.title || "제목 없음";
  const chips = item.tags.length ? (
    <span className="flex flex-wrap items-center gap-1 px-1">
      {item.tags.map((t) => (
        <TagChip
          key={t.name}
          color={t.color}
          onRemove={onRemoveTag ? () => onRemoveTag(t.name) : undefined}
        >
          {t.name}
        </TagChip>
      ))}
    </span>
  ) : (
    <span className="px-1">
      <EmptyValue />
    </span>
  );
  const tagsCell = tagEditor ? (
    <span className="flex min-w-0 flex-1 items-center">
      {/* 태그가 없으면 "비어 있음"까지 눌러 연다. 있으면 칩(삭제 버튼) 뒤 빈 자리가 편집 버튼 */}
      {item.tags.length ? chips : null}
      <Popover>
        <PopoverTrigger className={cn(valueButton, "min-h-7.5 min-w-8 flex-1 self-stretch px-2")}>
          <span className="sr-only">태그 편집{item.tags.length ? "" : ": "}</span>
          {item.tags.length ? null : <EmptyValue />}
        </PopoverTrigger>
        <PopoverContent className="w-70 p-2">{tagEditor}</PopoverContent>
      </Popover>
    </span>
  ) : (
    chips
  );
  const builtin = (key: BuiltinKey) =>
    key === "status" ? (
      <StatusPicker
        label="상태"
        value={item.status}
        color={item.statusColor}
        options={statusOptions}
        onChange={onStatusChange}
        className="px-2"
      />
    ) : key === "assignee" ? (
      <AssigneePicker
        label="담당"
        value={item.assignee}
        choices={assigneeChoices}
        onChange={onAssigneeChange}
        className="px-2"
      />
    ) : key === "due" ? (
      <DuePicker label="마감" value={item.due} onChange={onDueChange} className="px-2" />
    ) : (
      tagsCell
    );
  const header = (
    <div className="flex items-center gap-1 border-b border-line px-3 py-2">
      <IconButton label="이전 레코드" disabled={!onPrev} onClick={onPrev}>
        <ChevronLeft strokeWidth={1.5} />
      </IconButton>
      <IconButton label="다음 레코드" disabled={!onNext} onClick={onNext}>
        <ChevronRight strokeWidth={1.5} />
      </IconButton>
      <span className="flex-1 pl-2 text-label text-tertiary" aria-live="polite">
        {position.index} / {position.total}
      </span>
      <IconButton label="페이지로 열기" onClick={onOpenPage}>
        <Maximize2 strokeWidth={1.5} />
      </IconButton>
      <IconButton label="닫기" onClick={() => onOpenChange(false)}>
        <X strokeWidth={1.5} />
      </IconButton>
    </div>
  );
  const body = (
    <div className={cn("overflow-y-auto pt-6 pb-12", variant === "side" ? "px-6" : "px-8")}>
      {item.emoji ? (
        <div className="text-h1 leading-none">
          <PageIcon icon={item.emoji} />
        </div>
      ) : null}
      <input
        value={item.title}
        onChange={(e) => onTitleChange(e.target.value)}
        aria-label="제목"
        placeholder="제목 없음"
        className={cn(
          "mt-2 w-full rounded-md bg-transparent text-h1 font-bold tracking-(--tracking-display) text-primary placeholder:text-tertiary",
          focusRing,
        )}
      />
      <div role="table" aria-label="속성" className="mt-4 grid gap-0.5">
        {rows.map((row) => (
          <Row key={row.key} kind={row.kind} name={row.name} menu={row.menu}>
            {row.content ?? builtin(row.kind as BuiltinKey)}
          </Row>
        ))}
      </div>
      {addProperty ? <div className="mt-0.5">{addProperty}</div> : null}
      {progress && progress.total ? <ChecklistProgress {...progress} /> : null}
      <hr className="my-4 border-line" />
      {children}
    </div>
  );
  if (variant === "side")
    return open ? (
      <SidePanel
        label={`레코드: ${name}`}
        onClose={() => onOpenChange(false)}
        className={className}
      >
        {header}
        {body}
      </SidePanel>
    ) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        showClose={false}
        aria-describedby={undefined}
        // 첫 버튼(다음 레코드)에 포커스가 가면 툴팁이 함께 떠서 모달 위를 가린다 — 대화상자 자체에서 시작한다
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
        className={cn(
          "max-w-190 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0",
          className,
        )}
      >
        <DialogTitle className="sr-only">레코드: {name}</DialogTitle>
        {header}
        {body}
      </DialogContent>
    </Dialog>
  );
}

export { ChecklistProgress, RecordDetail, type RecordDetailProps };
