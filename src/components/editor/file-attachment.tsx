import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import {
  attachmentKind,
  isOversize,
  oversizeMessage,
  type AttachmentKind,
} from "@/lib/attachments/limits";
import { formatBytes, formatLabel, middleEllipsis } from "@/lib/attachments/format";
import { cn } from "@/lib/utils";
import {
  Download,
  ExternalLink,
  FileQuestionMark,
  FileX,
  FolderSearch,
  Replace,
  Trash,
  Ellipsis,
} from "lucide-react";
import * as React from "react";
import { attachmentIcon } from "./attachment-icon";

/** 카드·미리 보기가 함께 쓰는 동작. 없는 항목은 메뉴에서 빠진다 */
export type AttachmentActions = {
  /** 열기 (Enter·클릭). 기본 앱에서 연다 */
  onOpen?: () => void;
  /** Finder에서 보기 (파일 위치 표시) */
  onReveal?: () => void;
  /** 다른 이름으로 저장 */
  onDownload?: () => void;
  /** 다른 파일로 바꾸기 */
  onReplace?: () => void;
  /** 첨부 삭제 (블록에서 뺀다) */
  onRemove?: () => void;
};

export type FileAttachmentProps = AttachmentActions & {
  /** 원본 파일 이름 */
  name: string;
  /** 바이트. 없으면 크기 칸을 비운다 */
  size?: number;
  mime?: string;
  /** 종류를 직접 줄 때(노드 속성 kind). 없으면 mime·확장자로 정한다 */
  kind?: AttachmentKind;
  /** 올리는 중일 때만 0–100 */
  progress?: number;
  /** 원본 파일이 워크스페이스에 없음 */
  missing?: boolean;
  /** 카드 아래 보조 안내 (예: 미리 보기를 열 수 없어요) */
  notice?: string;
  selected?: boolean;
  /** false면 바꾸기·삭제를 뺀다 (읽기 전용 본문) */
  editable?: boolean;
  className?: string;
};

type State = "uploading" | "missing" | "oversize" | "ready";

/** 메뉴 항목 자리. 드롭다운·컨텍스트 메뉴가 같은 목록을 쓴다 */
function MenuItems({
  Item,
  Separator,
  actions,
  canUse,
  editable,
}: {
  Item: typeof DropdownMenuItem;
  Separator: typeof DropdownMenuSeparator;
  actions: AttachmentActions;
  canUse: boolean;
  editable: boolean;
}) {
  const openGroup = [actions.onOpen, actions.onReveal, actions.onDownload].some(Boolean);
  const editGroup = editable && (actions.onReplace || actions.onRemove);
  return (
    <>
      {actions.onOpen && (
        <Item
          icon={<ExternalLink strokeWidth={1.5} />}
          disabled={!canUse}
          onSelect={actions.onOpen}
        >
          열기
        </Item>
      )}
      {actions.onReveal && (
        <Item
          icon={<FolderSearch strokeWidth={1.5} />}
          disabled={!canUse}
          onSelect={actions.onReveal}
        >
          Finder에서 보기
        </Item>
      )}
      {actions.onDownload && (
        <Item
          icon={<Download strokeWidth={1.5} />}
          disabled={!canUse}
          onSelect={actions.onDownload}
        >
          다른 이름으로 저장
        </Item>
      )}
      {openGroup && editGroup && <Separator />}
      {editable && actions.onReplace && (
        <Item icon={<Replace strokeWidth={1.5} />} onSelect={actions.onReplace}>
          바꾸기
        </Item>
      )}
      {editable && actions.onRemove && (
        <Item icon={<Trash strokeWidth={1.5} />} variant="danger" onSelect={actions.onRemove}>
          삭제
        </Item>
      )}
    </>
  );
}

/**
 * ED-FileAttachment — 첨부 파일 카드. 본문 블록의 기본 모양이자 미리 보기 실패 때의 대체 모양.
 * 열기는 카드 본문(Tab → Enter), 나머지는 ⋯ 메뉴나 메뉴 키(또는 Shift+F10)에 모인다.
 */
export function FileAttachment({
  name,
  size,
  mime,
  kind: kindProp,
  progress,
  missing = false,
  notice,
  selected = false,
  editable = true,
  className,
  ...actions
}: FileAttachmentProps) {
  const descId = React.useId();
  const kind = kindProp ?? attachmentKind(name, mime);
  const state: State =
    progress !== undefined
      ? "uploading"
      : missing
        ? "missing"
        : isOversize(kind, size)
          ? "oversize"
          : "ready";
  const canUse = state === "ready";
  const hasEditActions = editable && Boolean(actions.onReplace || actions.onRemove);
  const hasItems = Boolean(
    actions.onOpen || actions.onReveal || actions.onDownload || hasEditActions,
  );
  const showMenu = hasItems && state !== "uploading";

  const iconClass = "size-4";
  const icon =
    state === "missing" ? (
      <FileQuestionMark strokeWidth={1.5} className={iconClass} />
    ) : state === "oversize" ? (
      <FileX strokeWidth={1.5} className={iconClass} />
    ) : (
      (() => {
        const Icon = attachmentIcon(name, mime);
        return <Icon strokeWidth={1.5} className={iconClass} />;
      })()
    );

  const meta =
    state === "missing"
      ? "원본 파일을 찾을 수 없어요"
      : state === "oversize"
        ? oversizeMessage(kind)
        : [formatLabel(name), size === undefined ? "" : formatBytes(size)]
            .filter(Boolean)
            .join(" · ");

  const open = () => {
    if (canUse) actions.onOpen?.();
  };

  const card = (
    <div
      data-slot="file-attachment"
      data-state={state}
      data-selected={selected || undefined}
      className={cn(
        "group relative w-full rounded-lg border bg-elevated p-3 transition-colors motion-reduce:transition-none",
        selected ? "border-accent bg-active" : "border-line",
        "hover:bg-hover force-hover:bg-hover",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          data-slot="file-attachment-open"
          aria-disabled={canUse ? undefined : true}
          aria-describedby={descId}
          onClick={open}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid",
            !canUse && "cursor-default",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-md bg-subtle text-secondary",
              state === "oversize" && "text-danger",
              state === "missing" && "text-tertiary",
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ui text-primary" title={name}>
              {middleEllipsis(name, 48)}
            </span>
            <span
              id={descId}
              className={cn(
                "block truncate text-caption",
                state === "oversize" ? "text-danger" : "text-tertiary",
              )}
            >
              {meta}
            </span>
            {notice && <span className="block truncate text-caption text-tertiary">{notice}</span>}
          </span>
        </button>
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="파일 메뉴" noTooltip className="shrink-0">
                <Ellipsis strokeWidth={1.5} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <MenuItems
                Item={DropdownMenuItem}
                Separator={DropdownMenuSeparator}
                actions={actions}
                canUse={canUse}
                editable={editable}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {state === "uploading" && (
        <div className="mt-2 flex items-center gap-2">
          <Progress aria-label={`${name} 올리는 중`} value={progress ?? 0} className="flex-1" />
          <span className="shrink-0 text-caption text-tertiary tabular-nums">
            올리는 중 · {Math.round(progress ?? 0)}%
          </span>
        </div>
      )}
    </div>
  );

  if (!hasItems) return card;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
      <ContextMenuContent>
        <MenuItems
          Item={ContextMenuItem as unknown as typeof DropdownMenuItem}
          Separator={ContextMenuSeparator as unknown as typeof DropdownMenuSeparator}
          actions={actions}
          canUse={canUse}
          editable={editable}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}
