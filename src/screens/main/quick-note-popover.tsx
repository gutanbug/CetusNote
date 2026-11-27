import { QuickNote } from "@/components/page/quick-note";
import { SidebarItem } from "@/components/shell/sidebar-item";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { metaStore, useMeta } from "@/features/meta";
import { formatAgo } from "@/lib/format-date";
import type { QuickNote as Note } from "@/lib/storage";
import { NotebookPen } from "lucide-react";
import * as React from "react";
import { deleteQuickNote, promoteQuickNote } from "./actions";
import { useMainUi } from "./ui-store";
import { useMessages } from "@/lib/i18n";

const NONE: Note[] = [];

/** 사이드바 아래 "빠른 메모" 항목 + 팝오버 (QN-01/02, 프로토타입 `#qnoteBtn` · `.qnote`) */
export function QuickNotePopover() {
  const m = useMessages();
  const open = useMainUi((s) => s.quickNoteOpen);
  const notes = useMeta((s) => s.meta?.quickNotes ?? NONE);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const items = React.useMemo(
    () =>
      [...notes].reverse().map((n) => ({ id: n.id, text: n.text, when: formatAgo(n.createdAt) })),
    [notes],
  );

  return (
    <Popover open={open} onOpenChange={(o) => useMainUi.getState().setQuickNoteOpen(o)}>
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
        // 열면 바로 적을 수 있게 입력 칸으로
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          contentRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
        }}
      >
        <QuickNote
          notes={items}
          onSave={async (text) => {
            const ok = await metaStore.getState().addQuickNote(text);
            if (ok) toast(m.screens.quickNote.saved);
            else toast.error(m.screens.quickNote.saveFail);
            return ok;
          }}
          onPromote={promoteQuickNote}
          onDelete={deleteQuickNote}
          onClose={() => useMainUi.getState().setQuickNoteOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
