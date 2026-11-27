import { useMessages } from "@/lib/i18n";
import { COLOR_NAMES } from "@/components/ui/color-popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { inputClass } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { focusRing } from "@/components/ui/styles";
import { SOFT_COLORS, TagChip, type SoftColor } from "@/components/ui/tag-chip";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calculator,
  Ellipsis,
  Eye,
  EyeOff,
  FileText,
  Maximize2,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { DateText, Owner, type OpenModifiers, type RecordItem } from "./fields";
import { PageIcon } from "@/components/ui/page-icon";

const ic = { strokeWidth: 1.5, "aria-hidden": true } as const;

type Arrow = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";
const isArrow = (key: string): key is Arrow =>
  key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown";
/** 카드 메뉴의 옮기기 항목 — Alt+화살표와 같다 */
const MOVES = [
  { key: "ArrowLeft", glyph: "←", msgKey: "moveCellLeft", Icon: ArrowLeft },
  { key: "ArrowRight", glyph: "→", msgKey: "moveCellRight", Icon: ArrowRight },
  { key: "ArrowUp", glyph: "↑", msgKey: "moveUp", Icon: ArrowUp },
  { key: "ArrowDown", glyph: "↓", msgKey: "moveDown", Icon: ArrowDown },
] as const;

/** 칸 바탕 — 칸 색을 옅게 깐다(AppFlowy 보드처럼). 카드는 그 위에 bg-elevated로 뜬다.
 * 값은 토큰 --board-tint-*(tokens.css): 라이트는 기존 bg/60과 같고, 다크는 글자색 18%로 색상이 보이게 한다 */
const COLUMN_TINT: Record<SoftColor, string> = {
  gray: "bg-board-tint-gray",
  brown: "bg-board-tint-brown",
  orange: "bg-board-tint-orange",
  yellow: "bg-board-tint-yellow",
  green: "bg-board-tint-green",
  blue: "bg-board-tint-blue",
  purple: "bg-board-tint-purple",
  pink: "bg-board-tint-pink",
  red: "bg-board-tint-red",
};

/** 다크에서 칩 바탕이 카드·칸과 거의 같아 가장자리가 죽는다. 글자색 테두리를 얇게 둘러 칩 윤곽을 살린다 (라이트 무변화) */
const BOARD_CHIP = "dark:ring-1 dark:ring-inset dark:ring-current/35";
/** 카드 속성 줄의 칩 — 줄이 모자라면 줄어든다(잘림은 칩 안 글자에서) */
const BOARD_META_CHIP = `${BOARD_CHIP} min-w-0 shrink`;

/** 칸 머리 계산 */
export type BoardCalcKind = "count" | "due" | "late" | "none";
const CALC_KINDS: BoardCalcKind[] = ["count", "due", "late", "none"];

/** 보드 칸 하나 */
/** 칸 하나가 한 번에 그리는 카드 수 — 넘으면 「더 보기」 (SYS-11) */
export const BOARD_PAGE = 50;

export type BoardColumn = {
  /** 칸 키 (예: "status:진행 중") */
  key: string;
  label: string;
  color: SoftColor;
  items: RecordItem[];
  /** 칸 머리 계산 결과 (예: "3개"). 없으면 보이지 않는다 */
  calc?: string | null;
  /** "상태 없음"처럼 값이 없는 칸 — 칩 대신 글자로 */
  none?: boolean;
  /** 이름 바꾸기·옮기기·삭제를 할 수 있는 칸 (상태 칸) */
  editable?: boolean;
};

type CardProps = {
  item: RecordItem;
  dragging?: boolean;
  className?: string;
} & Omit<React.ComponentProps<"button">, "children">;

