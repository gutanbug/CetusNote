import type { IsoDate, TimeOfDay } from "./local-date";
import { normalizeReminder, type ReminderRule } from "./reminder";

/** 문서 안의 날짜 칩 알림 한 건 (EDIT-37). 스케줄러가 읽는 입력이다 */
export type DateReminder = {
  pageId: string;
  date: IsoDate;
  time: TimeOfDay | null;
  rule: ReminderRule;
  done: boolean;
};

/** Tiptap JSON 노드의 모양만 필요하다 */
type DocNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
};

/**
 * 문서(Tiptap JSON)에서 알림이 켜진 날짜 칩을 모은다. 알림 없음(none)인 칩은 빼고, 문서 순서를 지킨다.
 * 순수 함수 — 저장·알림 호출은 부르는 쪽이 한다.
 */
export function collectReminders(doc: DocNode, pageId: string): DateReminder[] {
  const out: DateReminder[] = [];
  const walk = (node: DocNode) => {
    if (node.type === "dateChip") {
      const rule = normalizeReminder(node.attrs?.reminder);
      if (rule.kind !== "none") {
        const time = node.attrs?.time;
        out.push({
          pageId,
          date: String(node.attrs?.date ?? ""),
          time: typeof time === "string" && time ? time : null,
          rule,
          done: node.attrs?.done === true,
        });
      }
    }
    for (const child of node.content ?? []) walk(child);
  };
  walk(doc);
  return out;
}
