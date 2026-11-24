import { ChevronRight, Ellipsis, FileText, Folder, FolderOpen, Plus, Table2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { startsWithTyped } from "@/lib/hangul";
import { cn } from "@/lib/utils";
import * as React from "react";
import { DropIndicator, type DropPosition } from "./drop-indicator";
import { insetFocus, revealOnRow, rowActive, rowBase } from "./parts";
import { PageIcon } from "@/components/ui/page-icon";
import { keepMovedFocus } from "@/components/ui/menu-focus";
import { type FlatRow, ROW_HEIGHT, flattenRows, windowRange } from "./page-tree-rows";

const TYPEAHEAD_MS = 500;
/** 한 단계 들여쓰기 = 12px(ml-3) + 테두리 1px + 2px(pl-0.5) = 15px */
const INDENT_UNITS = 3.75;
/** 첫 안내선의 위치 = 12px (ml-3) */
const GUIDE_UNITS = 3;
/** 드래그 중 스크롤 영역 가장자리에서 이 거리(px) 안이면 자동으로 스크롤한다 */
const AUTO_SCROLL_EDGE = 32;
/** 가장자리에서 한 프레임에 움직이는 최대 거리(px) */
const AUTO_SCROLL_MAX_STEP = 16;
/** 스크롤 영역이 SH-Sidebar의 ScrollArea 뷰포트인지 찾는 표시 */
const SCROLL_VIEWPORT_SLOT = '[data-slot="scroll-area-viewport"]';

/** 토큰 간격(--spacing)의 배수로 길이를 만든다 (px를 직접 쓰지 않는다) */
const space = (units: number) => `calc(var(--spacing) * ${units})`;

export type PageNode = {
  id: string;
  title: string;
  /**
   * folder: 묶음만 한다 — 이름을 눌러도 펼치고 접는다(열리는 본문이 없다). 하위에 폴더·문서.
   * page(기본): 이름을 누르면 연다. 하위 문서를 가질 수 있고 펼침은 화살표로만.
   * collection: 표·보드·캘린더로 여는 페이지(COLL-01). 레코드는 트리에 그리지 않는다.
   */
  kind?: "page" | "folder" | "collection";
  /** 페이지 아이콘(이모지). 없으면 문서 아이콘. 폴더는 쓰지 않는다 */
  emoji?: string;
  children?: PageNode[];
};

type PageTreeProps = {
  pages: PageNode[];
  /** 지금 열린 페이지 */
  activeId?: string;
  /** 펼친 페이지 id (제어) */
  expanded: string[];
  onExpandedChange: (ids: string[]) => void;
  /** 문서 열기. 폴더 행은 부르지 않고 펼침을 바꾼다. ⌘클릭 · ⌘Enter면 newTab (SHELL-11) */
  onOpen: (id: string, opts?: { newTab: boolean }) => void;
  /** 행의 ＋ — 하위 페이지 추가(폴더면 폴더 안에 새 문서). addMenu가 있으면 쓰지 않는다 */
  onAddChild?: (id: string) => void;
  /** 행의 ＋ 메뉴 항목 (새 페이지 · 새 폴더 …). 주면 ＋가 바로 만들지 않고 이 메뉴를 연다 */
  addMenu?: (node: PageNode) => React.ReactNode;
  /** 행의 ··· 메뉴 항목 (OV-Menu 항목들). Shift+F10으로도 연다 */
  rowMenu?: (node: PageNode) => React.ReactNode;
  /** 끄는 중인 페이지 (반투명). 주지 않으면 끄는 동안 스스로 정한다 */
  draggingId?: string;
  /**
   * 끌어다 놓기 (SHELL-06). 주면 행을 끌 수 있다. 위·아래 가장자리는 그 행의 앞·뒤, 가운데는 안쪽.
   * canDrop이 false면 그 자리에 선을 그리지 않고 놓을 수 없다
   */
  onDrop?: (id: string, targetId: string, position: DropPosition) => void;
  canDrop?: (id: string, targetId: string, position: DropPosition) => boolean;
  /** 놓을 자리 표시를 고정해서 보인다(Debug·스토리용) */
  dropTarget?: { id: string; position: DropPosition };
  /** 트리 이름 */
  label?: string;
  className?: string;
};

/**
 * SH-PageTree — 중첩 페이지 트리 (프로토타입 `.tree-row`, WAI-ARIA tree 패턴).
 * 트리 안에서는 행 하나만 Tab 순서에 있다. ↑↓ 이동, → 펼치기·첫 하위로, ← 접기·상위로,
 * Home/End, 글자로 행 찾기(한글 초성 포함), Enter·Space 열기, Shift+F10 행 메뉴. ··· ＋ 버튼은 마우스용이다(같은 일을 메뉴에서 한다).
 * 폴더 행(kind=folder)은 열지 않는다: 누르거나 Enter·Space면 펼치고 접는다(Obsidian 방식, SHELL-14).
 *
 * 가상화(SYS-10, ADR-021): 펼쳐진 행만 평평한 목록으로 펴서, 보이는 구간과 포커스·끄는 행만 그린다.
 * 스크롤 영역은 가장 가까운 ScrollArea 뷰포트(없으면 이 트리 자신)다.
 */
const PageTree = React.memo(function PageTree({
  pages,
  activeId,
  expanded,
  onExpandedChange,
  onOpen,
  onAddChild,
  addMenu,
  rowMenu,
  draggingId: draggingProp,
  onDrop,
  canDrop = () => true,
  dropTarget: dropProp,
  label = "페이지 목록",
  className,
}: PageTreeProps) {
  const open = React.useMemo(() => new Set(expanded), [expanded]);
  const rows = React.useMemo(() => flattenRows(pages, open), [pages, open]);
  const baseId = React.useId();
  const rowId = (id: string) => `${baseId}-${id}`;
  const indexById = React.useMemo(() => new Map(rows.map((r, i) => [r.node.id, i])), [rows]);
  const [focusId, setFocusId] = React.useState<string>();
  const [menuId, setMenuId] = React.useState<string>();
  const [addId, setAddId] = React.useState<string>();
  const [drag, setDrag] = React.useState<string>();
  const [over, setOver] = React.useState<{ id: string; position: DropPosition }>();
  const expandTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const draggingId = draggingProp ?? drag;
  const dropTarget = dropProp ?? over;
  const dragRef = React.useRef<string>(undefined);

  // 스크롤 영역과 보이는 구간 (SYS-10)
  const rootRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLElement | null>(null);
  const [view, setView] = React.useState({ top: 0, height: 0, offset: 0 });
  const [, setFocusTick] = React.useState(0);
  const pendingFocus = React.useRef<string>(undefined);
  const pointerY = React.useRef<number>(undefined);
  const scrollFrame = React.useRef<number>(undefined);

  /** 트리 맨 위가 스크롤 내용의 어디쯤인지 (스크롤 영역이 트리 자신이면 0) */
  const treeOffset = (scroller: HTMLElement, root: HTMLElement) =>
    scroller === root
      ? 0
      : root.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;

  const measure = React.useCallback(() => {
    const root = rootRef.current;
    const scroller = scrollerRef.current;
    if (!root || !scroller) return;
    const next = {
      top: scroller.scrollTop,
      height: scroller.clientHeight,
      offset: treeOffset(scroller, root),
    };
    setView((prev) =>
      prev.top === next.top && prev.height === next.height && prev.offset === next.offset
        ? prev
        : next,
    );
  }, []);

  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scroller = (root.closest(SCROLL_VIEWPORT_SLOT) as HTMLElement | null) ?? root;
    scrollerRef.current = scroller;
    scroller.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    if (scroller !== root) observer.observe(root);
    measure();
    return () => {
      scroller.removeEventListener("scroll", measure);
      observer.disconnect();
      scrollerRef.current = null;
    };
  }, [measure]);

  // 행이 늘거나 줄거나 위쪽 섹션 높이가 바뀌면 보이는 구간을 다시 잰다
  React.useLayoutEffect(() => {
    measure();
  });

  /** 행 하나가 스크롤 영역 안에 보이도록 최소한으로 스크롤한다 */
  const revealIndex = (index: number) => {
    const root = rootRef.current;
    const scroller = scrollerRef.current;
    if (!root || !scroller || index < 0 || !scroller.clientHeight) return;
    const top = treeOffset(scroller, root) + index * ROW_HEIGHT;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (top + ROW_HEIGHT > scroller.scrollTop + scroller.clientHeight)
      scroller.scrollTop = top + ROW_HEIGHT - scroller.clientHeight;
  };

  // Tab으로 들어올 행: 마지막으로 포커스한 행 → 열린 페이지 → 첫 행
  const tabbable =
    (focusId !== undefined && indexById.has(focusId) ? focusId : undefined) ??
    (activeId !== undefined && indexById.has(activeId) ? activeId : undefined) ??
    rows[0]?.node.id;
  const tabbableIndex = tabbable !== undefined ? (indexById.get(tabbable) ?? -1) : -1;
  const dragIndex = draggingId !== undefined ? (indexById.get(draggingId) ?? -1) : -1;
  const focusIndex = focusId !== undefined ? (indexById.get(focusId) ?? -1) : -1;

  // 보이는 구간 + 포커스·Tab·끄는 행은 구간 밖이어도 그린다(포커스가 사라지지 않게)
  const viewTop = view.top - view.offset;
  const { first, last } = windowRange(viewTop, view.height, rows.length);
  const indices: number[] = [];
  for (let i = first; i < last; i++) indices.push(i);
  for (const i of [focusIndex, tabbableIndex, dragIndex]) {
    if (i >= 0 && (i < first || i >= last) && !indices.includes(i)) indices.push(i);
  }

  /** 행 위 포인터 높이 → 놓을 자리. 위·아래 1/4은 앞·뒤, 가운데는 안쪽. 놓을 수 없으면 undefined */
  const dropSpot = (
    e: React.DragEvent<HTMLElement>,
    node: PageNode,
    isOpen: boolean,
  ): { id: string; position: DropPosition } | undefined => {
    const dragId = dragRef.current;
    if (!dragId) return; // 다른 곳에서 끌어온 것(파일 등)은 받지 않는다
    const rect = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    let id = node.id;
    let position: DropPosition = y < 0.25 ? "before" : y > 0.75 ? "after" : "inside";
    // 안쪽에 못 넣으면 가까운 가장자리로
    if (position === "inside" && !canDrop(dragId, node.id, "inside"))
      position = y < 0.5 ? "before" : "after";
    // 펼친 행의 아래쪽은 "뒤"가 아니라 첫 하위의 앞이다(선이 그 자리에 보이게)
    if (position === "after" && isOpen && node.children?.length) {
      id = node.children[0]!.id;
      position = "before";
    }
    return canDrop(dragId, id, position) ? { id, position } : undefined;
  };

  /** 드래그 중 포인터가 가장자리에 있으면 그쪽으로 스크롤한다 */
  const stopAutoScroll = () => {
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = undefined;
  };
  const startAutoScroll = () => {
    if (scrollFrame.current !== undefined) return;
    const tick = () => {
      const scroller = scrollerRef.current;
      const y = pointerY.current;
      if (scroller && y !== undefined && dragRef.current) {
        const rect = scroller.getBoundingClientRect();
        const fromTop = y - rect.top;
        const fromBottom = rect.bottom - y;
        const near = (d: number) =>
          Math.ceil(((AUTO_SCROLL_EDGE - d) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_STEP);
        if (fromTop >= 0 && fromTop < AUTO_SCROLL_EDGE) scroller.scrollTop -= near(fromTop);
        else if (fromBottom >= 0 && fromBottom < AUTO_SCROLL_EDGE)
          scroller.scrollTop += near(fromBottom);
      }
      scrollFrame.current = requestAnimationFrame(tick);
    };
    scrollFrame.current = requestAnimationFrame(tick);
  };
  React.useEffect(() => stopAutoScroll, []);

  const endDrag = () => {
    dragRef.current = undefined;
    pointerY.current = undefined;
    stopAutoScroll();
    clearTimeout(expandTimer.current);
    setDrag(undefined);
    setOver(undefined);
  };

  const focusRow = (id: string) => {
    const index = indexById.get(id);
    if (index === undefined) return;
    revealIndex(index);
    setFocusId(id);
    // 행이 그려진 뒤에 포커스를 준다 (구간 밖에서 온 행은 이 렌더에서 만들어진다)
    pendingFocus.current = id;
    setFocusTick((t) => t + 1);
  };
  React.useLayoutEffect(() => {
    const id = pendingFocus.current;
    if (id === undefined) return;
    pendingFocus.current = undefined;
    document.getElementById(rowId(id))?.focus({ preventScroll: true });
  });

  // 활성 페이지가 바뀌면 그 행이 보이게 한다 (포커스는 옮기지 않는다)
  React.useLayoutEffect(() => {
    if (activeId === undefined) return;
    revealIndex(indexById.get(activeId) ?? -1);
    // 목록 모양이 바뀔 때마다가 아니라 활성 페이지가 바뀔 때만 따라간다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const setOpen = (id: string, value: boolean) =>
    onExpandedChange(value ? [...expanded, id] : expanded.filter((x) => x !== id));

  // 글자로 행 찾기(타입어헤드): 0.5초 안에 친 글자를 이어 붙여 제목 앞부분과 맞춘다. 한글은 초성으로도
  const typed = React.useRef({ text: "", at: 0 });
  const typeahead = (key: string, from: number) => {
    const now = performance.now();
    const prev = now - typed.current.at < TYPEAHEAD_MS ? typed.current.text : "";
    const text = (prev + key).toLowerCase();
    typed.current = { text, at: now };
    // 같은 글자를 거듭 치면 그 글자로 시작하는 다음 행으로 돈다
    const repeat = text.length > 1 && [...text].every((c) => c === text[0]);
    const query = repeat ? text[0]! : text;
    const start = repeat || text.length === 1 ? from + 1 : from;
    for (let i = 0; i < rows.length; i++) {
      const v = rows[(start + i) % rows.length]!;
      if (startsWithTyped(v.node.title || "제목 없음", query)) return focusRow(v.node.id);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute("role") !== "treeitem") return;
    const index = indexById.get(target.dataset.nodeId ?? "");
    if (index === undefined) return;
    const { node, parentId, hasKids, isOpen } = rows[index]!;
    const go = (i: number) => rows[i] && focusRow(rows[i].node.id);
    switch (e.key) {
      case "ArrowDown":
        go(index + 1);
        break;
      case "ArrowUp":
        go(index - 1);
        break;
      case "Home":
        go(0);
        break;
      case "End":
        go(rows.length - 1);
        break;
      case "ArrowRight":
        if (hasKids && !isOpen) setOpen(node.id, true);
        else if (hasKids) go(index + 1);
        break;
      case "ArrowLeft":
        if (hasKids && isOpen) setOpen(node.id, false);
        else if (parentId) focusRow(parentId);
        break;
      case "Enter":
      case " ":
        if (node.kind === "folder") {
          if (hasKids) setOpen(node.id, !isOpen);
        } else onOpen(node.id, { newTab: e.metaKey || e.ctrlKey });
        break;
      case "F10":
        if (!e.shiftKey || !rowMenu) return;
        setMenuId(node.id);
        break;
      case "ContextMenu":
        if (!rowMenu) return;
        setMenuId(node.id);
        break;
      default:
        if (e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey) {
          typeahead(e.key, index);
          break;
        }
        return;
    }
    e.preventDefault();
  };

  /**
   * 한 행. 깊이는 왼쪽 들여쓰기로 보이고, 접근성 구조는 aria-level로 평평하게 둔다.
   * 구조가 평평해 브라우저가 형제 수를 셀 수 없으니 aria-setsize·aria-posinset을 직접 준다.
   */
  const renderRow = (row: FlatRow, index: number) => {
    const { node, level, hasKids, isOpen } = row;
    const folder = node.kind === "folder";
    const active = !folder && node.id === activeId;
    const titleId = `${rowId(node.id)}-title`;
    const indent = space(INDENT_UNITS * (level - 1));
    return (
      <div
        key={node.id}
        id={rowId(node.id)}
        data-node-id={node.id}
        role="treeitem"
        aria-level={level}
        aria-setsize={row.setSize}
        aria-posinset={row.posInSet}
        aria-expanded={hasKids ? isOpen : undefined}
        aria-selected={active}
        aria-labelledby={titleId}
        tabIndex={node.id === tabbable ? 0 : -1}
        data-active={active || undefined}
        data-kind={node.kind ?? "page"}
        data-drag={node.id === draggingId || undefined}
        draggable={onDrop ? true : undefined}
        style={{
          top: index * ROW_HEIGHT,
          height: ROW_HEIGHT,
          left: indent,
          width: `calc(100% - ${indent})`,
        }}
        onDragStart={
          onDrop
            ? (e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = "move";
                // WebKit은 데이터가 없으면 끌기를 시작하지 않는다
                e.dataTransfer.setData("text/plain", node.title || "제목 없음");
                setMenuId(undefined);
                setAddId(undefined);
                dragRef.current = node.id;
                setDrag(node.id);
                startAutoScroll();
              }
            : undefined
        }
        onDragOver={
          onDrop
            ? (e) => {
                const spot = dropSpot(e, node, isOpen);
                if (!spot) {
                  if (over) setOver(undefined);
                  return;
                }
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over?.id !== spot.id || over.position !== spot.position) {
                  setOver(spot);
                  clearTimeout(expandTimer.current);
                  // 접힌 행 안쪽에 잠깐 머물면 펼친다
                  if (spot.position === "inside" && hasKids && !isOpen)
                    expandTimer.current = setTimeout(() => setOpen(node.id, true), 600);
                }
              }
            : undefined
        }
        onDrop={
          onDrop
            ? (e) => {
                e.preventDefault();
                // 화면에 그린 표시가 아니라 놓은 그 자리로 정한다(빨리 놓으면 표시가 한 박자 늦다)
                const spot = dropSpot(e, node, isOpen);
                if (dragRef.current && spot) onDrop(dragRef.current, spot.id, spot.position);
                endDrag();
              }
            : undefined
        }
        onDragEnd={onDrop ? endDrag : undefined}
        onFocus={() => setFocusId(node.id)}
        // 우클릭은 ··· 메뉴와 같은 행 메뉴를 연다 (SHELL-18)
        onContextMenu={
          rowMenu
            ? (e) => {
                e.preventDefault();
                setMenuId(node.id);
              }
            : undefined
        }
        onClick={(e) =>
          folder
            ? hasKids && setOpen(node.id, !isOpen)
            : onOpen(node.id, { newTab: e.metaKey || e.ctrlKey })
        }
        className={cn(
          "absolute",
          rowBase,
          rowActive,
          "group/row gap-0.5 data-drag:opacity-50",
          insetFocus,
        )}
      >
        {dropTarget?.id === node.id ? <DropIndicator position={dropTarget.position} /> : null}
        <span
          aria-hidden
          data-open={isOpen || undefined}
          onClick={(e) => {
            if (!hasKids) return;
            e.stopPropagation();
            setOpen(node.id, !isOpen);
          }}
          className={cn(
            // 배경 없이 색만 바꾼다(프로토타입 .tree-twist). 배경을 두면 펼칠 때 90° 돌면서 행 밖으로 삐져나와 겹쳐 보였다
            "grid h-6 w-5 shrink-0 place-items-center text-tertiary transition-[opacity,transform,color] duration-(--dur-fast) hover:text-primary force-hover:text-primary",
            // 하위 항목이 있으면 늘 보인다(사용자 요청). 없으면 자리만 둔다
            "data-open:rotate-90",
            !hasKids && "invisible",
          )}
        >
          <ChevronRight strokeWidth={1.5} className="size-3.5" />
        </span>
        <span className="flex min-h-7.5 min-w-0 flex-1 items-center gap-2 pr-1">
          {folder ? (
            isOpen ? (
              <FolderOpen
                strokeWidth={1.5}
                aria-hidden
                className="size-3.5 shrink-0 text-tertiary"
              />
            ) : (
              <Folder strokeWidth={1.5} aria-hidden className="size-3.5 shrink-0 text-tertiary" />
            )
          ) : node.kind === "collection" && !node.emoji ? (
            <Table2 strokeWidth={1.5} aria-hidden className="size-3.5 shrink-0 text-tertiary" />
          ) : node.emoji ? (
            <span aria-hidden className="w-4.5 shrink-0 text-center text-ui leading-none">
              <PageIcon icon={node.emoji} />
            </span>
          ) : (
            <FileText strokeWidth={1.5} aria-hidden className="size-3.5 shrink-0 text-tertiary" />
          )}
          <span
            id={titleId}
            title={node.title || undefined}
            className={cn("min-w-0 flex-1 truncate", !node.title && "text-tertiary")}
          >
            {node.title ||
              (folder
                ? "이름 없는 폴더"
                : node.kind === "collection"
                  ? "이름 없는 컬렉션"
                  : "제목 없음")}
          </span>
        </span>
        {rowMenu || onAddChild || addMenu ? (
          <span
            className={cn(
              "flex shrink-0 items-center pr-1",
              revealOnRow,
              (menuId === node.id || addId === node.id) && "opacity-100",
            )}
          >
            {rowMenu ? (
              <DropdownMenu
                open={menuId === node.id}
                onOpenChange={(o) => setMenuId(o ? node.id : undefined)}
              >
                <DropdownMenuTrigger asChild>
                  <IconButton
                    label={`${node.title || "제목 없음"} 더보기`}
                    noTooltip
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                    className="[&_svg]:size-3.5"
                  >
                    <Ellipsis strokeWidth={1.5} />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  onClick={(e) => e.stopPropagation()}
                  // 닫히면 행으로 돌아가 트리 키보드 이동을 이어 간다
                  onCloseAutoFocus={(e) => {
                    // 항목이 새 화면에 포커스를 줬으면 그대로 둔다
                    keepMovedFocus(e);
                    if (e.defaultPrevented) return;
                    e.preventDefault();
                    document.getElementById(rowId(node.id))?.focus();
                  }}
                >
                  {rowMenu(node)}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {addMenu ? (
              <DropdownMenu
                open={addId === node.id}
                onOpenChange={(o) => setAddId(o ? node.id : undefined)}
              >
                <DropdownMenuTrigger asChild>
                  <IconButton
                    label={`${node.title || (folder ? "이름 없는 폴더" : "제목 없음")}에 추가`}
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                    className="[&_svg]:size-3.5"
                  >
                    <Plus strokeWidth={1.5} />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  onClick={(e) => e.stopPropagation()}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {addMenu(node)}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : onAddChild ? (
              <IconButton
                label={
                  folder
                    ? `${node.title || "이름 없는 폴더"}에 페이지 추가`
                    : `${node.title || "제목 없음"} 하위 페이지 추가`
                }
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild(node.id);
                }}
                className="[&_svg]:size-3.5"
              >
                <Plus strokeWidth={1.5} />
              </IconButton>
            ) : null}
          </span>
        ) : null}
      </div>
    );
  };

  // 계층 안내선: 각 행마다 조상 단계만큼 왼쪽에 그린다. 행이 붙어 있어 선이 이어 보인다
  const guides = indices.flatMap((i) => {
    const { node, level } = rows[i]!;
    return Array.from({ length: level - 1 }, (_, k) => (
      <span
        key={`guide-${node.id}-${k}`}
        aria-hidden
        style={{
          top: i * ROW_HEIGHT,
          height: ROW_HEIGHT,
          left: space(GUIDE_UNITS + INDENT_UNITS * k),
        }}
        // 다크에서는 --border-subtle이 사이드바 바탕과 거의 같아(1.4:1) 한 단계 진한 선을 쓴다
        className="pointer-events-none absolute w-0 border-l border-line dark:border-line-strong"
      />
    ));
  });

  return (
    <div
      ref={rootRef}
      role="tree"
      aria-label={label}
      data-slot="page-tree"
      onKeyDown={onKeyDown}
      onDragOver={
        onDrop
          ? (e) => {
              if (dragRef.current) pointerY.current = e.clientY;
            }
          : undefined
      }
      onDragLeave={(e) => {
        // 트리 밖으로 나가면 표시를 지운다(행 사이를 오갈 때는 그대로)
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(undefined);
      }}
      className={cn("relative overflow-y-auto overscroll-contain", className)}
    >
      <div role="none" className="relative" style={{ height: rows.length * ROW_HEIGHT }}>
        {guides}
        {indices.map((i) => renderRow(rows[i]!, i))}
      </div>
    </div>
  );
});

export { PageTree, type PageTreeProps };
