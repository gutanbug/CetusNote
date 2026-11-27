import { useMessages } from "@/lib/i18n";
import { Check, ChevronsUpDown, FolderOpen, Plus, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type * as React from "react";
import { insetFocus } from "./parts";

type WorkspaceSwitcherProps = {
  /** 워크스페이스(폴더) 이름 */
  name: string;
  /** 메뉴 맨 위 정보 줄 — 로컬 앱이라 계정 대신 폴더 위치·페이지 수 (예: "~/Documents/CetusNote · 페이지 12개") */
  detail?: string;
  /**
   * 워크스페이스 목록 (SHELL-15, AppFlowy 방식) — 주면 맨 위 카드 대신 타일 행 목록이 된다.
   * 지금 열린 것에 체크. 누르면 onSelect
   */
  workspaces?: WorkspaceRow[];
  /** "새 워크스페이스…" 행 */
  onCreate?: () => void;
  /** "다른 폴더 열기…" 행 */
  onOpenFolder?: () => void;
  /** 목록 아래 메뉴 항목 (OV-Menu 항목들) — 설정, Finder에서 보기 … */
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

type WorkspaceRow = {
  /** 고유 키 (폴더 경로) */
  id: string;
  name: string;
  /** 둘째 줄 — 폴더 위치·문서 수 */
  detail?: string;
  current?: boolean;
  onSelect?: () => void;
  /**
   * 최근 목록에서 빼기 (SHELL-16) — 지금 열린 행에는 주지 않는다.
   * 가리키거나 키보드로 고르면 오른쪽에 ×, Delete·Backspace로도 뺀다.
   */
  onRemove?: () => void;
};

/** 메뉴 행의 32px 타일 — 이니셜 또는 아이콘 */
const tile = "inline-grid size-8 shrink-0 place-items-center rounded-md";

function RowText({ name, detail }: { name: string; detail?: string }) {
  return (
    <span className="grid min-w-0">
      <span className="truncate text-ui text-primary">{name}</span>
      {detail ? (
        <span title={detail} className="truncate text-label text-tertiary">
          {detail}
        </span>
      ) : null}
    </span>
  );
}

/** SH-WorkspaceSwitcher — 아바타 + 이름 + 펼침 (프로토타입 `.ws`). 누르면 워크스페이스 메뉴. */
function WorkspaceSwitcher({
  name,
  detail,
  workspaces,
  onCreate,
  onOpenFolder,
  children,
  open,
  onOpenChange,
  className,
}: WorkspaceSwitcherProps) {
  const m = useMessages();
  const ic = { strokeWidth: 1.5, "aria-hidden": true, className: "size-4" } as const;
  return (
    <div className={cn("px-2 pt-2", className)}>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger
          data-slot="workspace-switcher"
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-primary transition-colors duration-(--dur-fast)",
            "hover:bg-hover data-[state=open]:bg-active force-hover:bg-hover",
            insetFocus,
          )}
        >
          <Avatar name={name} aria-hidden />
          <span title={name} className="min-w-0 flex-1 truncate text-ui font-medium">
            <span className="sr-only">{m.shell.workspace.current}</span>
            {name}
          </span>
          <ChevronsUpDown
            strokeWidth={1.5}
            aria-hidden
            className="size-3.5 shrink-0 text-tertiary"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={cn(
            "w-(--radix-dropdown-menu-trigger-width) min-w-60",
            workspaces && "min-w-72",
          )}
        >
          {workspaces ? (
            <>
              {/* AppFlowy 워크스페이스 메뉴처럼 — 계정 줄 대신 "워크스페이스", 행마다 이니셜 타일 */}
              <DropdownMenuLabel>{m.shell.workspace.title}</DropdownMenuLabel>
              {workspaces.map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  onSelect={w.onSelect}
                  aria-current={w.current || undefined}
                  aria-keyshortcuts={w.onRemove && !w.current ? "Delete" : undefined}
                  onKeyDown={(e) => {
                    if (!w.onRemove || w.current) return;
                    if (e.key !== "Delete" && e.key !== "Backspace") return;
                    e.preventDefault();
                    w.onRemove();
                  }}
                  className="group/ws gap-3 py-1.5"
                  icon={
                    <Avatar
                      name={w.name}
                      size="md"
                      aria-hidden
                      role={undefined}
                      aria-label={undefined}
                      className="rounded-md"
                    />
                  }
                  shortcut={
                    w.current ? (
                      <Check {...ic} className="size-4 text-accent!" />
                    ) : w.onRemove ? (
                      // 메뉴 항목 안에 버튼을 겹치지 않는다. 키보드는 Delete — 강조된 행에만 키 힌트를 보인다
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden className="hidden group-data-highlighted/ws:inline-flex">
                          <Kbd keys={["Delete"]} />
                        </span>
                        <span
                          aria-hidden
                          data-slot="workspace-remove"
                          title={m.shell.workspace.remove}
                          onClick={(e) => {
                            // 항목 선택(전환)으로 번지지 않게
                            e.preventDefault();
                            e.stopPropagation();
                            w.onRemove?.();
                          }}
                          className={cn(
                            "inline-grid size-6 place-items-center rounded-md text-tertiary opacity-0 transition-opacity duration-(--dur-fast)",
                            "group-hover/ws:opacity-100 group-data-highlighted/ws:opacity-100 force-hover:opacity-100",
                            "hover:bg-active hover:text-primary force-hover:bg-active",
                          )}
                        >
                          <X {...ic} />
                        </span>
                      </span>
                    ) : undefined
                  }
                >
                  <RowText name={w.name} detail={w.detail} />
                  {w.current ? <span className="sr-only">{m.shell.workspace.openNow}</span> : null}
                </DropdownMenuItem>
              ))}
              {onCreate ? (
                <DropdownMenuItem
                  onSelect={onCreate}
                  className="gap-3 py-1.5"
                  icon={
                    <span className={cn(tile, "border border-line")}>
                      <Plus {...ic} />
                    </span>
                  }
                >
                  <RowText name={m.shell.workspace.newWorkspace} />
                </DropdownMenuItem>
              ) : null}
              {onOpenFolder ? (
                <DropdownMenuItem
                  onSelect={onOpenFolder}
                  className="gap-3 py-1.5"
                  icon={
                    <span className={cn(tile, "border border-line")}>
                      <FolderOpen {...ic} />
                    </span>
                  }
                >
                  <RowText
                    name={m.shell.workspace.openFolder}
                    detail={m.shell.workspace.openFolderDetail}
                  />
                </DropdownMenuItem>
              ) : null}
            </>
          ) : (
            <DropdownMenuLabel className="flex items-center gap-2 px-2 py-1.5">
              <Avatar name={name} aria-hidden />
              <span className="grid min-w-0">
                <span className="truncate text-ui font-medium tracking-normal text-primary">
                  {name}
                </span>
                {detail ? (
                  <span
                    title={detail}
                    className="truncate text-caption font-normal tracking-normal text-tertiary"
                  >
                    {detail}
                  </span>
                ) : null}
              </span>
            </DropdownMenuLabel>
          )}
          {children ? <DropdownMenuSeparator /> : null}
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { WorkspaceSwitcher, type WorkspaceRow, type WorkspaceSwitcherProps };
