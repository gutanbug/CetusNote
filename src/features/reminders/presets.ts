import { formatLocal, type RepeatRule } from "./model";

/**
 * 알림 빠른 시각 (SYS-16). 「10분 뒤」「오늘 저녁 6시」처럼 누르면 바로 정해지는 시각을 계산한다.
 * 표시 이름은 화면이 붙인다. 여기서는 울릴 시각(지역 「YYYY-MM-DDTHH:mm」)만 만든다.
 */
export type ReminderPresetId = "min10" | "hour1" | "tonight6" | "tomorrow9" | "monday9";

export type ReminderPresetSpec = {
  id: ReminderPresetId;
  at: string;
  repeat?: RepeatRule;
};

const MINUTE_MS = 60_000;

/** 지금이 18시 전이면 오늘 18시, 지났으면 내일 18시 */
export function reminderPresets(now: Date): ReminderPresetSpec[] {
  const day = (n: number, h: number, min = 0) =>
    formatLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n, h, min));
  const evening = now.getHours() < 18 ? 0 : 1;
  // 월=0 … 일=6. 다음 주 월요일은 항상 1~7일 뒤
  const toMonday = (8 - now.getDay()) % 7 || 7;
  return [
    { id: "min10", at: formatLocal(new Date(now.getTime() + 10 * MINUTE_MS)) },
    { id: "hour1", at: formatLocal(new Date(now.getTime() + 60 * MINUTE_MS)) },
    { id: "tonight6", at: day(evening, 18) },
    { id: "tomorrow9", at: day(1, 9) },
    { id: "monday9", at: day(toMonday, 9) },
  ];
}
