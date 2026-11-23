import type { LucideIcon } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type * as React from "react";
import { insetFocus, revealOnRow, rowActive, rowBase } from "./parts";
import { PageIcon } from "@/components/ui/page-icon";

type SidebarItemProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** lucide 아이콘. emoji를 주면 emoji가 우선이다 */
  icon?: LucideIcon;
  /** 페이지 아이콘(이모지) */
  emoji?: string;
  label: string;
  /** 마우스를 올리거나 키보드로 오면 보이는 단축키. 예: ["⌘", "K"] */
  shortcut?: string[];
  /** 오른쪽 개수 (휴지통, 태그) */
  count?: number;
  /** 지금 보고 있는 화면 */
  active?: boolean;
  /** 오른쪽 끝에 붙는 요소 (포인트 색 칩 등) */
  trailing?: React.ReactNode;
};

/**
 * SH-SidebarItem — 사이드바 한 줄(프로토타입 `.nav-item`, 높이 30).
 * 페이지 트리의 행은 같은 모양을 SH-PageTree가 treeitem으로 그린다.
 */
function SidebarItem({
  icon: Icon,
  emoji,
  label,
  shortcut,
  count,
  active,
  trailing,
  className,
  type = "button",
  ...props
}: SidebarItemProps) {
  return (
    <button
      type={type}
      data-slot="sidebar-item"
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        rowBase,
        rowActive,
        "group/row min-h-7.5 gap-2 px-2 py-1 disabled:pointer-events-none disabled:opacity-40",
        insetFocus,
        className,
      )}
      {...props}
    >
      {emoji ? (
        <span aria-hidden className="w-4.5 shrink-0 text-center text-ui leading-none">
          <PageIcon icon={emoji} />
        </span>
      ) : Icon ? (
        <Icon strokeWidth={1.5} aria-hidden className="size-4 shrink-0" />
      ) : null}
      <span title={label} className="min-w-0 flex-1 truncate">
        {label}
      </span>
      {shortcut ? <Kbd keys={shortcut} aria-hidden className={revealOnRow} /> : null}
      {count !== undefined ? (
        <span className="shrink-0 text-label text-tertiary tabular-nums">{count}</span>
      ) : null}
      {trailing}
    </button>
  );
}

export { SidebarItem, type SidebarItemProps };