/** CL-Card — 보드 카드 (프로토타입 §13 `.bcard`). 아이콘 + 제목 · 태그 · 담당 · 마감 */
function Card({ item, dragging, className, ...props }: CardProps) {
  const m = useMessages();
  const extra = item.extra ?? [];
  const meta = item.tags.length || item.assignee || item.due || extra.length;
  return (
    <button
      type="button"
      data-slot="collection-card"
      data-dragging={dragging || undefined}
      className={cn(
        // 라이트는 프로토타입(bg-app)과 같은 흰색. 다크는 칸보다 밝은 면이라 카드가 떠 보인다
        "grid w-full min-w-0 cursor-grab grid-cols-1 gap-2 rounded-lg border border-line bg-board-card p-3 text-left",
        "transition-[background-color,opacity] duration-(--dur-fast) hover:bg-hover force-hover:bg-hover",
        "data-dragging:opacity-45",
        focusRing,
        className,
      )}
      {...props}
    >
      <span className="flex items-start gap-2">
        {item.emoji ? (
          <span aria-hidden className="w-4 shrink-0 text-center text-ui leading-snug">
            <PageIcon icon={item.emoji} />
          </span>
        ) : (
          <FileText {...ic} className="mt-0.5 size-4 shrink-0 text-tertiary" />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 text-ui font-medium wrap-anywhere text-primary",
            !item.title && "text-tertiary",
          )}
        >
          {item.title || m.collection.untitled}
        </span>
      </span>
      {meta ? (
        // 속성 줄은 한 줄을 넘기지 않는다. 날짜는 줄어들지 않고, 칩·담당·값은 줄어들며 잘린다.
        // 그래도 넘치면 줄 끝에서 가린다(카드 폭이 같으면 줄 길이와 무관하게 높이가 같다).
        <span className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
          {item.tags.map((t) => (
            <TagChip key={t.name} color={t.color} className={BOARD_META_CHIP}>
              {t.name}
            </TagChip>
          ))}
          {item.assignee ? (
            <span className="flex min-w-0 shrink">
              <Owner name={item.assignee} />
            </span>
          ) : null}
          {item.due ? <DateText value={item.due} compact /> : null}
          {extra.map((x) =>
            x.chips?.length ? (
              x.chips.map((c) => (
                <TagChip key={`${x.key}:${c.name}`} color={c.color} className={BOARD_META_CHIP}>
                  <span className="sr-only">{x.name}: </span>
                  {c.name}
                </TagChip>
              ))
            ) : (
              <span
                key={x.key}
                title={x.name}
                className="inline-flex min-w-0 shrink items-center gap-1 text-label text-secondary"
              >
                <span className="sr-only">{x.name}: </span>
                <span className="min-w-0 truncate">{x.text}</span>
              </span>
            ),
          )}
        </span>
      ) : null}
    </button>
  );
}

/**
 * 끌 때 들어갈 자리 — 끄는 카드를 흐리게 미리 보여 준다(AppFlowy 보드처럼, 2026-11-20 사용자 요청).
 * 자리를 미리 벌려 놓아 놓은 뒤에 카드가 튀지 않는다. 누를 수 없고 읽히지 않는다.
 */
function DropPreview({ item }: { item: RecordItem }) {
  return (
    <li aria-hidden inert data-slot="drop-preview" className="pointer-events-none">
      <Card item={item} tabIndex={-1} className="cursor-default opacity-50" />
    </li>
  );
}

/** 놓을 자리: key 칸의 beforeId 카드 앞. beforeId가 null이면 칸 맨 끝 */
type DropAt = { key: string; beforeId: string | null };
/** 옮길 자리. 같은 칸 안이면 순서만 바뀐다 */
export type BoardPlace = { beforeId?: string | null; afterId?: string | null };

