import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type * as React from "react";
import { Resizer } from "./resizer";

type SidebarProps = Omit<React.ComponentProps<"aside">, "children"> & {
  /** 위 고정 (SH-WorkspaceSwitcher) */
  header?: React.ReactNode;
  /** 가운데 스크롤 (섹션들) */
  children?: React.ReactNode;
  /** 아래 고정 (SH-SidebarFooter) */
  footer?: React.ReactNode;
  collapsed?: boolean;
  /** 너비(px). onWidthChange를 주면 오른쪽 끝에 SH-Resizer가 붙는다 */
  width?: number;
  onWidthChange?: (width: number) => void;
  onWidthReset?: () => void;
  /**
   * macOS 오버레이 타이틀바(SYS-05): 맨 위에 상단 바 높이만큼 빈 줄을 두어 신호등 버튼 자리를 만든다.
   * 이 줄을 끌면 창이 움직인다(data-tauri-drag-region).
   */
  titleBarInset?: boolean;
};

/**
 * SH-Sidebar — 위(스위처) · 가운데(스크롤) · 아래(하단) 세 칸 틀 (프로토타입 `.sidebar`).
 * 접으면 너비가 0이 되고 안의 요소는 포커스를 받지 않는다(inert).
 */
function Sidebar({
  header,
  children,
  footer,
  collapsed = false,
  width,
  onWidthChange,
  onWidthReset,
  titleBarInset,
  className,
  style,
  ...props
}: SidebarProps) {
  return (
    <aside
      aria-label="사이드바"
      data-slot="sidebar"
      data-collapsed={collapsed || undefined}
      inert={collapsed}
      style={{ ...(width ? { "--sidebar-w": `${width}px` } : {}), ...style } as React.CSSProperties}
      className={cn(
        "relative grid h-full w-(--sidebar-w) shrink-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-r border-line bg-sidebar",
        // 접고 펼칠 때만 움직인다. 너비를 끄는 동안에는 바로 따라간다
        "transition-[width,opacity] duration-(--dur-slow) ease-(--ease) has-data-dragging:transition-none",
        "data-collapsed:w-0 data-collapsed:border-r-0 data-collapsed:opacity-0",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {titleBarInset ? (
          <div data-slot="title-bar-inset" data-tauri-drag-region className="h-(--topbar-h)" />
        ) : null}
        {header}
      </div>
      {/* Radix 스크롤 영역의 안쪽 표(display: table)가 긴 제목만큼 늘어나지 않게 해 말줄임이 되게 한다 */}
      <ScrollArea className="min-h-0 [&_[data-slot=scroll-area-viewport]>div]:block!">
        <div className="px-2 pt-2 pb-6">{children}</div>
      </ScrollArea>
      <div className="min-w-0">{footer}</div>
      {onWidthChange && width && !collapsed ? (
        <Resizer width={width} onWidthChange={onWidthChange} onReset={onWidthReset} />
      ) : null}
    </aside>
  );
}

export { Sidebar, type SidebarProps };
