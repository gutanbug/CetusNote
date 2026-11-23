import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { inputClass } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { focusRing, press } from "@/components/ui/styles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import * as React from "react";
import {
  AppWindow,
  ArrowDownUp,
  CalendarDays,
  PanelRight,
  SlidersHorizontal,
  SquareArrowOutUpRight,
  Columns3,
  ListFilter,
  Plus,
  Search,
  Settings2,
  Table2,
  X,
} from "lucide-react";

export type ViewKind = "grid" | "board" | "calendar";
/** 보드 칸 나누기 기준 */
export type FilterField = "status" | "assignee" | "tags";
/** 필터 칩 — 기본 필드 이름이나 사용자 속성 id */
export type ToolbarFilter = { field: string; value: string };
export type ToolbarSort = { field: string; dir: "asc" | "desc" };
/** 필터 메뉴 한 묶음 — 속성 하나와 고를 수 있는 값 */
export type FilterGroup = {
  field: string;
  name: string;
  values: { value: string; label: string }[];
};
/** 레코드 여는 방식 (COLL-07) */
export type OpenMode = "modal" | "side" | "tab";

/** 라디오 값으로 쓰는 "기본값 따르기" (null 대신) */
const DEFAULT_OPEN_VALUE = "default";

const FIELD_NAME: Record<FilterField, string> = { status: "상태", assignee: "담당", tags: "태그" };
const OPEN_MODE_NAME: Record<OpenMode, string> = {
  modal: "모달",
  side: "사이드 패널",
  tab: "새 탭",
};
const OPEN_ICON: Record<OpenMode, React.ReactNode> = {
  modal: <AppWindow strokeWidth={1.5} aria-hidden />,
  side: <PanelRight strokeWidth={1.5} aria-hidden />,
  tab: <SquareArrowOutUpRight strokeWidth={1.5} aria-hidden />,
};

type ToolbarProps = {
  view: ViewKind;
  onViewChange: (view: ViewKind) => void;
  filters: ToolbarFilter[];
  /** 필터 메뉴 — 속성마다 고를 수 있는 값 (기본 필드는 레코드에 있는 것, 선택 속성은 옵션) */
  filterGroups: FilterGroup[];
  onToggleFilter: (filter: ToolbarFilter) => void;
  onClearFilters: () => void;
  sort: ToolbarSort | null;
  /** 정렬 메뉴에 보일 필드 (제목 · 보이는 속성 · 수정일) */
  sortFields: { field: string; name: string }[];
  onSortChange: (sort: ToolbarSort | null) => void;
  search: string;
  onSearchChange: (search: string) => void;
  shown: number;
  total: number;
  onNew: () => void;
  /** 보드 칸을 나누는 기준 — 보드 뷰에서만 ⚙ 메뉴로 보인다 (COLL-03) */
  groupBy?: FilterField;
  onGroupByChange?: (by: FilterField) => void;
  /** 이 컬렉션의 여는 방식 (null = 기본값 따르기) · 앱 기본값 (COLL-07) */
  openMode?: OpenMode | null;
  defaultOpenMode?: OpenMode;
  onOpenModeChange?: (mode: OpenMode | null) => void;
  /** 지금 방식을 모든 컬렉션 기본값으로 */
  onOpenModeDefault?: (mode: OpenMode) => void;
  /** "속성" 팝오버 안 (CL-PropertyList) */
  properties?: React.ReactNode;
  className?: string;
};

/** 툴 버튼 (프로토타입 .db-tool) — 켜져 있으면 포인트 색 */
const tool = cn(
  "inline-flex h-6.5 shrink-0 items-center gap-1 rounded-pill px-3 text-caption text-secondary [&_svg]:size-3.5",
  press,
  "hover:bg-hover hover:text-primary force-hover:bg-hover force-hover:text-primary",
  "data-[on=true]:bg-accent-soft data-[on=true]:text-accent",
  focusRing,
);

