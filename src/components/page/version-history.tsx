import { insetFocus } from "@/components/shell/parts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeaderRow,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import * as React from "react";
import { useMessages } from "@/lib/i18n";

export type VersionRowView = {
  id: string;
  /** 시각 HH:mm */
  time: string;
  /** 방금 전 · N분 전 … */
  relative: string;
  /** "1,234자" */
  chars: string;
};
export type VersionGroupView = { label: string; rows: VersionRowView[] };
export type VersionListStatus = "loading" | "ready" | "empty" | "error";

type VersionHistoryProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 목록 상태. ready일 때만 groups를 그린다 */
  status: VersionListStatus;
  groups: VersionGroupView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 고른 버전의 제목 — 미리보기 맨 위 */
  previewTitle: string;
  /** 고른 버전의 읽기 전용 본문 (바깥에서 그린다) */
  preview: React.ReactNode;
  restoring?: boolean;
  onRestore: () => void;
};

/**
 * 버전 기록 대화상자 (DATA-09). 왼쪽은 날짜별 버전 목록, 오른쪽은 고른 버전의 미리보기.
 * 목록은 listbox: ↑↓로 옮기면서 고르고, Home·End는 처음·끝, Enter는 지금 행을 고른다.
 * 되돌리기는 버튼으로만 한다(실수로 덮지 않게).
 */
export function VersionHistory({
  open,
  onOpenChange,
  status,
  groups,
  selectedId,
  onSelect,
  previewTitle,
  preview,
  restoring = false,
  onRestore,
}: VersionHistoryProps) {
  const m = useMessages();
  const listRef = React.useRef<HTMLDivElement>(null);
  const ids = groups.flatMap((g) => g.rows.map((r) => r.id));
  const focusRow = (id: string) =>
    requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLElement>(`[data-value="${id}"]`)?.focus(),
    );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!ids.length) return;
    const from =
      (e.target as HTMLElement).closest<HTMLElement>("[data-value]")?.dataset.value ?? selectedId;
    const i = from ? ids.indexOf(from) : -1;
    let next: string | undefined;
    if (e.key === "ArrowDown") next = ids[Math.min(i + 1, ids.length - 1)];
    else if (e.key === "ArrowUp") next = ids[Math.max(i - 1, 0)];
    else if (e.key === "Home") next = ids[0];
    else if (e.key === "End") next = ids[ids.length - 1];
    else if (e.key === "Enter" && from) next = from;
    if (next === undefined) return;
    e.preventDefault();
    if (next !== selectedId) onSelect(next);
    focusRow(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size={null}
        // 열면 고른 버전 행에 초기 포커스를 둔다. 기본(첫 포커스 가능 요소)은 스크롤 영역 section이라
        // 미리보기 전체에 포커스 링이 뜬다. 행이 아직 없으면(불러오는 중) 기본 동작에 맡긴다
        onOpenAutoFocus={(e) => {
          const row = listRef.current?.querySelector<HTMLElement>(
            '[data-value][aria-selected="true"], [data-value]',
          );
          if (!row) return;
          e.preventDefault();
          row.focus();
        }}
        className="grid h-140 max-h-[calc(var(--fit-h)-var(--s16))] w-220 max-w-[calc(var(--fit-w)-var(--s8))] grid-cols-[calc(var(--spacing)*70)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden p-0"
      >
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)] border-r border-line bg-subtle">
          {status === "ready" ? (
            <div
              ref={listRef}
              role="listbox"
              aria-label={m.page.versionHistory.list}
              onKeyDown={onKeyDown}
              className="grid content-start gap-3 overflow-y-auto px-2 py-4"
            >
              {groups.map((g) => (
                <div key={g.label} role="group" aria-label={g.label} className="grid gap-0.5">
                  <div className="px-2 pb-1 text-label font-semibold tracking-(--tracking-label) text-tertiary">
                    {g.label}
                  </div>
                  {g.rows.map((r) => {
                    const active = r.id === selectedId;
                    return (
                      <div
                        key={r.id}
                        role="option"
                        aria-selected={active}
                        data-value={r.id}
                        data-active={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onSelect(r.id)}
                        className={cn(
                          "grid w-full cursor-default gap-0.5 rounded-md px-3 py-2 text-left text-ui text-secondary transition-colors duration-(--dur-fast) hover:bg-hover hover:text-primary data-[active=true]:bg-sel data-[active=true]:font-medium data-[active=true]:text-sel-fg force-hover:bg-hover force-hover:text-primary",
                          insetFocus,
                        )}
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="tabular-nums">{r.time}</span>
                          <span className="text-caption text-tertiary">{r.relative}</span>
                        </span>
                        <span className="text-caption text-tertiary">{r.chars}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <p
              role="status"
              className="px-5 py-6 text-caption leading-relaxed text-pretty text-tertiary"
            >
              {status === "loading"
                ? m.page.versionHistory.loading
                : status === "error"
                  ? m.page.versionHistory.loadError
                  : m.page.versionHistory.empty}
            </p>
          )}
        </div>

        <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]">
          <DialogHeaderRow className="border-b border-line">
            <DialogTitle>{m.page.versionHistory.title}</DialogTitle>
            <DialogDescription className="sr-only">
              {m.page.versionHistory.description}
            </DialogDescription>
          </DialogHeaderRow>
          <section
            aria-label={m.page.versionHistory.preview}
            tabIndex={0}
            className={cn("min-h-0 overflow-y-auto px-8 py-6", insetFocus)}
          >
            {selectedId ? (
              <>
                <h3 className="mb-4 text-title font-bold tracking-(--tracking-display) break-words">
                  {previewTitle || m.page.untitled}
                </h3>
                {preview}
              </>
            ) : (
              <p className="text-ui text-tertiary">{m.page.versionHistory.pickHint}</p>
            )}
          </section>
          <div className="flex justify-end gap-2 border-t border-line px-6 py-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {m.page.close}
            </Button>
            <Button onClick={onRestore} disabled={!selectedId || restoring}>
              {restoring ? m.page.versionHistory.restoring : m.page.versionHistory.restore}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