type BoardViewProps = {
  columns: BoardColumn[];
  /** 숨긴 칸 — 맨 끝 "숨긴 칸" 목록에 보인다 */
  hidden?: { key: string; label: string; color: SoftColor; count: number; none?: boolean }[];
  /** 레코드 열기 — ⌘(⌃)를 누른 채면 e로 알린다 (COLL-07: 뒤 탭에 열기) */
  onOpen: (id: string, e?: OpenModifiers) => void;
  onOpenPage?: (id: string) => void;
  onTrash?: (id: string) => void;
  /** 카드 옮기기. from과 to가 같으면 칸 안 순서만 바뀐다 */
  onMove: (id: string, from: string, to: string, place: BoardPlace) => void;
  /** 칸 안 순서를 바꿀 수 있는지 (정렬이 걸려 있으면 false) */
  reorderable?: boolean;
  onNew: (key: string) => void;
  /** 칸 더하기 (상태로 나눌 때) */
  onAddColumn?: () => void;
  onRenameColumn?: (key: string, name: string) => void;
  onDeleteColumn?: (key: string) => void;
  onMoveColumn?: (key: string, dir: -1 | 1) => void;
  onHideColumn?: (key: string) => void;
  onShowColumn?: (key: string) => void;
  onColorChange?: (key: string, color: SoftColor) => void;
  calc?: BoardCalcKind;
  onCalcChange?: (calc: BoardCalcKind) => void;
  className?: string;
};

/** 칸 이름 바꾸기 입력 — Enter·바깥 클릭으로 저장, Esc로 취소 */
function RenameInput({ value, onDone }: { value: string; onDone: (name: string | null) => void }) {
  const m = useMessages();
  const [draft, setDraft] = React.useState(value);
  const done = React.useRef(false);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };
  return (
    <input
      autoFocus
      value={draft}
      aria-label={m.collection.board.columnName}
      maxLength={40}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) finish(draft.trim() || null);
        if (e.key === "Escape") {
          e.stopPropagation();
          finish(null);
        }
      }}
      onBlur={() => finish(draft.trim() || null)}
      className={cn(inputClass, "h-6.5 min-h-6.5 min-w-0 flex-1 px-2 text-caption")}
    />
  );
}

/**
 * CL-BoardView — 보드 뷰 (프로토타입 §13, 2026-11-20 사용자 요청으로 AppFlowy 보드처럼).
 * 칸은 상태·담당·태그 중 하나로 나뉘고, 칸 바탕은 칸 색을 옅게 깐다. 머리에는 계산(개수 등)과 ＋·더 보기 메뉴
 * (이름 바꾸기·색·계산·옮기기·숨기기·삭제), 바닥에는 "새 레코드"가 늘 있다(표 뷰와 같은 말).
 * 카드를 끌면 들어갈 자리에 그 카드가 흐리게 미리 보이고(원래 자리는 비운다), 같은 칸 안에서도 순서를 바꾼다.
 * 키보드: 카드에서 Alt+←/→로 옆 칸, Alt+↑/↓로 칸 안 순서.
 */
