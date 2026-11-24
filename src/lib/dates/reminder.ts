import {
  atTime,
  dayDiff,
  isTimeOfDay,
  parseIsoDate,
  type IsoDate,
  type TimeOfDay,
} from "./local-date";

/**
 * 날짜 칩의 알림 규칙 (EDIT-37). 노드 속성 `reminder`에 JSON으로 저장한다.
 * - none: 알림 없음
 * - morning: 당일 9시 (시각 없는 날짜도 쓴다)
 * - custom: 같은 날 지정한 시각(HH:mm)
 * - before: 날짜·시각 기준 N분 전 (시각이 있어야 쓴다; 1440 = 1일 전)
 */
export type ReminderRule =
  | { kind: "none" }
  | { kind: "morning" }
  | { kind: "custom"; time: TimeOfDay }
  | { kind: "before"; minutes: 10 | 60 | 1440 };

export const NO_REMINDER: ReminderRule = { kind: "none" };

/** 고를 수 있는 알림 선택지. 키는 select의 value로 쓴다 */
export const REMINDER_OPTIONS = [
  { key: "none", label: "없음", rule: NO_REMINDER, needsTime: false },
  { key: "morning", label: "당일 9시", rule: { kind: "morning" }, needsTime: false },
  { key: "custom", label: "시간 지정", rule: { kind: "custom", time: "09:00" }, needsTime: true },
  {
    key: "before-10",
    label: "10분 전",
    rule: { kind: "before", minutes: 10 },
    needsTime: true,
  },
  {
    key: "before-60",
    label: "1시간 전",
    rule: { kind: "before", minutes: 60 },
    needsTime: true,
  },
  {
    key: "before-1440",
    label: "1일 전",
    rule: { kind: "before", minutes: 1440 },
    needsTime: true,
  },
] as const satisfies readonly {
  key: string;
  label: string;
  rule: ReminderRule;
  needsTime: boolean;
}[];

export type ReminderOptionKey = (typeof REMINDER_OPTIONS)[number]["key"];

/** 규칙 → 선택지 키 (규칙이 custom이어도 키는 "custom") */
export function reminderOptionKey(rule: ReminderRule): ReminderOptionKey {
  switch (rule.kind) {
    case "none":
      return "none";
    case "morning":
      return "morning";
    case "custom":
      return "custom";
    case "before":
      return `before-${rule.minutes}` as ReminderOptionKey;
  }
}

/** 시각이 없을 때 "N분 전"·"시간 지정"은 고를 수 없다 */
export function isReminderOptionEnabled(key: ReminderOptionKey, time: TimeOfDay | null): boolean {
  const option = REMINDER_OPTIONS.find((o) => o.key === key);
  return !option?.needsTime || time !== null;
}

/**
 * 알림이 울릴 시각(로컬). 규칙이 없거나 계산할 수 없으면 null.
 * 기준 날짜가 잘못되었거나 「N분 전」인데 시각이 없으면 null.
 */
export function computeReminderAt(
  date: IsoDate,
  time: TimeOfDay | null,
  rule: ReminderRule,
): Date | null {
  const day = parseIsoDate(date);
  if (!day) return null;
  switch (rule.kind) {
    case "none":
      return null;
    case "morning":
      return atTime(day, "09:00");
    case "custom":
      return atTime(day, rule.time);
    case "before": {
      const at = atTime(day, time);
      return at ? new Date(at.getTime() - rule.minutes * 60_000) : null;
    }
  }
}

export type ReminderStatus = "none" | "scheduled" | "passed";

/** 알림 상태. 시각이 지났으면 passed(앱을 켜면 놓친 알림으로 보여 준다) */
export function reminderStatus(
  date: IsoDate,
  time: TimeOfDay | null,
  rule: ReminderRule,
  now: Date = new Date(),
): ReminderStatus {
  const at = computeReminderAt(date, time, rule);
  if (!at) return "none";
  return at.getTime() <= now.getTime() ? "passed" : "scheduled";
}

/**
 * 기한이 지났는가. 완료하지 않았고, 날짜가 지났거나 같은 날 시각이 지났을 때.
 * 시각이 없는 같은 날은 지난 것이 아니다.
 */
export function isOverdue(
  date: IsoDate,
  time: TimeOfDay | null,
  done: boolean,
  now: Date = new Date(),
): boolean {
  if (done) return false;
  const day = parseIsoDate(date);
  if (!day) return false;
  const diff = dayDiff(now, day);
  if (diff < 0) return true;
  if (diff > 0) return false;
  const at = atTime(day, time);
  return at !== null && at.getTime() <= now.getTime();
}

/**
 * 저장된 알림 값(노드 속성·파일 JSON)을 규칙으로 읽는다. 모르는 모양이면 none.
 * 시각 형식이 틀린 custom도 none으로 본다.
 */
export function normalizeReminder(raw: unknown): ReminderRule {
  if (!raw || typeof raw !== "object") return NO_REMINDER;
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case "morning":
      return { kind: "morning" };
    case "custom":
      return isTimeOfDay(r.time) ? { kind: "custom", time: r.time } : NO_REMINDER;
    case "before":
      return r.minutes === 10 || r.minutes === 60 || r.minutes === 1440
        ? { kind: "before", minutes: r.minutes }
        : NO_REMINDER;
    default:
      return NO_REMINDER;
  }
}
