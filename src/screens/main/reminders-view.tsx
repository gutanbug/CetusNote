import { Bell } from "lucide-react";
import * as React from "react";
import {
  ReminderList,
  type ReminderListRow,
  type ReminderListSection,
  type ReminderListSectionKey,
  type SnoozeChoice,
} from "@/components/page/reminder-list";
import { SidebarItem } from "@/components/shell/sidebar-item";
import { useMeta } from "@/features/meta";
import { usePages } from "@/features/pages";
import { formatReminderWhen, remindersStore, useReminders } from "@/features/reminders";
import { groupReminders } from "@/features/reminders/group";
import { dueAt, type Reminder, type SnoozeSpec } from "@/features/reminders/model";
import { useMessages } from "@/lib/i18n";
import type { QuickNote } from "@/lib/storage";
import { openPageLink } from "./actions";
import { useMainUi } from "./ui-store";

/** 알림 보기(SYS-16). 사이드바 항목과 메인 영역 보기 두 곳에서 쓴다 */

const NO_NOTES: QuickNote[] = [];
const ORDER: ReminderListSectionKey[] = [
  "running",
  "overdue",
  "today",
  "tomorrow",
  "thisWeek",
  "later",
  "repeating",
  "done",
];
const SNOOZE_SPEC: Record<SnoozeChoice, SnoozeSpec> = {
  min10: 10,
  hour1: 60,
  tomorrow9: "tomorrow9",
};

/** 사이드바 「알림」 항목. 오늘·지난 알림 개수를 뱃지로 보인다 */
export function RemindersSidebarItem({ active }: { active: boolean }) {
  const m = useMessages();
  const list = useReminders((s) => s.list);
  const groups = React.useMemo(() => groupReminders(list, new Date()), [list]);
  const due = groups.overdue.length + groups.today.length;
  return (
    <SidebarItem
      icon={Bell}
      label={m.screens.remindersView.sidebarLabel}
      count={due > 0 ? due : undefined}
      active={active}
      onClick={() => useMainUi.getState().setView({ kind: "reminders" })}
    />
  );
}

type Ctx = {
  pages: Record<string, { title: string }>;
  notes: QuickNote[];
  untitled: string;
  quickNote: string;
};

/** 대상 이름: 페이지 제목 · 빠른 메모 첫 줄 · 대상 없음(null) */
function targetName(rem: Reminder, ctx: Ctx): string | null {
  if (rem.target.type === "page") return ctx.pages[rem.target.id]?.title || ctx.untitled;
  const target = rem.target;
  if (target.type === "quickNote") {
    const note = ctx.notes.find((n) => n.id === target.id);
    return note ? note.text.split("\n")[0]!.slice(0, 40) || ctx.quickNote : ctx.quickNote;
  }
  return null;
}

function rowOf(rem: Reminder, key: ReminderListSectionKey, ctx: Ctx, now: Date): ReminderListRow {
  const target = targetName(rem, ctx);
  const due = dueAt(rem)?.getTime();
  return {
    id: rem.id,
    title: target ?? rem.label,
    note: target && rem.label ? rem.label : undefined,
    when: formatReminderWhen(rem, now),
    endsAt: key === "running" && due !== undefined ? due : undefined,
    done: rem.done,
  };
}

export function RemindersView() {
  const m = useMessages();
  const t = m.screens.remindersView;
  const list = useReminders((s) => s.list);
  const pages = usePages((s) => s.pages);
  const notes = useMeta((s) => s.meta?.quickNotes ?? NO_NOTES);
  // 기준 시각: 목록이 그대로면 마지막 틱 시각, 목록이 바뀌었으면 지금. 1초 틱은 타이머가 돌 때만 켠다
  const [clock, setClock] = React.useState<{ list: Reminder[]; at: Date }>(() => ({
    list,
    at: new Date(),
  }));
  const now = clock.list === list ? clock.at : new Date();
  const running = list.some(
    (r) => r.kind === "timer" && !r.done && (dueAt(r)?.getTime() ?? 0) > now.getTime(),
  );
  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setClock({ list, at: new Date() }), 1000);
    return () => window.clearInterval(id);
  }, [running, list]);

  const sections = React.useMemo<ReminderListSection[]>(() => {
    const groups = groupReminders(list, now);
    const ctx: Ctx = { pages, notes, untitled: m.page.untitled, quickNote: t.quickNote };
    return ORDER.map((key) => ({
      key,
      rows: groups[key].map((rem) => rowOf(rem, key, ctx, now)),
    })).filter((s) => s.rows.length > 0);
  }, [list, now, pages, notes, m.page.untitled, t.quickNote]);

  const onOpen = (id: string) => {
    const rem = list.find((r) => r.id === id);
    if (!rem) return;
    if (rem.target.type === "page") openPageLink(rem.target.id);
    else if (rem.target.type === "quickNote") useMainUi.getState().setQuickNoteOpen(true);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-title text-primary">{t.title}</h1>
          <p className="text-caption text-secondary">{t.subtitle}</p>
        </header>
        <ReminderList
          sections={sections}
          now={now}
          onOpen={onOpen}
          onSnooze={(id, by) => remindersStore.getState().snooze(id, SNOOZE_SPEC[by])}
          onComplete={(id) => remindersStore.getState().complete(id)}
          onDelete={(id) => remindersStore.getState().remove(id)}
        />
      </div>
    </div>
  );
}
