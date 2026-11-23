import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { focusRing } from "@/components/ui/styles";
import { TagChip } from "@/components/ui/tag-chip";
import { cn } from "@/lib/utils";
import { FileText, Maximize2, Plus, Type } from "lucide-react";
import * as React from "react";
import {
  AssigneePicker,
  DuePicker,
  EmptyValue,
  StatusPicker,
  type OpenModifiers,
  type RecordItem,
} from "./fields";
import { PropertyIcon } from "./property";
import type { BuiltinKey, PropertyEntry } from "./property-types";
import { valueButton } from "./styles";
import type { Status, StatusOption } from "@/components/ui/status-chip";
import { PageIcon } from "@/components/ui/page-icon";

/** 표 열 하나 (제목 뒤). 기본 속성은 표가 칸을 그리고, 사용자 속성은 cell로 받는다 (COLL-08) */
export type GridColumn = {
  key: string;
  name: string;
  kind: PropertyEntry["kind"];
  /** 머리 버튼을 감싸는 속성 메뉴 (CL-PropertyMenu) */
  menu?: (trigger: React.ReactElement) => React.ReactNode;
  /** 사용자 속성 칸 */
  cell?: (item: RecordItem) => React.ReactNode;
};

const BUILTIN_COLUMNS: GridColumn[] = [
  { key: "status", name: "상태", kind: "status" },
  { key: "assignee", name: "담당", kind: "assignee" },
  { key: "due", name: "마감", kind: "due" },
  { key: "tags", name: "태그", kind: "tags" },
];

/** 한 번에 그리는 행 수 — 넘으면 "더 보기" */
export const GRID_PAGE = 50;

type GridViewProps = {
  items: RecordItem[];
  /** 레코드 상세 열기 (CL-RecordDetail) */
  /** 레코드 열기 — ⌘(⌃)를 누른 채면 e로 알린다 (COLL-07: 뒤 탭에 열기) */
  onOpen: (id: string, e?: OpenModifiers) => void;
  /** 페이지로 열기 */
  onOpenPage: (id: string) => void;
  onStatusChange: (id: string, status: Status | undefined) => void;
  /** 고를 수 있는 상태 — 컬렉션 상태 목록 */
  statusOptions?: StatusOption[];
  onAssigneeChange: (id: string, name: string | undefined) => void;
  onDueChange: (id: string, date: string | undefined) => void;
  assigneeChoices: string[];
  /** 태그 편집 팝오버 안 (없으면 태그 칸은 읽기 전용) */
  tagEditor?: (id: string) => React.ReactNode;
  onNew: () => void;
  /** 레코드가 하나도 없을 때 표 안에 보일 안내 (필터 결과 0개 포함) */
  empty?: React.ReactNode;
  /** 처음 보이는 행 수 (기본 50) */
  pageSize?: number;
  /** 제목 뒤 열 — 보이는 속성만, 순서대로. 없으면 기본 4개 */
  columns?: GridColumn[];
  /** 머리 맨 끝 "속성 추가" (CL-AddProperty) */
  addColumn?: React.ReactNode;
  className?: string;
};

const ic = { strokeWidth: 1.5, "aria-hidden": true } as const;
const th =
  "sticky top-0 z-2 border-b border-line bg-subtle px-3 py-2 text-left text-label font-medium tracking-(--tracking-label) whitespace-nowrap text-secondary [&_svg]:mr-1 [&_svg]:inline [&_svg]:size-3.5 [&_svg]:align-text-bottom [&_svg]:text-tertiary";
/** 버튼이 없는 칸(읽기 전용 날짜 등)은 셀 자체가 탭 정지점이라 포커스 링을 셀에 준다 */
const td = cn(
  "border-b border-line px-3 py-1.5 align-middle",
  focusRing,
  "focus-visible:-outline-offset-2",
);
/** 제목 열은 가로 스크롤 중에도 왼쪽에 붙는다 (배경을 줘서 뒤 칸이 비치지 않게) */
const titleTh = "left-0 z-3";
const titleTd = "sticky left-0 z-1 bg-app group-hover/row:bg-hover force-hover:bg-hover";
/** 스크롤돼 제목 열 뒤 칸이 숨어 있을 때만 쓰는 가장자리 선 (그림자 토큰은 팝오버·모달용이라 쓰지 않는다) */
const titleEdge = "border-r border-line";

