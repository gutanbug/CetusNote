import { toast } from "@/components/ui/toast";
import { summaryIndex } from "@/features/pages/summary";
import { pagesStore } from "@/features/pages";
import { displayTitle } from "@/features/pages/title";
import {
  attachWakeListeners,
  createReminderScheduler,
  createStoreReminderScheduler,
  REMINDER_COPY,
  remindersStore,
  requestNotificationPermission,
  type MissedReminder,
  type ReminderScheduler,
  type StoreDue,
} from "@/features/reminders";
import type { DateReminder } from "@/lib/dates/collect-reminders";
import * as React from "react";
import { create } from "zustand";
import { openPageLink } from "./actions";
import { resolveMention } from "./mention-model";
import { msg } from "@/lib/i18n";

/**
 * 날짜 알림 (EDIT-37) 화면 연결. 앱 시작 때 한 번 켜고(useReminderAlerts), 페이지 요약이 바뀔 때마다
 * 그 페이지의 알림 목록을 스케줄러에 넘긴다. 휴지통·지워진 페이지는 목록에서 뺀다.
 * 본문을 새로 읽지 않는다 — 요약(ADR-022)은 백그라운드 읽기가 채운다.
 */

/** 놓친 알림 목록 대화상자의 상태 (앱 시작 때 한 번 뜬다) */
type MissedState = { items: MissedReminder[]; open: boolean };
export const useMissed = create<MissedState>(() => ({ items: [], open: false }));
const showMissed = (items: MissedReminder[]) => useMissed.setState({ items, open: true });
export const setMissedOpen = (open: boolean) => useMissed.setState({ open });

/** 알림 목록(SYS-16) 가운데 울린 것: 앱 안 대화상자에서 미루기·완료·열기를 고른다 */
type DueState = { items: StoreDue[]; open: boolean };
export const useDueReminders = create<DueState>(() => ({ items: [], open: false }));
export const setDueOpen = (open: boolean) => useDueReminders.setState({ open });
/** 울린 항목을 대화상자에 올린다. 같은 알림이 두 번 들어오면 한 번만 보인다 */
const showDue = (incoming: StoreDue[]) =>
  useDueReminders.setState((s) => {
    const keys = new Set(s.items.map((i) => i.key));
    const items = [...s.items, ...incoming.filter((i) => !keys.has(i.key))];
    return { items, open: items.length > 0 };
  });
/** 알림 한 건을 대화상자에서 뺀다 (미루기·완료·열기 뒤) */
export function dismissDue(id: string) {
  useDueReminders.setState((s) => {
    const items = s.items.filter((i) => i.rem.id !== id);
    return { items, open: items.length > 0 };
  });
}

/** 앱 안 알림 (OS 알림을 보내지 못했을 때). 제목과 「열기」 */
function notifyInApp(item: MissedReminder) {
  toast(`${item.title} · ${item.label}`, {
    description: REMINDER_COPY.fallback,
    duration: 10_000,
    action: { label: msg().screens.reminders.open, onClick: () => openPageLink(item.pageId) },
  });
}

let scheduler: ReminderScheduler | null = null;
/** 페이지 id → 마지막으로 넘긴 알림 모양. 같으면 다시 넘기지 않는다 */
const sent = new Map<string, string>();

/** 요약 → 스케줄러: 바뀐 페이지만 넘기고, 휴지통·지워진 페이지는 뺀다 */
function sync(s: ReminderScheduler) {
  const { structure } = pagesStore.getState();
  const live = new Set<string>();
  for (const [id, summary] of summaryIndex.entries()) {
    const reminders: DateReminder[] = resolveMention(structure, id) ? summary.reminders : [];
    if (reminders.length) live.add(id);
    const sig = reminders.length ? JSON.stringify(reminders) : "";
    if (sent.get(id) === sig) continue;
    if (sig) {
      s.setPage(id, reminders);
      sent.set(id, sig);
    } else {
      s.removePage(id);
      sent.delete(id);
    }
  }
  // 요약에서 사라진 페이지(지움·워크스페이스 전환)도 뺀다
  for (const id of [...sent.keys()]) {
    if (live.has(id)) continue;
    s.removePage(id);
    sent.delete(id);
  }
}

/** 앱 전체에 한 번만 켠다. 해제 함수를 돌려준다(개발 모드의 두 번 실행도 안전하다) */
export function startReminderAlerts(): () => void {
  if (scheduler) return () => undefined;
  const launchedIso = new Date().toISOString();
  const s = createReminderScheduler({
    // 앱을 켜기 전에 고쳐 둔 페이지만 놓친 알림이 된다 (켠 뒤에 정한 지난 시각은 알리지 않는다)
    wasMissable: (id) => (pagesStore.getState().pages[id]?.updatedAt ?? "") < launchedIso,
    pageTitle: (id) => {
      const page = pagesStore.getState().structure[id];
      return page ? displayTitle(page) : "";
    },
    onPermissionNeeded: () => {
      toast(REMINDER_COPY.permissionExplain, {
        duration: Infinity,
        action: {
          label: REMINDER_COPY.allowButton,
          onClick: () => void requestNotificationPermission(),
        },
      });
    },
    onFallback: (items) => items.forEach(notifyInApp),
    onMissed: (items) => {
      toast(REMINDER_COPY.missedTitle(items.length), {
        duration: 15_000,
        action: { label: msg().screens.reminders.view, onClick: () => showMissed(items) },
      });
    },
  });
  scheduler = s;
  // 알림 목록(SYS-16): 울린 것은 대화상자에서 미루기·완료·열기를 고른다
  const ss = createStoreReminderScheduler({
    onFallback: showDue,
    onMissed: showDue,
    isFocused: () => typeof document !== "undefined" && document.hasFocus(),
    onFocused: showDue,
  });
  const unsubStore = remindersStore.subscribe((state) => ss.setList(state.list));
  ss.setList(remindersStore.getState().list);
  const unsubSummary = summaryIndex.subscribe(() => sync(s));
  // 구조가 바뀌면(휴지통·지움) 목록을 다시 맞춘다. 본문만 고친 편집은 구조 참조가 그대로라 건너뛴다
  let structure = pagesStore.getState().structure;
  let loadSeq = pagesStore.getState().loadSeq;
  const unsubPages = pagesStore.subscribe((state) => {
    if (state.loadSeq !== loadSeq) {
      // 워크스페이스를 바꿨다: 예약과 목록을 모두 비운다
      loadSeq = state.loadSeq;
      structure = state.structure;
      s.reset();
      sent.clear();
      return;
    }
    if (state.structure === structure) return;
    structure = state.structure;
    sync(s);
  });
  const detachWake = attachWakeListeners({
    wake: () => {
      s.wake();
      ss.wake();
    },
  });
  sync(s);
  return () => {
    unsubSummary();
    unsubPages();
    unsubStore();
    detachWake();
    s.dispose();
    ss.dispose();
    sent.clear();
    scheduler = null;
  };
}

/** 날짜 알림을 켠다 (App에서 한 번). 놓친 알림 대화상자도 함께 그린다 */
export function useReminderAlerts() {
  React.useEffect(() => startReminderAlerts(), []);
}
