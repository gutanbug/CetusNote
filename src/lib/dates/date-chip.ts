import { formatAbsoluteLabel, formatDateTimeLabel } from "./date-label";
import type { IsoDate, TimeOfDay } from "./local-date";
import {
  isOverdue,
  normalizeReminder,
  reminderStatus,
  type ReminderRule,
  type ReminderStatus,
} from "./reminder";

/** ED-DateChip 노드 속성 (노드 이름 dateChip). 파일 경로가 아니라 값만 가진다 */
export type DateChipValue = {
  date: IsoDate;
  time: TimeOfDay | null;
  reminder: ReminderRule;
  done: boolean;
  /** 만든 시각 (ISO 문자열) — 삽입할 때 채운다 */
  created: string | null;
};

/** 칩을 그리는 데 필요한 파생 값 */
export type DateChipView = {
  /** 본문에 보이는 문구: 「내일 14:30」 */
  label: string;
  /** 마우스를 올렸을 때 문구: 「2026년 11월 28일 (토) 14:30」 */
  title: string;
  overdue: boolean;
  done: boolean;
  reminder: ReminderStatus;
  hasReminder: boolean;
};

export function describeDateChip(value: DateChipValue, now: Date = new Date()): DateChipView {
  const reminder = normalizeReminder(value.reminder);
  return {
    label: formatDateTimeLabel(value.date, value.time, now),
    title: formatAbsoluteLabel(value.date, value.time),
    overdue: isOverdue(value.date, value.time, value.done, now),
    done: value.done,
    reminder: reminderStatus(value.date, value.time, reminder, now),
    hasReminder: reminder.kind !== "none",
  };
}
