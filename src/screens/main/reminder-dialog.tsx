import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REMINDER_COPY } from "@/features/reminders";
import { openPageLink } from "./actions";
import { setMissedOpen, useMissed } from "./reminder-alerts";
import { useMessages } from "@/lib/i18n";

/** 놓친 알림 목록 (앱 시작 때 뜬 것). 항목을 누르면 그 페이지를 연다 */
export function ReminderAlertsDialog() {
  const m = useMessages();
  const { items, open } = useMissed();
  return (
    <Dialog open={open} onOpenChange={setMissedOpen}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{REMINDER_COPY.missedTitle(items.length)}</DialogTitle>
          <DialogDescription>{m.screens.reminders.missedDesc}</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className="flex w-full min-w-0 items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-ui hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid force-hover:bg-hover"
                onClick={() => {
                  setMissedOpen(false);
                  openPageLink(item.pageId);
                }}
              >
                <span className="min-w-0 truncate text-primary">{item.title}</span>
                <span className="shrink-0 text-caption text-tertiary">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setMissedOpen(false)}>
            {m.screens.dialogs.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
