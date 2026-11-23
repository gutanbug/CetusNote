import {
  ArrowLeftRight,
  Ellipsis,
  Focus,
  PanelLeft,
  PanelRightDashed,
  Star,
  TableOfContents,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type * as React from "react";

/** 오른쪽 패널(SHELL-19) 머리의 제목 줄. 경로·편집 시각·즐겨찾기는 쓰지 않는다 */
type PaneHeading = {
  /** 페이지 아이콘 (이모지 등). 없으면 비워 둔다 */
  icon?: React.ReactNode;
  /** 페이지 제목. 길면 줄여서 보이고 전체는 툴팁·title로 본다 */
  title: string;
  /** 제목을 누르면 이 페이지를 주 화면에서 연다 */
  onOpenMain: () => void;
  /** 왼쪽(주 화면)과 페이지를 바꾼다 */
  onSwap: () => void;
  /** 패널을 닫는다 (⌥⌘W) */
  onClose: () => void;
};

type TopBarProps = {
  /**
   * `page`(기본): 주 화면의 페이지 상단 바. `pane`: 오른쪽 패널 머리 한 줄 — `pane`을 함께 준다.
   * 같은 높이·토큰을 쓰고, 제목 줄 · 목차 · 페이지 메뉴 · 바꾸기 · 닫기만 보인다.
   */
  variant?: "page" | "pane";
  pane?: PaneHeading;
  /** 창이 좁아 오른쪽 패널이 숨었을 때 보이는 자리 표시 (SHELL-19). 누르면 설명을 띄운다 */
  paneHidden?: { label: string; onClick: () => void };
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
  /**
   * 오른쪽 패널이 열린 상태에서 이 쪽이 활성이 아니면 true (SHELL-19). 제목·아이콘을 text-tertiary로 낮춘다.
   * 색만 바꾸고 자리·테두리는 그대로다. 페이지 경로(SH-Breadcrumb)에도 같은 값을 넘긴다.
   */
  dimmed?: boolean;
  className?: string;
};

/**
 * SH-TopBar — 사이드바 토글 · 경로 · 편집 시각 · 페이지 액션 (프로토타입 `.topbar`, 높이 44).
 * `variant="pane"`이면 오른쪽 패널의 머리 한 줄(높이 같음): 제목(누르면 주 화면에서 연다) · 목차 · 페이지 메뉴 · 바꾸기 · 닫기.
 * 버튼은 콜백을 준 것만 보인다.
 */
function TopBar({
  variant = "page",
  pane: paneProp,
  paneHidden,
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
  dimmed,
  className,
}: TopBarProps) {
  const pane = variant === "pane" ? paneProp : undefined;
  // 버튼 색: 비활성 쪽은 text-tertiary, hover·focus 강제 variant는 IconButton 쪽 그대로 둔다
  const tone = cn(
    "transition-colors duration-(--dur-fast) ease-(--ease)",
    dimmed && "text-tertiary",
  );
  // 패널 머리는 페이지 상단 바(banner)가 아니라 영역이라 div로 둔다 — 문서에 banner는 하나
  const Root = pane ? "div" : "header";
  return (
    <Root
      data-slot="top-bar"
      data-variant={pane ? "pane" : undefined}
      data-scrolled={scrolled || undefined}
      data-tauri-drag-region={titleBar ? "" : undefined}
      className={cn(
        "flex h-(--topbar-h) min-w-0 items-center gap-2 border-b border-transparent px-3 transition-[border-color,padding] duration-(--dur) data-scrolled:border-line",
        titleBar === "inset" && "pl-20",
        className,
      )}
    >
      {pane ? (
        <button
          type="button"
          title={`${pane.title || "제목 없음"} · 주 화면에서 열기`}
          aria-label={`${pane.title || "제목 없음"} · 주 화면에서 열기`}
          onClick={pane.onOpenMain}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1.5 py-1 text-left text-ui transition-colors duration-(--dur-fast) ease-(--ease)",
            dimmed ? "text-tertiary" : "text-primary",
            "outline-none hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid force-hover:bg-hover",
          )}
        >
          {pane.icon ? (
            <span aria-hidden className="flex w-4 shrink-0 items-center justify-center">
              {pane.icon}
            </span>
          ) : null}
          <span className="min-w-0 truncate">{pane.title || "제목 없음"}</span>
        </button>
      ) : (
        <>
          {onToggleSidebar ? (
            <IconButton
              label="사이드바"
              shortcut={<Kbd keys={["⌘", "\\"]} />}
              aria-expanded={sidebarOpen}
              className={tone}
              onClick={onToggleSidebar}
            >
              <PanelLeft strokeWidth={1.5} />
            </IconButton>
          ) : null}
          {breadcrumb ?? <span className="flex-1" />}
        </>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {paneHidden ? (
          <IconButton label={paneHidden.label} className={tone} onClick={paneHidden.onClick}>
            <PanelRightDashed strokeWidth={1.5} />
          </IconButton>
        ) : null}
        {!pane && editedAt ? (
          <span className="pr-1 text-label whitespace-nowrap text-tertiary">{editedAt}</span>
        ) : null}
        {outline ? (
          <DropdownMenu open={outlineOpen} onOpenChange={onOutlineOpenChange}>
            <DropdownMenuTrigger asChild>
              <IconButton label="목차" className={tone} shortcut={<Kbd keys={["⌥", "⌘", "O"]} />}>
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
        {!pane && onToggleFavorite ? (
          <IconButton
            label="즐겨찾기"
            className={tone}
            aria-pressed={!!favorite}
            onClick={onToggleFavorite}
          >
            <Star strokeWidth={1.5} className={cn(favorite && "fill-current")} />
          </IconButton>
        ) : null}
        {!pane && onFocusMode ? (
          <IconButton
            label="집중 모드"
            className={tone}
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
              <IconButton label="페이지 메뉴" className={tone}>
                <Ellipsis strokeWidth={1.5} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">{pageMenu}</DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {pane ? (
          <>
            <IconButton label="주 화면과 바꾸기" className={tone} onClick={pane.onSwap}>
              <ArrowLeftRight strokeWidth={1.5} />
            </IconButton>
            <IconButton
              label="패널 닫기"
              className={tone}
              shortcut={<Kbd keys={["⌥", "⌘", "W"]} />}
              onClick={pane.onClose}
            >
              <X strokeWidth={1.5} />
            </IconButton>
          </>
        ) : null}
      </div>
    </Root>
  );
}

export { TopBar, type TopBarProps, type PaneHeading };
