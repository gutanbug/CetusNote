import type { Meta, StoryObj } from "@storybook/react-vite";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Row, Sheet } from "@/debug/specimen";
import { getEditor } from "@/debug/editor-test";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, nextMonday, toIsoDate } from "@/lib/dates/local-date";
import { NO_REMINDER } from "@/lib/dates/reminder";
import type { DateChipValue } from "@/lib/dates/date-chip";
import { useState } from "react";
import { DateChip, DateChipEditor, type DateChipEditorProps } from "./date-chip";
import { DateChipNode } from "./date-chip-node";

// 고정된 「지금」 — 2026-11-24(화) 09:00. 상대 문구가 날짜에 흔들리지 않게 한다.
const NOW = new Date(2026, 10, 24, 9, 0);

const base: DateChipValue = {
  date: "2026-11-24",
  time: null,
  reminder: NO_REMINDER,
  done: false,
  created: null,
};
const v = (patch: Partial<DateChipValue>): DateChipValue => ({ ...base, ...patch });

const meta = {
  title: "L4 에디터/ED-DateChip",
  component: DateChip,
  args: { value: base, now: NOW },
} satisfies Meta<typeof DateChip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 상태 × 변형 — 시트 기준 칩 한 줄씩. force 줄은 hover를 강제한다 */
export const States: Story = {
  render: () => (
    <Sheet>
      <Row name="기본 · 오늘">
        <DateChip value={base} now={NOW} />
      </Row>
      <Row name="내일 · 시각">
        <DateChip value={v({ date: "2026-11-25", time: "14:30" })} now={NOW} />
      </Row>
      <Row name="2일 뒤 · 날짜">
        <DateChip value={v({ date: "2026-11-26" })} now={NOW} />
        <DateChip value={v({ date: "2026-12-01" })} now={NOW} />
        <DateChip value={v({ date: "2027-01-03" })} now={NOW} />
      </Row>
      <Row name="기한 지남">
        <DateChip value={v({ date: "2026-11-20" })} now={NOW} />
      </Row>
      <Row name="알림 설정">
        <DateChip
          value={v({
            date: "2026-11-26",
            time: "10:00",
            reminder: { kind: "before", minutes: 60 },
          })}
          now={NOW}
        />
        <DateChip value={v({ date: "2026-11-24", reminder: { kind: "morning" } })} now={NOW} />
      </Row>
      <Row name="완료">
        <DateChip value={v({ date: "2026-11-20", done: true })} now={NOW} />
      </Row>
      <Row name="선택 (노드 선택)">
        <DateChip value={base} now={NOW} selected />
      </Row>
      <Row name="열림">
        <DateChip value={base} now={NOW} open />
      </Row>
      <Row name="hover" force="hover">
        <DateChip value={base} now={NOW} />
        <DateChip value={v({ date: "2026-11-20" })} now={NOW} />
      </Row>
    </Sheet>
  ),
};

/** 누르면 날짜 팝오버. 빠른 선택은 「지금」 기준이다 */
export const WithPopover: Story = {
  render: () => {
    const [value, setValue] = useState<DateChipValue>(v({ date: "2026-11-25" }));
    const [open, setOpen] = useState(false);
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <DateChip value={value} now={NOW} open={open} />
        </PopoverTrigger>
        <PopoverContent aria-label="날짜 편집" className="w-auto max-w-none p-2" align="start">
          <DateChipEditor
            value={value}
            now={NOW}
            onChange={(patch) => setValue((s) => ({ ...s, ...patch }))}
            onRemove={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /내일/ }));
    await within(document.body).findByRole("dialog", { name: "날짜 편집" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).toBeNull());
  },
};

/** 편집 내용만 — 빠른 선택 · 달력 · 시간 · 알림 · 완료 · 제거 */
function EditorBody(args: Partial<DateChipEditorProps>) {
  const [value, setValue] = useState<DateChipValue>(
    v({ date: "2026-11-25", time: "09:30", reminder: { kind: "before", minutes: 10 } }),
  );
  return (
    <div className="inline-block rounded-lg bg-elevated p-1 shadow-popover">
      <DateChipEditor
        {...args}
        value={value}
        now={NOW}
        onChange={(patch) => {
          setValue((s) => ({ ...s, ...patch }));
          args.onChange?.(patch);
        }}
        onRemove={args.onRemove}
      />
    </div>
  );
}

