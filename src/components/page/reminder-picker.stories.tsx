import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { popoverSurface } from "@/components/ui/styles";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ReminderPicker } from "./reminder-picker";

const ITEMS = [
  { id: "r1", label: "회의 자료 보내기", when: "오늘 15:00" },
  { id: "r2", label: "물 마시기", when: "매일 9:00" },
  { id: "r3", label: "차 식기 전에", when: "12분 남음" },
];

const PRESETS = [
  { id: "min10", label: "10분 뒤", when: "오늘 10:10" },
  { id: "hour1", label: "1시간 뒤", when: "오늘 11:00" },
  { id: "tonight6", label: "오늘 저녁 6시", when: "오늘 18:00" },
  { id: "tomorrow9", label: "내일 오전 9시", when: "내일 9:00" },
  { id: "monday9", label: "다음 주 월요일 9시", when: "12월 1일 9:00" },
];

/** 페이지·빠른 메모의 알림 고르기 패널. 앱에서는 머리 종 버튼의 팝오버 안에 들어간다 */
const meta = {
  title: "L5 페이지/PG-ReminderPicker",
  component: ReminderPicker,
  parameters: { debug: { isolate: true } },
  args: {
    items: ITEMS,
    presets: PRESETS,
    timerMinutes: [25, 50],
    today: new Date(2026, 10, 27, 10, 0),
    parse: (text: string) =>
      text.includes("9시") ? { label: text.replace("9시", "").trim(), when: "내일 9:00" } : null,
    onSubmitText: fn(() => true),
    onPreset: fn(),
    onTimer: fn(),
    onManual: fn(),
    onRemove: fn(),
  },
  decorators: (Story) => (
    <TooltipProvider>
      <div className={cn(popoverSurface, "p-0")}>
        <Story />
      </div>
    </TooltipProvider>
  ),
} satisfies Meta<typeof ReminderPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { items: [] } };

/** 키보드: 입력 → 미리보기 → Enter로 만들고 입력을 비운다. 프리셋·수동 추가·삭제 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const input = c.getByRole("textbox", { name: "알림 내용과 시각" });
    await userEvent.click(input);
    await userEvent.keyboard("회의 준비 내일 9시");
    await expect(c.getByText(/이렇게 알아들었어요/)).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmitText).toHaveBeenCalledWith("회의 준비 내일 9시");
    await expect(input).toHaveValue("");

    await userEvent.click(c.getByRole("button", { name: "25분" }));
    await expect(args.onTimer).toHaveBeenCalledWith(25);

    await userEvent.click(c.getByRole("button", { name: "1시간 뒤" }));
    await expect(args.onPreset).toHaveBeenCalledWith("hour1");

    await userEvent.click(c.getByRole("button", { name: "매주" }));
    await userEvent.click(c.getByRole("button", { name: "알림 추가" }));
    await expect(args.onManual).toHaveBeenCalledWith(expect.objectContaining({ repeat: "week" }));

    await userEvent.click(c.getByRole("button", { name: "물 마시기 알림 삭제" }));
    await expect(args.onRemove).toHaveBeenCalledWith("r2");
  },
};