/**
 * CL-GridView — 표 뷰 (프로토타입 §12 `.gtable`). 행 높이 36px, 머리만 bg-subtle, 구분선은 border-line 하나.
 * 제목을 누르면 레코드 상세, 행에 올리면 "페이지로 열기"가 드러난다. 값 칸은 눌러서 팝오버로 고친다.
 */
function GridView({
  items,
  onOpen,
  onOpenPage,
  onStatusChange,
  statusOptions,
  onAssigneeChange,
  onDueChange,
  assigneeChoices,
  tagEditor,
  onNew,
  empty,
  pageSize = GRID_PAGE,
  columns = BUILTIN_COLUMNS,
  addColumn,
  className,
}: GridViewProps) {
  const [limit, setLimit] = React.useState(pageSize);
  const [scrolled, setScrolled] = React.useState(false);
  const [active, setActive] = React.useState({ row: 0, col: 0 });
  const tableRef = React.useRef<HTMLTableElement>(null);
  const span = columns.length + 1 + (addColumn ? 1 : 0);
  const builtinCell = (key: BuiltinKey, r: RecordItem, name: string) =>
    key === "status" ? (
      <StatusPicker
        label={`${name} 상태`}
        value={r.status}
        options={statusOptions}
        color={r.statusColor}
        onChange={(st) => onStatusChange(r.id, st)}
      />
    ) : key === "assignee" ? (
      <AssigneePicker
        label={`${name} 담당`}
        value={r.assignee}
        choices={assigneeChoices}
        onChange={(n) => onAssigneeChange(r.id, n)}
      />
    ) : key === "due" ? (
      <DuePicker label={`${name} 마감`} value={r.due} onChange={(d) => onDueChange(r.id, d)} />
    ) : (
      <TagCell item={r} name={name} editor={tagEditor?.(r.id)} />
    );
  const shown = items.slice(0, limit);
  const rest = items.length - shown.length;

  // 셀 이동 (role=grid): 탭 정지점은 한 곳(활성 셀의 첫 버튼)만 둔다. 나머지는 tabIndex -1.
  const lastRow = Math.max(shown.length - 1, 0);
  const lastCol = columns.length;
  const cur = { row: Math.min(active.row, lastRow), col: Math.min(active.col, lastCol) };
  React.useLayoutEffect(() => {
    const t = tableRef.current;
    if (!t) return;
    t.querySelectorAll<HTMLTableCellElement>("tbody td[data-row]").forEach((cell) => {
      const on = Number(cell.dataset.row) === cur.row && Number(cell.dataset.col) === cur.col;
      const buttons = cell.querySelectorAll<HTMLElement>("button");
      if (!buttons.length) {
        cell.tabIndex = on ? 0 : -1;
        return;
      }
      buttons.forEach((b, i) => {
        b.tabIndex = on && i === 0 ? 0 : -1;
      });
    });
  });
  /** 셀의 키보드 대상 — 셀 안 첫 버튼 (없으면 셀 자체) */
  const focusOf = (cell: HTMLElement) => cell.querySelector<HTMLElement>("button") ?? cell;
  const cellAt = (r: number, c: number) =>
    tableRef.current?.querySelector<HTMLTableCellElement>(
      `tbody td[data-row="${r}"][data-col="${c}"]`,
    );
  /** 셀 안에서 누른 키만 다룬다 (메뉴·팝오버는 포털이라 여기 안 들어온다) */
  const onKeyDownCapture = (e: React.KeyboardEvent<HTMLTableElement>) => {
    if (e.defaultPrevented) return;
    const cell = (e.target as HTMLElement).closest<HTMLTableCellElement>("td[data-row]");
    if (!cell || !tableRef.current?.contains(cell)) return;
    const r = Number(cell.dataset.row);
    const c = Number(cell.dataset.col);
    const ctrl = e.ctrlKey || e.metaKey;
    let nr = r;
    let nc = c;
    switch (e.key) {
      case "ArrowDown":
        nr = Math.min(r + 1, lastRow);
        break;
      case "ArrowUp":
        nr = Math.max(r - 1, 0);
        break;
      case "ArrowRight":
        nc = Math.min(c + 1, lastCol);
        break;
      case "ArrowLeft":
        nc = Math.max(c - 1, 0);
        break;
      case "Home":
        nc = 0;
        if (ctrl) nr = 0;
        break;
      case "End":
        nc = lastCol;
        if (ctrl) nr = lastRow;
        break;
      case "Enter":
        // Enter는 셀 안 버튼이 한다(제목은 열기, 값 칸은 편집). Shift+Enter는 페이지로 열기
        if (e.shiftKey && c === 0 && shown[r]) {
          e.preventDefault();
          e.stopPropagation();
          onOpenPage(shown[r].id);
        }
        return;
      case "F2": {
        // F2는 Enter와 같다: 메뉴 버튼이면 Enter를 흉내 내 연다 (화살표 키는 셀 이동에 쓴다)
        const el = focusOf(cell);
        if (el === cell) return;
        e.preventDefault();
        e.stopPropagation();
        if (el.getAttribute("aria-haspopup") === "menu") {
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        } else {
          el.click();
        }
        return;
      }
      default:
        return;
    }
    // 화살표·Home·End는 Radix 트리거(화살표 ↓ = 메뉴 열기)보다 먼저 잡는다
    e.preventDefault();
    e.stopPropagation();
    const target = cellAt(nr, nc);
    if (target) focusOf(target).focus();
  };
  /** 셀에 포커스가 들어오면 활성 셀을 맞춘다 (마우스 클릭·메뉴 닫힘 복귀 포함) */
  const onFocus = (e: React.FocusEvent<HTMLTableElement>) => {
    const cell = (e.target as HTMLElement).closest<HTMLTableCellElement>("td[data-row]");
    if (cell && tableRef.current?.contains(cell)) {
      setActive({ row: Number(cell.dataset.row), col: Number(cell.dataset.col) });
    }
  };

  return (
    <div data-slot="collection-grid" className={className}>
      <div
        className="group/grid overflow-x-auto rounded-lg border border-line"
        onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}
      >
        <table
          ref={tableRef}
          role="grid"
          aria-label="레코드 표"
          aria-rowcount={items.length + 1}
          aria-colcount={span}
          onKeyDownCapture={onKeyDownCapture}
          onFocus={onFocus}
          className="w-full min-w-190 border-collapse text-ui"
        >
          <thead role="rowgroup">
            <tr role="row" aria-rowindex={1}>
              <th
                scope="col"
                role="columnheader"
                aria-colindex={1}
                className={cn(th, "w-2/5", titleTh, scrolled && titleEdge)}
              >
                <Type {...ic} />
                제목
              </th>
              {columns.map((c, i) => {
                const head = (
                  <button
                    type="button"
                    aria-label={`${c.name} 속성 메뉴`}
                    className={cn(
                      "-mx-1.5 inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5",
                      "hover:bg-active hover:text-primary force-hover:bg-active force-hover:text-primary",
                      focusRing,
                    )}
                  >
                    <PropertyIcon kind={c.kind} className="mr-0 text-tertiary" />
                    <span className="truncate">{c.name}</span>
                  </button>
                );
                return (
                  <th
                    key={c.key}
                    scope="col"
                    role="columnheader"
                    aria-colindex={i + 2}
                    className={cn(th, "min-w-30")}
                  >
                    {c.menu ? (
                      c.menu(head)
                    ) : (
                      <>
                        <PropertyIcon kind={c.kind} />
                        {c.name}
                      </>
                    )}
                  </th>
                );
              })}
              {addColumn ? (
                <th scope="col" role="columnheader" className={cn(th, "w-10 px-1")}>
                  {addColumn}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {!items.length && empty ? (
              <tr role="row" aria-rowindex={2}>
                <td role="gridcell" colSpan={span} className="px-3 py-8">
                  {empty}
                </td>
              </tr>
            ) : null}
            {shown.map((r, ri) => {
              const name = r.title || "제목 없음";
              return (
                <tr
                  key={r.id}
                  role="row"
                  aria-rowindex={ri + 2}
                  className="group/row h-9 transition-colors duration-(--dur-fast) hover:bg-hover force-hover:bg-hover last:[&>td]:border-b-0"
                >
                  <td
                    role="gridcell"
                    aria-colindex={1}
                    data-row={ri}
                    data-col={0}
                    className={cn(td, titleTd, scrolled && titleEdge)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => onOpen(r.id, e)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-md text-left font-medium",
                          !r.title && "text-tertiary",
                          focusRing,
                        )}
                      >
                        {r.emoji ? (
                          <span aria-hidden className="shrink-0">
                            <PageIcon icon={r.emoji} />
                          </span>
                        ) : (
                          <FileText {...ic} className="size-4 shrink-0 text-tertiary" />
                        )}
                        <span className="truncate">{name}</span>
                      </button>
                      <IconButton
                        label={`“${name}” 페이지로 열기`}
                        onClick={() => onOpenPage(r.id)}
                        className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 force-hover:opacity-100"
                      >
                        <Maximize2 strokeWidth={1.5} />
                      </IconButton>
                    </div>
                  </td>
                  {columns.map((c, ci) => (
                    <td
                      key={c.key}
                      role="gridcell"
                      aria-colindex={ci + 2}
                      data-row={ri}
                      data-col={ci + 1}
                      className={td}
                    >
                      {c.cell ? c.cell(r) : builtinCell(c.kind as BuiltinKey, r, name)}
                    </td>
                  ))}
                  {addColumn ? <td role="gridcell" className={td} /> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!items.length && empty ? null : (
          <button
            type="button"
            onClick={onNew}
            className={cn(
              "flex min-h-9 w-full items-center gap-2 border-t border-line px-3 py-1 text-ui text-tertiary",
              // 표 바닥 줄은 늘 보인다(옅은 글자) — 숨기면 표 끝이 비어 보인다 (2026-11-20 사용자 요청).
              // 레코드가 하나도 없을 때는 빈 상태 블록이 대신한다
              "transition-[background-color,color] duration-(--dur-fast) hover:bg-hover hover:text-primary force-hover:bg-hover force-hover:text-primary",
              focusRing,
              "focus-visible:-outline-offset-2",
            )}
          >
            <Plus {...ic} className="size-4" />새 레코드
          </button>
        )}
      </div>
      {rest > 0 ? (
        <div className="flex justify-center py-3">
          <Button variant="secondary" size="sm" onClick={() => setLimit((n) => n + pageSize)}>
            더 보기 ({rest}개 남음)
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TagCell({
  item,
  name,
  editor,
}: {
  item: RecordItem;
  name: string;
  editor?: React.ReactNode;
}) {
  const chips = item.tags.length ? (
    <span className="flex min-w-0 flex-wrap gap-1">
      {item.tags.map((t) => (
        <TagChip key={t.name} color={t.color}>
          {t.name}
        </TagChip>
      ))}
    </span>
  ) : (
    <EmptyValue />
  );
  if (!editor) return <span className="flex px-1">{chips}</span>;
  return (
    <Popover>
      <PopoverTrigger className={valueButton} aria-label={`${name} 태그 편집`}>
        {chips}
      </PopoverTrigger>
      <PopoverContent className="w-70 p-2">{editor}</PopoverContent>
    </Popover>
  );
}

export { GridView, type GridViewProps };
