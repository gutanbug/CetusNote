import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState } from "react";
import { QuickInput, type QuickPreview } from "./quick-input";

const PRESETS = [
  { id: "min10", label: "10분 뒤" },
  { id: "min30", label: "30분 뒤" },
  { id: "hour1", label: "1시간 뒤" },
  { id: "tonight6", label: "오늘 저녁 6시" },
  { id: "tomorrow9", label: "내일 오전 9시" },
  { id: "timer25", label: "타이머 25분" },
  { id: "timer50", label: "타이머 50분" },
  { id: "repeatDay", label: "매일 오전 9시" },
  { id: "repeatWeekday", label: "평일 오전 9시" },
  { id: "repeatWeek", label: "매주 오전 9시" },
  { id: "direct", label: "직접 입력…" },
];

const RESULTS = [
  {
    id: "p1",
    title: "주간 회의 안건",
    path: "업무 / 회의",
    highlight: [[0, 2]] as [number, number][],
  },
  {
    id: "p2",
    title: "회의록 2026-11-20",
    path: "업무 / 회의",
    highlight: [[0, 2]] as [number, number][],
  },
  { id: "p3", title: "배포 체크리스트", path: "개발", highlight: [] },
];

const ALARM_PREVIEW: QuickPreview = {
  kind: "alarm",
  primary: "오후 3:01에 알림",
  relative: "1분 뒤",
};

/** 빠른 입력 바(QN-03). 순수 UI — 앱에서는 빠른 입력 창(screens/quick)이 상태와 저장을 맡는다 */
const meta = {
  title: "L5 페이지/PG-QuickInput",
  component: QuickInput,
  args: {
    value: "",
    onValueChange: fn(),
    onSubmit: fn(),
    onEscape: fn(),
    preview: null,
    onClearPreview: fn(),
    presets: PRESETS,
    onPreset: fn(),
    results: [],
    activeIndex: -1,
    onActiveIndexChange: fn(),
    onOpenResult: fn(),
    onAttachResult: fn(),
    timers: [],
    onStopTimer: fn(),
    upcoming: [],
    success: null,
    error: null,
    notice: null,
    alert: null,
    onAlertAction: fn(),
    onAlertDismiss: fn(),
  },
  decorators: (Story) => (
    <div className="w-[680px] bg-app p-4">
      <Story />
    </div>
  ),
} satisfies Meta<typeof QuickInput>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 비어 있을 때: 진행 중인 타이머와 다가오는 알림 */
export const EmptyWithLists: Story = {
  args: {
    timers: [{ id: "t1", label: "차 우리기", left: "03:12" }],
    upcoming: [
      { id: "a1", label: "회의 준비", when: "오후 3:00", relative: "1시간 뒤" },
      { id: "a2", label: "약 먹기", when: "매일 오전 9:00", relative: "내일 오전 9:00" },
    ],
  },
};

/** 예정된 알림이 없을 때: 빈 상태 한 줄 */
export const EmptyNoReminders: Story = {
  args: { upcoming: [] },
};

/** 시각을 알아들으면 입력 아래 행에 보여 준다: 알림·타이머·반복 */
export const Preview: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <QuickInput {...args} value="회의 준비" preview={ALARM_PREVIEW} />
      <QuickInput
        {...args}
        value="스트레칭"
        preview={{ kind: "timer", primary: "25분 타이머", relative: null }}
      />
      <QuickInput
        {...args}
        value="물 마시기"
        preview={{ kind: "repeat", primary: "매일 오전 9:00", relative: "내일 오전 9:00" }}
      />
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    // 시각이 있으면 Enter 힌트가 보인다
    await expect(c.getAllByText("알림 만들기")[0]).toBeVisible();
    // × 는 시각을 무시한다
    await userEvent.click(c.getAllByRole("button", { name: "알림 시각 무시" })[0]);
    await expect(args.onClearPreview).toHaveBeenCalled();
  },
};

/** 저장 뒤 확인: 입력 아래 카드가 확인 행으로 바뀐다 */
export const Success: Story = {
  args: {
    value: "",
    success: { title: "알림을 만들었어요", detail: "오후 3:01 · 1분 뒤" },
  },
};

/** 저장 실패: 입력은 그대로, 위험 색 문구 */
export const SaveError: Story = {
  args: {
    value: "회의 준비",
    preview: ALARM_PREVIEW,
    error: "저장하지 못했어요. 입력은 그대로 두었으니 다시 시도해 주세요",
  },
};

/** 울린 알림: 미루기·완료·열기. 첫 행동 버튼이 포커스를 받는다 */
export const Alert: Story = {
  args: {
    alert: [
      { id: "r1", label: "회의 준비", when: "오후 3:01", canOpen: true },
      { id: "r2", label: "약 먹기", when: "오후 3:00", canOpen: false },
    ],
  },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getAllByRole("button", { name: "10분 뒤" })[0]);
    await expect(args.onAlertAction).toHaveBeenCalledWith("r1", "snooze10");
    await userEvent.click(c.getAllByRole("button", { name: "완료" })[1]);
    await expect(args.onAlertAction).toHaveBeenCalledWith("r2", "done");
    await userEvent.click(c.getByRole("button", { name: "열기" }));
    await expect(args.onAlertAction).toHaveBeenCalledWith("r1", "open");
  },
};

/** 페이지 검색 결과 6개 이하, 선택 행은 ↑/↓로 옮긴다 */
export const Results: Story = {
  args: { value: "회의", results: RESULTS, activeIndex: 0 },
};

/** 시각이 있으면 결과 행마다 알림 붙이기 버튼이 보인다 */
export const ResultsWithPreview: Story = {
  args: {
    value: "회의",
    results: RESULTS,
    activeIndex: 1,
    preview: { kind: "alarm", primary: "오후 3:31에 알림", relative: "30분 뒤" },
  },
};

/** 입력 상태 전환: 입력 → 알림 메뉴 → 항목 선택 */
export const Interactive: Story = {
  render: (args) => {
    const [value, setValue] = useState("");
    const [preview, setPreview] = useState<QuickPreview | null>(null);
    return (
      <QuickInput
        {...args}
        value={value}
        onValueChange={setValue}
        preview={preview}
        onClearPreview={() => setPreview(null)}
        onPreset={(id) => {
          args.onPreset(id);
          setPreview({ kind: "alarm", primary: "10분 뒤에 알림", relative: "10분 뒤" });
        }}
      />
    );
  },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const input = c.getByRole("combobox", { name: "빠른 입력" });
    await userEvent.type(input, "우유 사기");
    await userEvent.click(c.getByRole("button", { name: "알림 설정" }));
    await userEvent.click(await c.findByRole("menuitem", { name: "10분 뒤" }));
    await expect(args.onPreset).toHaveBeenCalledWith("min10");
  },
};

/** 키보드: Escape는 메뉴가 열려 있으면 메뉴만 닫고, 닫혀 있으면 창을 숨긴다 */
export const Keyboard: Story = {
  args: { results: RESULTS, activeIndex: -1 },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const input = c.getByRole("combobox", { name: "빠른 입력" });
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}");
    await expect(args.onActiveIndexChange).toHaveBeenCalledWith(0);
    await userEvent.keyboard("{Escape}");
    await expect(args.onEscape).toHaveBeenCalled();
  },
};
