import { ulid, type Storage } from "@/lib/storage";
import { createStore } from "zustand/vanilla";
import {
  complete as completeReminder,
  createReminder,
  dueAt,
  parseRemindersFile,
  snooze as snoozeReminder,
  toRemindersFile,
  updateReminder,
  type Reminder,
  type ReminderKind,
  type ReminderTarget,
  type RepeatRule,
  type SnoozeSpec,
} from "./model";

/**
 * 알림 목록 스토어 (SYS-16). 워크스페이스마다 하나를 만들고(`createRemindersStore`), 열 때 `load`를 부른다.
 * 바뀌면 잠깐 모았다가 `reminders.json`에 쓴다. 읽기에 실패한 파일은 덮어쓰지 않는다(`readError`).
 * 페이지·빠른 메모 대상의 알림은 `remindersFor`로 고른다.
 */

export type NewReminder = {
  kind: ReminderKind;
  target: ReminderTarget;
  label: string;
  /** 알람: 지역 「YYYY-MM-DDTHH:mm」 */
  at?: string;
  /** 타이머 길이(초) */
  durationSec?: number;
  repeat?: RepeatRule;
};

export type RemindersState = {
  list: Reminder[];
  loaded: boolean;
  /** 파일을 읽지 못했다(깨짐·모양 다름). 이때는 쓰지 않는다 */
  readError: boolean;
  /** 마지막 쓰기가 실패했다(SH-SaveStatus에 표시) */
  saveError: boolean;
  load(): Promise<void>;
  /** 새 알림을 더한다. 입력이 틀리면 null */
  add(input: NewReminder, now?: Date): Reminder | null;
  update(id: string, patch: { label?: string; at?: string; repeat?: RepeatRule | null }): void;
  remove(id: string): void;
  snooze(id: string, by: SnoozeSpec, now?: Date): void;
  /** 완료(반복 알람은 다음 울림으로 넘긴다) */
  complete(id: string, now?: Date): void;
  /** 대기 중인 쓰기를 바로 쓴다 */
  flush(): Promise<void>;
};

export type RemindersStoreOptions = {
  /** 저장을 모으는 시간(ms). 기본 400 */
  debounceMs?: number;
  /** 항목 id 만들기 (테스트에서 바꾼다) */
  newId?: () => string;
};

/** 대상(페이지·빠른 메모)에 붙은 알림 — 끝나지 않은 것, 울릴 시각 순서 */
export function remindersFor(list: readonly Reminder[], target: ReminderTarget): Reminder[] {
  const same = (t: ReminderTarget) =>
    t.type === target.type && (t.type === "none" || t.id === (target as { id: string }).id);
  return list
    .filter((r) => !r.done && same(r.target))
    .sort((a, b) => (dueAt(a)?.getTime() ?? 0) - (dueAt(b)?.getTime() ?? 0));
}

export function createRemindersStore(
  storage: Pick<Storage, "readReminders" | "writeReminders">,
  options: RemindersStoreOptions = {},
) {
  const debounceMs = options.debounceMs ?? 400;
  const newId = options.newId ?? (() => ulid());
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  const store = createStore<RemindersState>()((set, get) => {
    /** 바뀐 목록을 쓴다. 읽기 오류가 있으면 쓰지 않는다 */
    const save = async (): Promise<void> => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (!dirty || get().readError) return;
      dirty = false;
      try {
        await storage.writeReminders(toRemindersFile(get().list));
        set({ saveError: false });
      } catch {
        dirty = true;
        set({ saveError: true });
      }
    };
    const touch = (list: Reminder[]) => {
      dirty = true;
      set({ list });
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => void save(), debounceMs);
    };

    return {
      list: [],
      loaded: false,
      readError: false,
      saveError: false,

      async load() {
        try {
          const raw = await storage.readReminders();
          set({ list: parseRemindersFile(raw), loaded: true, readError: false });
        } catch {
          set({ list: [], loaded: true, readError: true });
        }
      },

      add(input, now = new Date()) {
        const rem = createReminder({ ...input, id: newId() }, now);
        if (!rem) return null;
        touch([...get().list, rem]);
        return rem;
      },

      update(id, patch) {
        const list = get().list;
        const cur = list.find((r) => r.id === id);
        const next = cur && updateReminder(cur, patch);
        if (!cur || !next) return;
        touch(list.map((r) => (r.id === id ? next : r)));
      },

      remove(id) {
        touch(get().list.filter((r) => r.id !== id));
      },

      snooze(id, by, now = new Date()) {
        const list = get().list;
        if (!list.some((r) => r.id === id)) return;
        touch(list.map((r) => (r.id === id ? snoozeReminder(r, by, now) : r)));
      },

      complete(id, now = new Date()) {
        const list = get().list;
        if (!list.some((r) => r.id === id)) return;
        touch(list.map((r) => (r.id === id ? completeReminder(r, now) : r)));
      },

      flush: save,
    };
  });

  return store;
}

export type RemindersStore = ReturnType<typeof createRemindersStore>;
