import { ChevronDown, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import * as React from "react";
import { insetFocus } from "./parts";

type SidebarSectionProps = Omit<React.ComponentProps<"section">, "title"> & {
  title: string;
  /** 제목 없이 묶기만 한다 (빠른 액션) */
  untitled?: boolean;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /**
   * 제목 오른쪽 ＋ 같은 버튼 — 마우스를 올리거나 키보드로 오면 보인다.
   * `menu`를 주면 누를 때 바로 실행하지 않고 메뉴(OV-Menu 항목들)를 연다.
   */
  action?: {
    label: string;
    icon: LucideIcon;
    onClick?: () => void;
    menu?: React.ReactNode;
    /** hover 없이도 늘 보인다 (페이지 섹션의 ＋) */
    alwaysVisible?: boolean;
  };
};

/** 추가 버튼: 평소 숨김, 제목 줄에 마우스·포커스가 오거나 메뉴가 열려 있으면 보인다 */
const actionClass =
  "size-6 text-tertiary opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100 data-[state=open]:bg-active data-[state=open]:opacity-100 force-hover:opacity-100 [&_svg]:size-3.5";

/**
 * SH-SidebarSection — 작은 라벨 제목 + 접기 (프로토타입 `.section`).
 * 제목을 누르면 접히고, 접기 화살표와 추가 버튼은 마우스를 올리거나 키보드로 오면 보인다.
 */
function SidebarSection({
  title,
  untitled,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  action,
  className,
  children,
  ...props
}: SidebarSectionProps) {
  const [inner, setInner] = React.useState(defaultCollapsed);
  const collapsed = collapsedProp ?? inner;
  const bodyId = React.useId();
  const toggle = () => {
    setInner(!collapsed);
    onCollapsedChange?.(!collapsed);
  };

  if (untitled) {
    return (
      <nav
        aria-label={title}
        data-slot="sidebar-section"
        className={cn("mt-6 grid grid-cols-1 gap-0.5 first:mt-2", className)}
      >
        {children}
      </nav>
    );
  }

  const Action = action?.icon;
  return (
    <section
      aria-label={title}
      data-slot="sidebar-section"
      data-collapsed={collapsed}
      className={cn("mt-6 first:mt-2", className)}
      {...props}
    >
      {/* 오른쪽 여백 6px: 22px 버튼의 가운데를 트리 행의 26px 버튼(행 pr-1)과 같은 세로선에 맞춘다 */}
      <div className="group/head flex items-center gap-1 pr-1.5 pb-1 pl-2">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={toggle}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1 rounded-xs py-1 text-left text-label font-semibold tracking-(--tracking-label) text-tertiary uppercase",
            insetFocus,
          )}
        >
          <ChevronDown
            strokeWidth={1.5}
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 opacity-0 transition-[opacity,transform] duration-(--dur-fast)",
              "group-focus-within/head:opacity-100 group-hover/head:opacity-100 force-hover:opacity-100",
              collapsed && "-rotate-90",
            )}
          />
          <span className="truncate">{title}</span>
        </button>
        {action && Action ? (
          action.menu ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <IconButton
                      label={action.label}
                      noTooltip
                      className={cn(actionClass, action.alwaysVisible && "opacity-100")}
                    >
                      <Action strokeWidth={1.5} />
                    </IconButton>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{action.label}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start">{action.menu}</DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <IconButton
              label={action.label}
              onClick={action.onClick}
              className={cn(actionClass, action.alwaysVisible && "opacity-100")}
            >
              <Action strokeWidth={1.5} />
            </IconButton>
          )
        ) : null}
      </div>
      <div id={bodyId} hidden={collapsed} className="grid grid-cols-1 gap-0.5">
        {children}
      </div>
    </section>
  );
}

export { SidebarSection, type SidebarSectionProps };
