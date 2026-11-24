import { Ellipsis, Focus, PanelLeft, Star, TableOfContents } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type * as React from "react";

type TopBarProps = {
  /** 가운데 경로 (SH-Breadcrumb) */
  breadcrumb?: React.ReactNode;
  /** 마지막 편집 시각 문구. 예: "3분 전 편집" */
  editedAt?: string;
  /** 본문이 위로 밀리면 아래 구분선을 보인다 */
  scrolled?: boolean;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  onFocusMode?: () => void;
  /** 집중 모드가 켜져 있으면 버튼이 눌린 상태(accent)로 보인다 */
  focusMode?: boolean;
  /**
   * macOS 오버레이 타이틀바(SYS-05). `drag`: 빈 곳을 끌면 창이 움직인다.
   * `inset`: 여기에 더해 왼쪽에 신호등 버튼 자리를 비운다(사이드바가 숨었을 때).
   */
  titleBar?: "drag" | "inset";
  /** 목차 메뉴 내용 (OV-Outline). 주면 목차 버튼이 보인다 */
  outline?: React.ReactNode;
  /** 목차 메뉴 열림 (⌥⌘O로 열 수 있게 부르는 쪽이 쥔다) */
  outlineOpen?: boolean;
  onOutlineOpenChange?: (open: boolean) => void;
  /** 목차 메뉴가 닫히며 포커스를 돌려줄 때. 제목으로 갔으면 preventDefault 하고 본문에 포커스를 준다 */
  onOutlineCloseAutoFocus?: (e: Event) => void;
  /** 페이지 메뉴 항목 (OV-Menu 항목들) */
  pageMenu?: React.ReactNode;
  className?: string;
};

/**
 * SH-TopBar — 사이드바 토글 · 경로 · 편집 시각 · 페이지 액션 (프로토타입 `.topbar`, 높이 44).
 * 버튼은 콜백을 준 것만 보인다.
 */
function TopBar({
  breadcrumb,
  editedAt,
  scrolled,
  sidebarOpen = true,
  onToggleSidebar,
  favorite,
  onToggleFavorite,
  onFocusMode,
  focusMode,
  pageMenu,
  outline,
  outlineOpen,
  onOutlineOpenChange,
  onOutlineCloseAutoFocus,
  titleBar,
  className,
}: TopBarProps) {
  return (
    <header
      data-slot="top-bar"
      data-scrolled={scrolled || undefined}
      data-tauri-drag-region={titleBar ? "" : undefined}
      className={cn(
        "flex h-(--topbar-h) min-w-0 items-center gap-2 border-b border-transparent px-3 transition-[border-color,padding] duration-(--dur) data-scrolled:border-line",
        titleBar === "inset" && "pl-20",
        className,
      )}
    >
      {onToggleSidebar ? (
        <IconButton
          label="사이드바"
          shortcut={<Kbd keys={["⌘", "\\"]} />}
          aria-expanded={sidebarOpen}
          onClick={onToggleSidebar}
        >
          <PanelLeft strokeWidth={1.5} />
        </IconButton>
      ) : null}
      {breadcrumb ?? <span className="flex-1" />}
      <div className="flex shrink-0 items-center gap-1">
        {editedAt ? (
          <span className="pr-1 text-label whitespace-nowrap text-tertiary">{editedAt}</span>
        ) : null}
        {outline ? (
          <DropdownMenu open={outlineOpen} onOpenChange={onOutlineOpenChange}>
            <DropdownMenuTrigger asChild>
              <IconButton label="목차" shortcut={<Kbd keys={["⌥", "⌘", "O"]} />}>
                <TableOfContents strokeWidth={1.5} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={onOutlineCloseAutoFocus}
              className="max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto"
            >
              {outline}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {onToggleFavorite ? (
          <IconButton label="즐겨찾기" aria-pressed={!!favorite} onClick={onToggleFavorite}>
            <Star strokeWidth={1.5} className={cn(favorite && "fill-current")} />
          </IconButton>
        ) : null}
        {onFocusMode ? (
          <IconButton
            label="집중 모드"
            shortcut={<Kbd keys={["⌘", "."]} />}
            aria-pressed={!!focusMode}
            onClick={onFocusMode}
          >
            <Focus strokeWidth={1.5} />
          </IconButton>
        ) : null}
        {pageMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="페이지 메뉴">
                <Ellipsis strokeWidth={1.5} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">{pageMenu}</DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}

export { TopBar, type TopBarProps };
