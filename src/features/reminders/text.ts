import { parseReminderText } from "@/lib/reminder-parse";
import type { NewReminder } from "./store";
import type { Reminder, ReminderTarget } from "./model";

/**
 * 한 줄 입력으로 알림 만들기 (SYS-16). 「내일 9시 회의 준비」처럼 쓴 문장을 알림 하나로 바꾼다.
 * 시각을 알아듣지 못하면 null — 호출하는 쪽이 입력을 그대로 두게 한다.
 */
export type ReminderSink = { add(input: NewReminder, now?: Date): Reminder | null };

export function addReminderFromText(
  sink: ReminderSink,
  text: string,
  target: ReminderTarget,
  now: Date = new Date(),
): Reminder | null {
  const parsed = parseReminderText(text, now);
  const when = parsed.when;
  if (!when) return null;
  if (when.kind === "timer") {
    return sink.add(
      { kind: "timer", target, label: parsed.label, durationSec: when.durationSec },
      now,
    );
  }
  return sink.add(
    { kind: "alarm", target, label: parsed.label, at: when.at, repeat: when.repeat },
    now,
  );
}