function BoardView({
  columns,
  hidden = [],
  onOpen,
  onOpenPage,
  onTrash,
  onMove,
  reorderable = true,
  onNew,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
  onMoveColumn,
  onHideColumn,
  onShowColumn,
  onColorChange,
  calc,
  onCalcChange,
  className,
}: BoardViewProps) {
  const m = useMessages();
  /** 끄는 카드와 원래 칸 */
  type Drag = { id: string; from: string };
  const [drag, setDrag] = React.useState<Drag>();
  const dragRef = React.useRef<Drag | undefined>(undefined);
  const [over, setOver] = React.useState<DropAt>();
  const [renaming, setRenaming] = React.useState<string>();
  /** 칸마다 그릴 카드 수 (칸 키 → 수). 「더 보기」로 늘린다 */
  const [cardLimits, setCardLimits] = React.useState<Record<string, number>>({});
  const [announce, setAnnounce] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);
  /** 키보드로 옮긴 카드 — 옮긴 칸에서 포커스를 이어 간다 */
  const refocus = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (!refocus.current) return;
    const el = rootRef.current?.querySelector<HTMLElement>(
      `[data-record="${CSS.escape(refocus.current)}"]`,
    );
    if (el) {
      el.focus();
      refocus.current = undefined;
    }
  });
  const dragItem = drag ? columns.flatMap((c) => c.items).find((r) => r.id === drag.id) : undefined;
  const end = () => {
    dragRef.current = undefined;
    setDrag(undefined);
    setOver(undefined);
  };
  const say = (title: string, to: BoardColumn, same: boolean) =>
    setAnnounce(
      same
        ? m.collection.board.reordered(title || m.collection.untitled)
        : m.collection.board.moved(title || m.collection.untitled, to.label),
    );

  /** 놓을 자리가 지금 자리와 같으면 undefined */
  const dropAt = (col: BoardColumn, beforeId: string | null): DropAt | undefined => {
    const d = dragRef.current;
    if (!d) return undefined;
    if (d.from === col.key) {
      if (!reorderable) return undefined;
      const ids = col.items.map((r) => r.id);
      const i = ids.indexOf(d.id);
      const next = ids[i + 1] ?? null;
      if (beforeId === d.id || beforeId === next) return undefined;
    } else if (col.items.some((r) => r.id === d.id)) {
      // 태그 칸: 이미 그 칸에도 있는 카드
      return undefined;
    }
    return { key: col.key, beforeId };
  };

  /** 마우스 위치로 놓을 자리 찾기 — 카드 위쪽 반이면 그 앞, 아래쪽 반이면 그 뒤 */
  const pointAt = (col: BoardColumn, e: React.DragEvent): string | null => {
    const lis = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-card]")];
    for (const li of lis) {
      // 끄는 카드 자신은 빼고 잰다(자리를 비운 채 칸 위에 떠 있다)
      if (li.dataset.card === dragRef.current?.id) continue;
      const r = li.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) return li.dataset.card ?? null;
    }
    void col;
    return null;
  };

  const place = (col: BoardColumn, at: DropAt, id: string): BoardPlace => {
    if (at.beforeId) return { beforeId: at.beforeId };
    const rest = col.items.filter((r) => r.id !== id);
    return { afterId: rest[rest.length - 1]?.id ?? null };
  };

  /** 메뉴가 열린 동안 트리거를 hover 모양으로 둔다 */
  const openOn = "data-[state=open]:bg-active data-[state=open]:text-primary";

  return (
    <div data-slot="collection-board" className={className}>
      <div ref={rootRef} className="flex items-start gap-3 overflow-x-auto overscroll-contain pb-4">
        {columns.map((col, ci) => {
          const headId = `board-col-${ci}`;
          // 칸마다 카드는 BOARD_PAGE장까지만 그린다 — 나머지는 「더 보기」 (SYS-11). 인덱스는 전체 목록 기준이라 끌기·Alt+화살표는 그대로다
          const limit = cardLimits[col.key] ?? BOARD_PAGE;
          const visible = col.items.length > limit ? col.items.slice(0, limit) : col.items;
          const restCount = col.items.length - visible.length;
          const dropping = over?.key === col.key;
          const cross = dropping && drag?.from !== col.key;
          const isEnd = dropping && over?.beforeId === null;
          return (
            <section
              key={col.key}
              aria-labelledby={headId}
              data-column={col.key}
              data-dropline={cross || undefined}
              onDragOver={(e) => {
                if (!dragRef.current) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const at = dropAt(col, pointAt(col, e));
                if (at?.key !== over?.key || at?.beforeId !== over?.beforeId) setOver(at);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(undefined);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const d = dragRef.current;
                const at = d ? dropAt(col, pointAt(col, e)) : undefined;
                if (d && at) {
                  const item =
                    col.items.find((r) => r.id === d.id) ??
                    columns.flatMap((c) => c.items).find((r) => r.id === d.id);
                  onMove(d.id, d.from, col.key, place(col, at, d.id));
                  say(item?.title ?? "", col, d.from === col.key);
                }
                end();
              }}
              className={cn(
                "group/col grid w-70 shrink-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 rounded-lg p-2",
                COLUMN_TINT[col.color],
              )}
            >
              <div className="flex min-h-7.5 items-center gap-1 pl-1">
                {renaming === col.key ? (
                  <RenameInput
                    value={col.label}
                    onDone={(name) => {
                      setRenaming(undefined);
                      if (name && name !== col.label) onRenameColumn?.(col.key, name);
                    }}
                  />
                ) : (
                  <h2 id={headId} className="flex min-w-0 flex-1 items-center gap-2">
                    {col.none ? (
                      <span className="truncate text-caption font-medium text-secondary">
                        {col.label}
                      </span>
                    ) : (
                      <StatusChip status={col.label} color={col.color} className={BOARD_CHIP} />
                    )}
                    {col.calc ? (
                      <span className="shrink-0 text-label font-normal text-tertiary">
                        {col.calc}
                      </span>
                    ) : null}
                  </h2>
                )}
                <span
                  className={cn(
                    "flex shrink-0 items-center",
                    "opacity-0 transition-opacity duration-(--dur-fast) group-hover/col:opacity-100 focus-within:opacity-100 force-hover:opacity-100",
                    "has-data-[state=open]:opacity-100",
                  )}
                >
                  <IconButton
                    label={m.collection.board.newRecordIn(col.label)}
                    onClick={() => onNew(col.key)}
                  >
                    <Plus {...ic} />
                  </IconButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton
                        label={m.collection.board.columnMenu(col.label)}
                        className={openOn}
                      >
                        <Ellipsis {...ic} />
                      </IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {col.editable && onRenameColumn ? (
                        <DropdownMenuItem
                          icon={<Pencil {...ic} />}
                          onSelect={() => setRenaming(col.key)}
                        >
                          {m.collection.board.rename}
                        </DropdownMenuItem>
                      ) : null}
                      {onColorChange ? (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger icon={<Palette {...ic} />}>
                            {m.collection.board.color}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-40">
                            <DropdownMenuRadioGroup
                              value={col.color}
                              onValueChange={(c) => onColorChange(col.key, c as SoftColor)}
                            >
                              {SOFT_COLORS.map((c) => (
                                <DropdownMenuRadioItem key={c} value={c}>
                                  <StatusChip status={COLOR_NAMES[c]} color={c} />
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      ) : null}
                      {onCalcChange ? (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger icon={<Calculator {...ic} />}>
                            {m.collection.board.calcTitle}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-40">
                            <DropdownMenuRadioGroup
                              value={calc}
                              onValueChange={(k) => onCalcChange(k as BoardCalcKind)}
                            >
                              {CALC_KINDS.map((k) => (
                                <DropdownMenuRadioItem key={k} value={k}>
                                  {m.collection.board.calc[k]}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      ) : null}
                      {col.editable && onMoveColumn ? (
                        <>
                          <DropdownMenuItem
                            icon={<ArrowLeft {...ic} />}
                            disabled={!columns[ci - 1]?.editable}
                            onSelect={() => onMoveColumn(col.key, -1)}
                          >
                            {m.collection.board.moveLeftItem}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            icon={<ArrowRight {...ic} />}
                            disabled={!columns[ci + 1]?.editable}
                            onSelect={() => onMoveColumn(col.key, 1)}
                          >
                            {m.collection.board.moveRightItem}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      {onHideColumn ? (
                        <DropdownMenuItem
                          icon={<EyeOff {...ic} />}
                          onSelect={() => onHideColumn(col.key)}
                        >
                          {m.collection.board.hide}
                        </DropdownMenuItem>
                      ) : null}
                      {col.editable && onDeleteColumn ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="danger"
                            icon={<Trash2 {...ic} />}
                            onSelect={() => onDeleteColumn(col.key)}
                          >
                            {m.collection.board.deleteStatus}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              </div>
              <ul className="relative grid min-h-2 content-start gap-2">
                {visible.map((item, i) => {
                  const before = dropping && over?.beforeId === item.id;
                  // 다른 자리에 스켈레톤이 보이면 원래 카드는 자리를 비운다(AppFlowy처럼)
                  const lifted = !!over && drag?.id === item.id && drag.from === col.key;
                  /** Alt+화살표·카드 메뉴: 옆 칸(←→) 끝으로, 칸 안 한 칸 위·아래(↑↓). 옮길 수 없으면 false */
                  const planMove = (key: Arrow): [BoardColumn, BoardPlace] | undefined => {
                    const ids = col.items.map((r) => r.id);
                    if (key === "ArrowLeft" || key === "ArrowRight") {
                      const to = columns[ci + (key === "ArrowLeft" ? -1 : 1)];
                      if (!to || to.items.some((r) => r.id === item.id)) return undefined;
                      return [to, { afterId: to.items[to.items.length - 1]?.id ?? null }];
                    }
                    if (!reorderable) return undefined;
                    if (key === "ArrowUp" && i > 0) return [col, { beforeId: ids[i - 1] }];
                    if (key === "ArrowDown" && i < ids.length - 1)
                      return [col, { afterId: ids[i + 1] }];
                    return undefined;
                  };
                  const moveBy = (key: Arrow) => {
                    const plan = planMove(key);
                    if (!plan) return false;
                    const [to, at] = plan;
                    refocus.current = item.id;
                    onMove(item.id, col.key, to.key, at);
                    say(item.title, to, to.key === col.key);
                    return true;
                  };
                  return (
                    <React.Fragment key={item.id}>
                      {before && dragItem ? <DropPreview item={dragItem} /> : null}
                      <li
                        data-card={item.id}
                        data-lifted={lifted || undefined}
                        className="group/card relative data-lifted:pointer-events-none data-lifted:absolute data-lifted:inset-x-0 data-lifted:top-0 data-lifted:opacity-0"
                      >
                        <Card
                          item={item}
                          dragging={drag?.id === item.id && drag.from === col.key}
                          data-record={item.id}
                          draggable
                          aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
                          onClick={(e) => onOpen(item.id, e)}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            // WebKit은 데이터가 없으면 끌기를 시작하지 않는다
                            e.dataTransfer.setData(
                              "text/plain",
                              item.title || m.collection.untitled,
                            );
                            const d = {
                              id: item.id,
                              from: col.key,
                              height: e.currentTarget.getBoundingClientRect().height,
                            };
                            dragRef.current = d;
                            setDrag(d);
                          }}
                          onDragEnd={end}
                          onKeyDown={(e) => {
                            if (!e.altKey || !isArrow(e.key)) return;
                            if (moveBy(e.key)) e.preventDefault();
                          }}
                          // 오른쪽 위 동작 알약(버튼 두 개, 약 60px)이 제목을 덮지 않게 자리를 비워 둔다
                          className={onOpenPage || onTrash ? "pr-16" : undefined}
                        />
                        {onOpenPage || onTrash ? (
                          <span
                            className={cn(
                              // 버튼(둥근 26px) 두 개를 같은 모양의 알약 틀에 담는다 — 안쪽 2px 여백으로 hover 원이 틀에 닿지 않게
                              "absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-pill border border-line bg-elevated p-0.5",
                              "opacity-0 transition-opacity duration-(--dur-fast) group-hover/card:opacity-100 focus-within:opacity-100 force-hover:opacity-100",
                              "has-data-[state=open]:opacity-100",
                            )}
                          >
                            {onOpenPage ? (
                              <IconButton
                                label={m.collection.board.openPage(
                                  item.title || m.collection.untitled,
                                )}
                                onClick={() => onOpenPage(item.id)}
                              >
                                <Maximize2 {...ic} />
                              </IconButton>
                            ) : null}
                            {onTrash ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <IconButton
                                    label={m.collection.board.itemMenu(
                                      item.title || m.collection.untitled,
                                    )}
                                    className={openOn}
                                  >
                                    <Ellipsis {...ic} />
                                  </IconButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  {/* 끌기 대신 쓰는 옮기기 — Alt+화살표와 같은 동작, 단축키를 함께 보인다 */}
                                  {MOVES.map((mv) => (
                                    <DropdownMenuItem
                                      key={mv.key}
                                      icon={<mv.Icon {...ic} />}
                                      shortcut={<Kbd keys={["⌥", mv.glyph]} />}
                                      disabled={!planMove(mv.key)}
                                      onSelect={() => moveBy(mv.key)}
                                    >
                                      {m.collection.board[mv.msgKey]}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="danger"
                                    icon={<Trash2 {...ic} />}
                                    onSelect={() => onTrash(item.id)}
                                  >
                                    {m.collection.board.moveToTrash}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </span>
                        ) : null}
                      </li>
                    </React.Fragment>
                  );
                })}
                {isEnd && dragItem ? <DropPreview item={dragItem} /> : null}
              </ul>
              {restCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setCardLimits((m) => ({ ...m, [col.key]: limit + BOARD_PAGE }))}
                  className={cn(
                    "flex min-h-7.5 w-full items-center gap-2 rounded-pill px-2 py-1 text-caption text-secondary",
                    "hover:bg-hover hover:text-primary force-hover:bg-hover force-hover:text-primary",
                    focusRing,
                  )}
                >
                  {m.collection.board.showMore(m.collection.model.count(restCount))}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onNew(col.key)}
                aria-label={m.collection.board.newRecordIn(col.label)}
                className={cn(
                  "flex min-h-7.5 w-full items-center gap-2 rounded-pill px-2 py-1 text-caption text-secondary",
                  "transition-[background-color,color] duration-(--dur-fast) hover:bg-hover hover:text-primary force-hover:bg-hover force-hover:text-primary",
                  focusRing,
                )}
              >
                <Plus {...ic} className="size-4" />
                {m.collection.board.newRecord}
              </button>
            </section>
          );
        })}
        {onAddColumn || hidden.length ? (
          <div className="grid w-60 shrink-0 content-start gap-3">
            {onAddColumn ? (
              <button
                type="button"
                onClick={onAddColumn}
                className={cn(
                  "flex min-h-7.5 items-center gap-2 rounded-pill px-3 text-caption text-secondary",
                  "hover:bg-hover hover:text-primary force-hover:bg-hover force-hover:text-primary",
                  focusRing,
                )}
              >
                <Plus {...ic} className="size-4" />
                {m.collection.model.newStatus()}
              </button>
            ) : null}
            {hidden.length ? (
              <section
                aria-labelledby="board-hidden"
                className="grid gap-1 rounded-lg bg-subtle p-2"
              >
                <h2 id="board-hidden" className="px-1 py-1 text-label font-medium text-secondary">
                  {m.collection.board.hiddenColumns}
                </h2>
                <ul className="grid gap-0.5">
                  {hidden.map((h) => (
                    <li key={h.key}>
                      <button
                        type="button"
                        onClick={() => onShowColumn?.(h.key)}
                        aria-label={m.collection.board.showColumn(
                          h.label,
                          m.collection.model.count(h.count),
                        )}
                        className={cn(
                          "group/hid flex min-h-7.5 w-full items-center gap-2 rounded-md px-1 text-left",
                          "hover:bg-hover force-hover:bg-hover",
                          focusRing,
                        )}
                      >
                        {h.none ? (
                          <span className="truncate text-caption text-secondary">{h.label}</span>
                        ) : (
                          <StatusChip status={h.label} color={h.color} className={BOARD_CHIP} />
                        )}
                        <span className="flex-1 text-label text-tertiary">
                          {m.collection.model.count(h.count)}
                        </span>
                        <Eye
                          {...ic}
                          className="size-4 text-tertiary opacity-0 group-hover/hid:opacity-100 group-focus-visible/hid:opacity-100 force-hover:opacity-100"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
      <p role="status" className="sr-only">
        {announce}
      </p>
    </div>
  );
}

export { BoardView, Card, type BoardViewProps, type CardProps };
