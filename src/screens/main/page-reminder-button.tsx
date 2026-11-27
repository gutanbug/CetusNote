import { Bell } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useReminders } from "@/features/reminders";
import { remindersFor } from "@/features/reminders/store";
import type { ReminderTarget } from "@/features/reminders/model";
import { useMessages } from "@/lib/i18n";
import { BoundReminderPicker } from "./reminder-picker-bound";
import { useMainUi } from "./ui-store";

/**
 * 페이지 알림 버튼 (SYS-16). 상단 막대의 종 아이콘 — 알림이 걸려 있으면 작은 점을 단다.
 * 누르면 알림 고르기 패널(PG-ReminderPicker)이 열린다. 열림 상태는 메인 UI 스토어에 있어
 * 페이지 메뉴 「알림…」도 같은 패널을 연다.
 */
export function PageReminderButton({ target, title }: { target: ReminderTarget; title?: string }) {
  const m = useMessages();
  const copy = m.screens.reminders;
  const open = useMainUi((s) => s.pageReminderOpen);
  const setOpen = useMainUi((s) => s.setPageReminderOpen);
  const list = useReminders((s) => s.list);
  const active = remindersFor(list, target);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton label={copy.bellLabel} aria-expanded={open} className="relative">
          <Bell strokeWidth={1.5} />
          {active.length > 0 ? (
            <span
              aria-hidden
              data-slot="reminder-dot"
              className="absolute top-1 right-1 size-1.5 rounded-pill bg-accent-fill"
            />
          ) : null}
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0">
        <BoundReminderPicker target={target} title={title} />
      </PopoverContent>
    </Popover>
  );
}
