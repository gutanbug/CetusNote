import { QuickNote } from "@/components/page/quick-note";
import { SidebarItem } from "@/components/shell/sidebar-item";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { metaStore, useMeta } from "@/features/meta";
import { formatReminderWhen, useReminders } from "@/features/reminders";
import { remindersFor } from "@/features/reminders/store";
import { formatAgo } from "@/lib/format-date";
import type { QuickNote as Note } from "@/lib/storage";
import { ArrowLeft, NotebookPen } from "lucide-react";
import * as React from "react";
import { deleteQuickNote, promoteQuickNote } from "./actions";
import { BoundReminderPicker } from "./reminder-picker-bound";
import { useMainUi } from "./ui-store";
import { useMessages } from "@/lib/i18n";

const NONE: Note[] = [];

/** 사이드바 아래 "빠른 메모" 항목 + 팝오버 (QN-01/02, 프로토타입 `#qnoteBtn` · `.qnote`) */
export function QuickNotePopover() {
  const m = useMessages();
  const open = useMainUi((s) => s.quickNoteOpen);
  const focusId = useMainUi((s) => s.quickNoteFocusId);
  const notes = useMeta((s) => s.meta?.quickNotes ?? NONE);
  const reminders = useReminders((s) => s.list);
  /** 이 메모의 알림 고르기 중이면 그 메모 id (SYS-16) */
  const [remindFor, setRemindFor] = React.useState<string | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const items = React.useMemo(() => {
    const now = new Date();
    return [...notes].reverse().map((n) => {
      const next = remindersFor(reminders, { type: "quickNote", id: n.id })[0];
      return {
        id: n.id,
        text: n.text,
        when: formatAgo(n.createdAt),
        remindWhen: next ? formatReminderWhen(next, now) : undefined,
      };
    });
  }, [notes, reminders]);
  const remindNote = notes.find((n) => n.id === remindFor);

  /** 알림 대화상자 「열기」로 온 메모를 보이는 곳으로 옮기고 강조를 끝낸다 */
  const reveal = React.useCallback(() => {
    const id = useMainUi.getState().quickNoteFocusId;
    if (!id) return;
    const el = contentRef.current?.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, []);
  React.useEffect(() => {
    if (open && focusId) reveal();
  }, [open, focusId, reveal]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          // 닫으면 강조도 끝낸다
          setRemindFor(null);
          useMainUi.getState().setQuickNoteFocusId(null);
        }
        useMainUi.getState().setQuickNoteOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <SidebarItem
          icon={NotebookPen}
          label={m.screens.quickNote.label}
          count={notes.length}
          shortcut={["⌘", "⇧", "N"]}
          aria-haspopup="dialog"
        />
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        side="top"
        align="start"
        aria-label={m.screens.quickNote.label}
        className="w-80 max-w-none rounded-xl p-0"
        // 열면 바로 적을 수 있게 입력 칸으로 (알림 「열기」로 왔으면 그 메모를 보여 준다)
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          reveal();
          contentRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
        }}
      >
        {remindFor && remindNote ? (
          <>
            <div className="flex items-center gap-2 border-b border-line py-2 pr-2 pl-3">
              <IconButton label={m.page.quickNote.remindBack} onClick={() => setRemindFor(null)}>
                <ArrowLeft strokeWidth={1.5} />
              </IconButton>
              <h2 className="flex-1 text-caption font-semibold text-primary">
                {m.page.quickNote.remind}
              </h2>
            </div>
            <BoundReminderPicker
              target={{ type: "quickNote", id: remindNote.id }}
              title={remindNote.text.split("\n")[0]}
            />
          </>
        ) : (
          <QuickNote
            notes={items}
            highlightId={focusId}
            onSave={async (text) => {
              const ok = await metaStore.getState().addQuickNote(text);
              if (ok) toast(m.screens.quickNote.saved);
              else toast.error(m.screens.quickNote.saveFail);
              return ok;
            }}
            onPromote={promoteQuickNote}
            onDelete={deleteQuickNote}
            onRemind={setRemindFor}
            onClose={() => useMainUi.getState().setQuickNoteOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