const ic = { strokeWidth: 1.5, "aria-hidden": true } as const;

/**
 * CL-Toolbar — 컬렉션 툴바 (프로토타입 §10 `.db-bar`). 뷰 전환 · 필터 · 정렬 · 검색 · 개수 · 새 레코드를
 * 숨은 메뉴 없이 늘 보이게 둔다. 적용된 필터는 칩으로 남고 칩의 ×로 바로 푼다.
 */
function Toolbar({
  view,
  onViewChange,
  filters,
  filterGroups,
  onToggleFilter,
  onClearFilters,
  sort,
  sortFields,
  onSortChange,
  search,
  onSearchChange,
  shown,
  total,
  onNew,
  groupBy,
  onGroupByChange,
  openMode,
  defaultOpenMode = "modal",
  onOpenModeChange,
  onOpenModeDefault,
  properties,
  className,
}: ToolbarProps) {
  const has = (f: ToolbarFilter) => filters.some((x) => x.field === f.field && x.value === f.value);
  const groupOf = (field: string) => filterGroups.find((g) => g.field === field);
  const chipLabel = (f: ToolbarFilter) => {
    const g = groupOf(f.field);
    return `${g?.name ?? f.field}: ${g?.values.find((v) => v.value === f.value)?.label ?? f.value}`;
  };
  const sortName = sort ? (sortFields.find((x) => x.field === sort.field)?.name ?? "정렬") : "";
  const effective = openMode ?? defaultOpenMode;
  return (
    <div
      role="group"
      aria-label="컬렉션 도구"
      data-slot="collection-toolbar"
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-line px-8 pt-4 pb-3",
        className,
      )}
    >
      <Segmented<ViewKind>
        label="보기"
        value={view}
        onValueChange={onViewChange}
        options={[
          { value: "grid", label: "표", icon: <Table2 {...ic} /> },
          { value: "board", label: "보드", icon: <Columns3 {...ic} /> },
          { value: "calendar", label: "캘린더", icon: <CalendarDays {...ic} /> },
        ]}
      />
      <DropdownMenu>
        <DropdownMenuTrigger className={tool} data-press="" data-on={filters.length > 0}>
          <ListFilter {...ic} />
          필터{filters.length ? ` ${filters.length}` : ""}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-48">
          {filterGroups.map(({ field, name, values }) => (
            <DropdownMenuSub key={field}>
              <DropdownMenuSubTrigger>{name}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-80 min-w-40 overflow-y-auto">
                {values.length ? (
                  values.map(({ value, label }) => (
                    <DropdownMenuCheckboxItem
                      key={value}
                      checked={has({ field, value })}
                      onCheckedChange={() => onToggleFilter({ field, value })}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))
                ) : (
                  <DropdownMenuLabel className="font-normal text-tertiary">
                    아직 값이 없어요
                  </DropdownMenuLabel>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
          {filters.length ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={<X {...ic} />} onSelect={onClearFilters}>
                필터 모두 풀기
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger className={tool} data-press="" data-on={!!sort}>
          <ArrowDownUp {...ic} />
          {sort ? `정렬 · ${sortName}` : "정렬"}
          {sort ? (
            <span className="sr-only">{sort.dir === "asc" ? " 오름차순" : " 내림차순"}</span>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-96 min-w-40 overflow-y-auto">
          <DropdownMenuRadioGroup
            value={sort?.field ?? ""}
            onValueChange={(v) => onSortChange({ field: v, dir: sort?.dir ?? "asc" })}
          >
            {sortFields.map(({ field, name }) => (
              <DropdownMenuRadioItem key={field} value={field}>
                {name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={sort?.dir ?? ""}
            onValueChange={(v) => sort && onSortChange({ ...sort, dir: v as ToolbarSort["dir"] })}
          >
            {(["asc", "desc"] as const).map((dir) => (
              <DropdownMenuRadioItem key={dir} value={dir} disabled={!sort}>
                {dir === "asc" ? "오름차순" : "내림차순"}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {sort ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={<X {...ic} />} onSelect={() => onSortChange(null)}>
                정렬 없음
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {filters.length ? (
        <ul aria-label="적용된 필터" className="flex flex-wrap items-center gap-1">
          {filters.map((f) => (
            <li
              key={`${f.field}:${f.value}`}
              className="inline-flex h-6 max-w-55 items-center gap-1 rounded-pill bg-hover pr-1 pl-3 text-label text-primary"
            >
              <span className="truncate">{chipLabel(f)}</span>
              <button
                type="button"
                aria-label={`필터 풀기: ${chipLabel(f)}`}
                onClick={() => onToggleFilter(f)}
                className={cn(
                  "grid size-4.5 shrink-0 place-items-center rounded-pill text-tertiary [&_svg]:size-3",
                  "hover:bg-active hover:text-primary force-hover:bg-active force-hover:text-primary",
                  focusRing,
                )}
              >
                <X {...ic} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <span className="min-w-2 flex-1" />
      <span className="shrink-0 text-label whitespace-nowrap text-tertiary" aria-live="polite">
        {shown === total ? `${total}개` : `${shown}개 / 전체 ${total}개`}
      </span>
      <label className="relative w-45 shrink-0">
        <span className="sr-only">레코드 검색</span>
        <Search
          {...ic}
          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-tertiary"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && search) {
              e.stopPropagation();
              onSearchChange("");
            }
          }}
          placeholder="레코드 검색"
          className={cn(inputClass, "h-6.5 min-h-6.5 pl-8 text-caption")}
        />
      </label>
      {view === "board" && groupBy && onGroupByChange ? (
        <DropdownMenu>
          <DropdownMenuTrigger data-press="" className={tool} aria-label="보드 설정">
            <Settings2 {...ic} />
            <span className="whitespace-nowrap">{FIELD_NAME[groupBy]}별</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>칸 나누기</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={groupBy}
              onValueChange={(v) => onGroupByChange(v as FilterField)}
            >
              {(Object.keys(FIELD_NAME) as FilterField[]).map((f) => (
                <DropdownMenuRadioItem key={f} value={f}>
                  {FIELD_NAME[f]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {properties ? (
        <Popover>
          <PopoverTrigger className={tool} data-press="">
            <SlidersHorizontal {...ic} />
            속성
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-1" aria-label="속성 관리">
            {properties}
          </PopoverContent>
        </Popover>
      ) : null}
      {onOpenModeChange ? (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger
                data-press=""
                className={tool}
                aria-label={`열기 방식: ${OPEN_MODE_NAME[effective]}`}
              >
                {OPEN_ICON[effective]}
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>열기 방식: {OPEN_MODE_NAME[effective]}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>레코드 열기 방식</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={openMode ?? DEFAULT_OPEN_VALUE}
              onValueChange={(v) =>
                onOpenModeChange(v === DEFAULT_OPEN_VALUE ? null : (v as OpenMode))
              }
            >
              <DropdownMenuRadioItem value={DEFAULT_OPEN_VALUE}>
                기본값 따르기 (지금: {OPEN_MODE_NAME[defaultOpenMode]})
              </DropdownMenuRadioItem>
              {(Object.keys(OPEN_MODE_NAME) as OpenMode[]).map((m) => (
                <DropdownMenuRadioItem key={m} value={m}>
                  {OPEN_MODE_NAME[m]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {onOpenModeDefault ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={effective === defaultOpenMode}
                  onSelect={() => onOpenModeDefault(effective)}
                >
                  이 방식을 모든 컬렉션 기본값으로
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <Button size="sm" onClick={onNew}>
        <Plus {...ic} />새 레코드
      </Button>
    </div>
  );
}

export { Toolbar, type ToolbarProps };