export const Editor: Story = {
  render: () => <EditorBody onChange={fn()} onRemove={fn()} />,
};

/** 시각을 지우면 「N분 전」 알림은 없음으로 바뀐다 (기준 시각이 없어짐) */
export const ClearTimeResetsReminder: Story = {
  render: () => <EditorBody onChange={fn()} />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement);
    const select = body.getByRole("combobox");
    await expect((select as HTMLSelectElement).value).toBe("before-10");
    // 시각 입력은 키보드로 지우기 어려워 값을 직접 넣고 input 이벤트를 보낸다(React가 받는 방식)
    const time = canvasElement.querySelector<HTMLInputElement>('input[type="time"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setValue.call(time, "");
    time.dispatchEvent(new Event("input", { bubbles: true }));
    await waitFor(() =>
      expect((body.getByRole("combobox") as HTMLSelectElement).value).toBe("none"),
    );
  },
};

/** 칩에 시각만 있어도 「시간 지정」 알림은 그 시각을 따른다. 알림 시각을 따로 고치면 칩 시각을 따라가지 않는다 */
function FollowDemo() {
  const [value, setValue] = useState<DateChipValue>(v({ date: "2026-11-25", time: "14:30" }));
  return (
    <div className="inline-block rounded-lg bg-elevated p-1 shadow-popover">
      <DateChipEditor
        value={value}
        now={NOW}
        onChange={(patch) => setValue((s) => ({ ...s, ...patch }))}
      />
    </div>
  );
}

export const ReminderFollowsTime: Story = {
  render: () => <FollowDemo />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement);
    // 시각 입력은 키보드로 지우기 어려워 값을 직접 넣고 input 이벤트를 보낸다(React가 받는 방식)
    const setInput = (el: HTMLInputElement, next: string) => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setValue.call(el, next);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const chipTime = () => canvasElement.querySelector<HTMLInputElement>('input[type="time"]')!;
    const alarmTime = () => body.getByLabelText("알림 시각") as HTMLInputElement;

    await userEvent.selectOptions(body.getByRole("combobox"), "custom");
    await expect(alarmTime().value).toBe("14:30");
    await expect(body.getByText("시간과 같은 시각에 알려요")).toBeInTheDocument();

    // 칩 시각을 옮기면 알림도 같이 간다
    setInput(chipTime(), "15:00");
    await waitFor(() => expect(alarmTime().value).toBe("15:00"));

    // 알림 시각을 따로 고치면 이후 칩 시각을 바꿔도 그대로 둔다
    setInput(alarmTime(), "08:15");
    await waitFor(() => expect(alarmTime().value).toBe("08:15"));
    await expect(body.getByText("시간과 따로 정한 시각에 알려요")).toBeInTheDocument();
    setInput(chipTime(), "16:00");
    await waitFor(() => expect(chipTime().value).toBe("16:00"));
    await expect(alarmTime().value).toBe("08:15");
  },
};

/** 본문 안의 칩: 노드 뷰 + 날짜 팝오버. Enter로 열고 「다음 주 월요일」을 고른다 */
function InEditorDemo() {
  const editor = useEditor({
    extensions: [StarterKit, DateChipNode],
    content: `<p>회의 자료는 <span data-type="date-chip" data-date="${toIsoDate(addDays(new Date(), 1))}"></span> 까지 정리해요.</p>`,
    immediatelyRender: false,
    editorProps: { attributes: { "aria-label": "본문 견본" } },
  });
  return (
    <div className="max-w-(--content-w)">
      <EditorContent editor={editor} />
    </div>
  );
}

export const InEditor: Story = {
  render: () => <InEditorDemo />,
  play: async ({ canvasElement }) => {
    const editor = await waitFor(() => getEditor(canvasElement));
    const chip = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLButtonElement>('[data-slot="date-chip"]');
      if (!el) throw new Error("칩이 아직 없다");
      return el;
    });
    chip.focus();
    await userEvent.keyboard("{Enter}");
    const dialog = await within(document.body).findByRole("dialog", { name: "날짜 편집" });
    await userEvent.click(within(dialog).getByRole("button", { name: "다음 주 월요일" }));
    const expected = toIsoDate(nextMonday(new Date()));
    let date: unknown;
    editor.state.doc.descendants((n) => {
      if (n.type.name === "dateChip") date = n.attrs.date;
    });
    await expect(date).toBe(expected);
    await userEvent.keyboard("{Escape}");
  },
};
