import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateChipValue } from "@/lib/dates/date-chip";
import { formatDateTimeLabel } from "@/lib/dates/date-label";
import { isIsoDate, isTimeOfDay } from "@/lib/dates/local-date";
import { normalizeReminder, NO_REMINDER } from "@/lib/dates/reminder";
import { DateChip, DateChipEditor, type DateChipPatch } from "./date-chip";
import { useMessages } from "@/lib/i18n";

/**
 * ED-DateChip의 Tiptap 인라인 노드 (이름 `dateChip`). 원자 노드라 글자처럼 한 칸을 차지한다.
 * 속성은 DateChipValue와 같다. 노드 뷰는 칩과 편집 팝오버를 그린다.
 * 앱 확장 목록에는 아직 넣지 않는다 — phase 2(슬래시 「날짜」·저장 연결)에서 등록한다.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    dateChip: {
      /** 커서 자리에 날짜 칩을 넣는다. created는 호출한 쪽이 채운다 */
      insertDateChip: (attrs?: Partial<DateChipValue>) => ReturnType;
    };
  }
}

const defaultAttrs: DateChipValue = {
  date: "",
  time: null,
  reminder: NO_REMINDER,
  done: false,
  created: null,
};

function attrsToValue(attrs: Record<string, unknown>): DateChipValue {
  return {
    date: isIsoDate(attrs.date) ? attrs.date : "",
    time: isTimeOfDay(attrs.time) ? attrs.time : null,
    reminder: normalizeReminder(attrs.reminder),
    done: attrs.done === true,
    created: typeof attrs.created === "string" ? attrs.created : null,
  };
}

/** HTML 속성(data-reminder)은 JSON 문자열이다. 깨진 값은 없음으로 본다 */
function parseReminderAttr(raw: string | null): unknown {
  if (!raw) return NO_REMINDER;
  try {
    return JSON.parse(raw);
  } catch {
    return NO_REMINDER;
  }
}

function DateChipNodeView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const m = useMessages();
  const [open, setOpen] = React.useState(false);
  const value = attrsToValue(node.attrs);
  const patch = (p: DateChipPatch) => updateAttributes(p);

  return (
    <NodeViewWrapper as="span" className="inline" data-type="date-chip-view">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <DateChip value={value} selected={selected} open={open} />
        </PopoverTrigger>
        <PopoverContent
          aria-label={m.editor.dateChip.edit}
          className="w-auto max-w-none p-2"
          align="start"
        >
          <DateChipEditor value={value} onChange={patch} onRemove={() => deleteNode()} />
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  );
}

export const DateChipNode = Node.create({
  name: "dateChip",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      date: {
        default: defaultAttrs.date,
        parseHTML: (el) => el.getAttribute("data-date") ?? "",
        renderHTML: (attrs) => ({ "data-date": attrs.date }),
      },
      time: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-time"),
        renderHTML: (attrs) => (attrs.time ? { "data-time": attrs.time } : {}),
      },
      reminder: {
        default: NO_REMINDER,
        parseHTML: (el) => normalizeReminder(parseReminderAttr(el.getAttribute("data-reminder"))),
        renderHTML: (attrs) => ({ "data-reminder": JSON.stringify(attrs.reminder) }),
      },
      done: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-done") === "true",
        renderHTML: (attrs) => (attrs.done ? { "data-done": "true" } : {}),
      },
      created: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-created"),
        renderHTML: (attrs) => (attrs.created ? { "data-created": attrs.created } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="date-chip"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.date
      ? formatDateTimeLabel(node.attrs.date, node.attrs.time ?? null)
      : "";
    return ["span", mergeAttributes({ "data-type": "date-chip" }, HTMLAttributes), label];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DateChipNodeView);
  },

  addCommands() {
    return {
      insertDateChip:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { ...defaultAttrs, ...attrs, date: attrs.date ?? defaultAttrs.date },
          }),
    };
  },
});

export { attrsToValue };
