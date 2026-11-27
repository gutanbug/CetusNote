import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState } from "react";
import { QuickInput, type QuickInputProps } from "./quick-input";

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

/** 빠른 입력 바(QN-03). 순수 UI — 앱에서는 빠른 입력 창(screens/quick)이 상태와 저장을 맡는다 */
const meta = {
  title: "L5 페이지/PG-QuickInput",
  component: QuickInput,
  args: {
    value: "",
    onValueChange: fn(),
    onSubmit: fn(),
    onEscape: fn(),
    chip: null,
    onClearChip: fn(),
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
    confirmation: null,
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
export const Empty: Story = {
  args: {
    timers: [{ id: "t1", label: "차 우리기", left: "03:12" }],
    upcoming: [
      { id: "a1", label: "회의 준비", when: "오후 3:00" },
      { id: "a2", label: "약 먹기", when: "매일 오전 9:00" },
    ],
  },
};

/** 시간 칩: 문장에서 알아들은 시각을 보여 주고 × 로 무시한다 */
export const WithChip: Story = {
  args: {
    value: "회의 준비",
    chip: { text: "내일 9:00", kind: "alarm" },
  },
};

/** 타이머 칩과 반복 칩 */
export const TimerAndRepeat: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <QuickInput {...args} value="스트레칭" chip={{ text: "25분", kind: "timer" }} />
      <QuickInput {...args} value="물 마시기" chip={{ text: "매일 9:00", kind: "repeat" }} />
    </div>
  ),
};

/** 페이지 검색 결과 6개 이하, 선택 행은 ↑/↓로 옮긴다 */
export const Results: Story = {
  args: { value: "회의", results: RESULTS, activeIndex: 0, chip: null },
};

/** 시간 칩이 있으면 결과 행마다 알림 붙이기 버튼이 보인다 */
export const ResultsWithChip: Story = {
  args: {
    value: "회의",
    results: RESULTS,
    activeIndex: 1,
    chip: { text: "30분 뒤", kind: "alarm" },
  },
};

/** 저장 뒤 짧은 확인 문구 */
export const Confirmation: Story = {
  args: { value: "", confirmation: "저장했어요 · 내일 9:00 알림" },
};

/** 입력 상태 전환: 입력 → 알림 메뉴 → 항목 선택 */
export const Interactive: Story = {
  render: (args) => {
    const [value, setValue] = useState("");
    const [chip, setChip] = useState<QuickInputProps["chip"]>(null);
    return (
      <QuickInput
        {...args}
        value={value}
        onValueChange={setValue}
        chip={chip}
        onClearChip={() => setChip(null)}
        onPreset={(id) => {
          args.onPreset(id);
          setChip({ text: "10분 뒤", kind: "alarm" });
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
