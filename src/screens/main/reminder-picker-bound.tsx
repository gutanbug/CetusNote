import {
  ReminderPicker,
  type RepeatChoice,
  type ReminderPickerOption,
} from "@/components/page/reminder-picker";
import {
  addReminderFromText,
  formatReminderWhen,
  remindersStore,
  useReminders,
} from "@/features/reminders";
import { reminderPresets } from "@/features/reminders/presets";
import { remindersFor } from "@/features/reminders/store";
import type { Reminder, ReminderTarget } from "@/features/reminders/model";
import { parseReminderText } from "@/lib/reminder-parse";
import { useMessages } from "@/lib/i18n";

/**
 * 알림 고르기 패널을 저장 스토어에 묶은 것 (SYS-16). 페이지 상단 종 · 페이지 메뉴 「알림…」 ·
 * 빠른 메모 종이 같은 패널을 쓴다. 대상(`target`)에 걸린 알림만 보여 준다.
 */
export function BoundReminderPicker({
  target,
  title,
  className,
}: {
  target: ReminderTarget;
  /** 알림 제목으로 쓸 이름(페이지 제목·메모 첫 줄) */
  title?: string;
  className?: string;
}) {
  const m = useMessages();
  const copy = m.screens.reminders;
  const list = useReminders((s) => s.list);
  const active = remindersFor(list, target);
  const label = title?.trim() || m.features.reminders.untitled;

  const presets: ReminderPickerOption[] = [];
  const now = new Date();
  for (const spec of reminderPresets(now)) {
    presets.push({
      id: spec.id,
      label: copy.presets[spec.id],
      when: formatReminderWhen(
        { id: spec.id, kind: "alarm", target, label, at: spec.at, createdAt: now.toISOString() },
        now,
      ),
    });
  }

  const addAlarm = (at: string, repeat?: RepeatChoice) => {
    remindersStore
      .getState()
      .add(
        { kind: "alarm", target, label, at, ...(repeat && repeat !== "none" ? { repeat } : {}) },
        new Date(),
      );
  };

  return (
    <ReminderPicker
      className={className}
      items={active.map((r: Reminder) => ({
        id: r.id,
        label: r.label || m.features.reminders.untitled,
        when: formatReminderWhen(r, new Date()),
      }))}
      presets={presets}
      parse={(text) => {
        const parsed = parseReminderText(text, new Date());
        if (!parsed.when) return null;
        const when =
          parsed.when.kind === "timer"
            ? m.features.reminders.remainingMinutes(Math.round(parsed.when.durationSec / 60))
            : formatReminderWhen(
                {
                  id: "preview",
                  kind: "alarm",
                  target,
                  label: parsed.label,
                  at: parsed.when.at,
                  repeat: parsed.when.repeat,
                  createdAt: new Date().toISOString(),
                },
                new Date(),
              );
        return { label: parsed.label, when };
      }}
      onSubmitText={(text) => addReminderFromText(text, target, new Date()) !== null}
      onPreset={(id) => {
        const spec = reminderPresets(new Date()).find((p) => p.id === id);
        if (spec) addAlarm(spec.at);
      }}
      onTimer={(minutes) =>
        remindersStore.getState().add({ kind: "timer", target, label, durationSec: minutes * 60 })
      }
      onManual={({ date, time, repeat }) => addAlarm(`${date}T${time}`, repeat)}
      onRemove={(id) => remindersStore.getState().remove(id)}
    />
  );
}
