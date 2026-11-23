import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { FileText, Hash, House, Plus, X } from "lucide-react";
import * as React from "react";
import { insetFocus } from "./parts";
import { PageIcon } from "@/components/ui/page-icon";

export type PageTabItem = {
  key: string;
  title: string;
  /** 페이지 아이콘(이모지). 없으면 종류별 아이콘 */
  emoji?: string | null;
  kind: "page" | "home" | "tag";
};

type PageTabsProps = {
  items: PageTabItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: (index: number) => void;
  /** 새 탭 (⌘T) */
  onAdd: () => void;
  /** macOS 오버레이 타이틀바 (SYS-05): 빈 곳을 끌면 창이 움직인다. inset이면 신호등 자리를 비운다 */
  titleBar?: "drag" | "inset";
  className?: string;
};

const KIND_ICON = { page: FileText, home: House, tag: Hash } as const;

/**
 * SH-PageTabs — 프로토타입 `.tabbar`(§9). 본문 위 한 줄(36px). 선택된 탭은 아래 2px 포인트 밑줄,
 * 닫기 버튼은 hover · 선택에서만 보인다. 키보드: ←→로 옮기고 Enter·Space로 열기, Delete로 닫기.
 * 닫기 버튼은 마우스 전용(탭 목록 안에 다른 버튼을 두지 않는다) — 키보드는 Delete · ⌘W로 닫는다.
 */
function PageTabs({
  items,
  activeIndex,
  onSelect,
  onClose,
  onAdd,
  titleBar,
  className,
}: PageTabsProps) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const tabAt = (i: number) =>
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[i] ?? null;

  // 지금 탭이 보이게
  React.useEffect(() => {
    tabAt(activeIndex)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex, items.length]);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const n = items.length;
    const move = (to: number) => tabAt((to + n) % n)?.focus();
    switch (e.key) {
      case "ArrowRight":
        move(i + 1);
        break;
      case "ArrowLeft":
        move(i - 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(n - 1);
        break;
      case "Delete":
      case "Backspace":
        onClose(i);
        // 닫은 자리(없으면 왼쪽)로 포커스를 옮긴다
        requestAnimationFrame(() => tabAt(Math.min(i, n - 2))?.focus());
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div
      data-slot="page-tabs"
      data-tauri-drag-region={titleBar ? "" : undefined}
      className={cn(
        "flex h-(--tabbar-h) shrink-0 items-stretch border-b border-line bg-app",
        titleBar === "inset" && "pl-20",
        className,
      )}
    >
      <div
        ref={listRef}
        role="tablist"
        aria-label="열린 탭"
        className="flex min-w-0 [scrollbar-width:none] items-stretch overflow-x-auto"
      >
        {items.map((item, i) => {
          const selected = i === activeIndex;
          const Icon = KIND_ICON[item.kind];
          return (
            <div
              key={item.key}
              data-selected={selected || undefined}
              className={cn(
                "group/tab relative flex max-w-45 shrink-0 items-center border-r border-line text-caption text-secondary",
                "transition-colors duration-(--dur-fast) ease-(--ease) hover:bg-hover hover:text-primary force-hover:bg-hover force-hover:text-primary",
                "data-selected:bg-sel data-selected:font-medium data-selected:text-sel-fg",
                // 선택 밑줄 2px (탭 바 아래 테두리를 덮는다)
                "data-selected:after:absolute data-selected:after:inset-x-0 data-selected:after:-bottom-px data-selected:after:h-0.5 data-selected:after:bg-accent data-selected:after:content-['']",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                aria-keyshortcuts="Delete"
                tabIndex={selected ? 0 : -1}
                title={item.title}
                onClick={() => onSelect(i)}
                // 가운데 버튼으로 닫기 (브라우저와 같다)
                onAuxClick={(e) => e.button === 1 && onClose(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "flex h-full min-w-0 flex-1 items-center gap-2 pr-1 pl-3 text-left",
                  insetFocus,
                )}
              >
                {item.emoji ? (
                  <span aria-hidden className="shrink-0 text-caption leading-none">
                    <PageIcon icon={item.emoji} />
                  </span>
                ) : (
                  <Icon strokeWidth={1.5} aria-hidden className="size-3.5 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={() => onClose(i)}
                className={cn(
                  "mr-2 grid size-4.5 shrink-0 place-items-center rounded-pill text-tertiary opacity-0",
                  "transition-[opacity,background-color] duration-(--dur-fast) ease-(--ease) group-hover/tab:opacity-100 group-data-selected/tab:opacity-100 force-hover:opacity-100",
                  "hover:bg-active hover:text-primary force-hover:bg-active",
                )}
              >
                <X strokeWidth={1.5} className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <IconButton
        label="새 탭"
        shortcut={<Kbd keys={["⌘", "T"]} />}
        onClick={onAdd}
        className="my-auto ml-1 shrink-0"
        size="sm"
      >
        <Plus strokeWidth={1.5} />
      </IconButton>
    </div>
  );
}

export { PageTabs, type PageTabsProps };
