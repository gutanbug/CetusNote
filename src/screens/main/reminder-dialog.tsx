import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REMINDER_COPY, remindersStore, type StoreDue } from "@/features/reminders";
import { openPageLink } from "./actions";
import {
  dismissDue,
  setDueOpen,
  setMissedOpen,
  useDueReminders,
  useMissed,
} from "./reminder-alerts";
import { useMessages } from "@/lib/i18n";

/** 날짜 알림 대화상자 둘: 놓친 알림 목록(EDIT-37)과 울린 알림 목록(SYS-16, 미루기·완료·열기) */
export function ReminderAlertsDialog() {
  return (
    <>
      <MissedRemindersDialog />
      <DueRemindersDialog />
    </>
  );
}

/** 놓친 알림 목록 (앱 시작 때 뜬 것). 항목을 누르면 그 페이지를 연다 */
function MissedRemindersDialog() {
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

/** 울린 알림 목록 (SYS-16). 미루기·완료는 저장소에 바로 쓰고, 「열기」는 페이지로 간다 */
function DueRemindersDialog() {
  const m = useMessages();
  const r = m.features.reminders;
  const { items, open } = useDueReminders();
  const snooze = (id: string, by: number | "tomorrow9") => {
    remindersStore.getState().snooze(id, by);
    dismissDue(id);
  };
  const done = (id: string) => {
    remindersStore.getState().complete(id);
    dismissDue(id);
  };
  const openTarget = (item: StoreDue) => {
    if (item.rem.target.type === "page") openPageLink(item.rem.target.id);
    dismissDue(item.rem.id);
  };
  return (
    <Dialog open={open} onOpenChange={setDueOpen}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{r.dueTitle}</DialogTitle>
          <DialogDescription>{r.dueDesc}</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {items.map((item) => (
            <li key={item.key} className="grid gap-1 px-2 py-1.5">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-primary">{item.title}</span>
                <span className="shrink-0 text-caption text-tertiary">{item.when}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => snooze(item.rem.id, 10)}
                >
                  {r.snooze10}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => snooze(item.rem.id, 60)}
                >
                  {r.snooze60}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => snooze(item.rem.id, "tomorrow9")}
                >
                  {r.snoozeTomorrow}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => done(item.rem.id)}>
                  {r.done}
                </Button>
                {item.rem.target.type === "page" ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => openTarget(item)}>
                    {m.screens.reminders.open}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
