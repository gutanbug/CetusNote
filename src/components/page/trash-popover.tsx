import { FileText, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import * as React from "react";
import { PageIcon } from "@/components/ui/page-icon";
import { useMessages } from "@/lib/i18n";

export type TrashItem = {
  id: string;
  title: string;
  emoji?: string;
  /** 표시용 문구. 예: "3일 전" */
  deletedAt: string;
};

type TrashListProps = {
  items: TrashItem[];
  onRestore: (id: string) => void;
  /** 영구 삭제 — 행 안에서 한 번 더 확인한 뒤 부른다 */
  onPurge: (id: string) => void;
  className?: string;
};

/** 휴지통 내용 — 검색 · 목록 · 복원/영구 삭제 · 빈 상태 · 안내 (프로토타입 `.trash`, 폭 420) */
function TrashList({ items, onRestore, onPurge, className }: TrashListProps) {
  const m = useMessages();
  const [query, setQuery] = React.useState("");
  const [confirmId, setConfirmId] = React.useState<string>();
  const listRef = React.useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const shown = q
    ? items.filter((i) => (i.title || m.page.untitled).toLowerCase().includes(q))
    : items;

  // 행이 바뀐 뒤 포커스를 둘 곳: 같은 행의 버튼, 다음 행의 첫 버튼, 없으면 목록 자체
  const focusAfter = (selector: string | undefined) =>
    requestAnimationFrame(() => {
      const box = listRef.current;
      const el = selector ? box?.querySelector<HTMLElement>(selector) : null;
      (el ?? box)?.focus();
    });
  const leave = (index: number) => {
    const next = shown[index + 1] ?? shown[index - 1];
    setConfirmId(undefined);
    focusAfter(next ? `[data-row="${next.id}"] button` : undefined);
  };

  return (
    <div data-slot="trash-list" className={cn("grid w-105 max-w-full", className)}>
      <div className="p-2">
        <SearchInput
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            setConfirmId(undefined);
          }}
          placeholder={m.page.trash.searchPlaceholder}
          aria-label={m.page.trash.search}
          disabled={!items.length}
        />
      </div>
      <div
        ref={listRef}
        tabIndex={-1}
        className="max-h-75 overflow-y-auto overscroll-contain px-1 outline-none"
      >
        {!items.length ? (
          <p className="px-4 py-6 text-center text-caption text-tertiary">{m.page.trash.empty}</p>
        ) : !shown.length ? (
          <p role="status" className="px-4 py-6 text-center text-caption text-tertiary">
            {m.page.trash.noMatch(query)}
          </p>
        ) : (
          <ul aria-label={m.page.trash.list} className="grid">
            {shown.map((item, index) => {
              const name = item.title || m.page.untitled;
              const confirming = confirmId === item.id;
              return (
                <li
                  key={item.id}
                  data-row={item.id}
                  className="group/row flex min-h-9 items-center gap-2 rounded-md px-2 py-1 hover:bg-hover force-hover:bg-hover"
                >
                  {item.emoji ? (
                    <span aria-hidden className="w-4.5 shrink-0 text-center text-ui leading-none">
                      <PageIcon icon={item.emoji} />
                    </span>
                  ) : (
                    <FileText
                      strokeWidth={1.5}
                      aria-hidden
                      className="size-4 shrink-0 text-tertiary"
                    />
                  )}
                  <span
                    title={name}
                    className={cn(
                      "min-w-0 flex-1 truncate text-ui",
                      !item.title && "text-tertiary",
                    )}
                  >
                    {name}
                  </span>
                  {confirming ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <span role="alert" className="text-label text-danger">
                        {m.page.trash.confirmPurge}
                      </span>
                      {/* 기본 포커스는 취소 — Enter 한 번으로 지우지 않게 */}
                      <Button
                        size="sm"
                        variant="ghost"
                        autoFocus
                        onClick={() => {
                          setConfirmId(undefined);
                          focusAfter(`[data-row="${item.id}"] [data-purge]`);
                        }}
                      >
                        {m.page.trash.cancel}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          leave(index);
                          onPurge(item.id);
                        }}
                      >
                        {m.page.trash.purge}
                      </Button>
                    </span>
                  ) : (
                    <>
                      <span className="shrink-0 text-label text-tertiary">{item.deletedAt}</span>
                      <span className="flex shrink-0 opacity-0 transition-opacity duration-(--dur-fast) group-focus-within/row:opacity-100 group-hover/row:opacity-100 force-hover:opacity-100">
                        <IconButton
                          label={m.page.trash.restore(name)}
                          onClick={() => {
                            leave(index);
                            onRestore(item.id);
                          }}
                        >
                          <RotateCcw strokeWidth={1.5} />
                        </IconButton>
                        <IconButton
                          label={m.page.trash.purgeOne(name)}
                          data-purge=""
                          onClick={() => setConfirmId(item.id)}
                        >
                          <Trash2 strokeWidth={1.5} />
                        </IconButton>
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="border-t border-line p-2 text-label text-tertiary">{m.page.trash.footer}</p>
    </div>
  );
}

type TrashPopoverProps = TrashListProps & {
  /** 여는 버튼 (SH-SidebarFooter의 휴지통 항목). anchor만 주면 트리거 없이 위치만 잡는다 */
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** PG-TrashPopover — 사이드바 휴지통 항목 옆에 뜨는 휴지통 (PAGE-08). */
function TrashPopover({ children, open, onOpenChange, ...list }: TrashPopoverProps) {
  const m = useMessages();
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {children ? <PopoverTrigger asChild>{children}</PopoverTrigger> : <PopoverAnchor />}
      <PopoverContent
        side="right"
        align="end"
        aria-label={m.page.trash.label}
        className="max-w-none p-0"
      >
        <TrashList {...list} />
      </PopoverContent>
    </Popover>
  );
}

export { TrashList, TrashPopover, type TrashListProps, type TrashPopoverProps };
