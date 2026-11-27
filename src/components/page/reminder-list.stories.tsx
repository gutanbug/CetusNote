import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReminderList, type ReminderListSection } from "./reminder-list";

const NOW = new Date(2026, 10, 27, 10, 0);

const SECTIONS: ReminderListSection[] = [
  {
    key: "running",
    rows: [{ id: "t1", title: "차 식기 전에", when: "", endsAt: NOW.getTime() + 754_000 }],
  },
  {
    key: "overdue",
    rows: [{ id: "o1", title: "회의 자료 정리", note: "보고서 초안", when: "어제 17:30" }],
  },
  {
    key: "today",
    rows: [
      { id: "r1", title: "회의 자료 보내기", note: "배포 일정", when: "오늘 15:00" },
      { id: "r2", title: "빠른 메모: 장보기", note: "우유, 달걀", when: "오늘 18:00" },
    ],
  },
  {
    key: "repeating",
    rows: [{ id: "r3", title: "물 마시기", when: "매일 9:00" }],
  },
  {
    key: "done",
    rows: [{ id: "d1", title: "주간 회고", when: "어제 11:20", done: true }],
  },
];

/** 알림 보기 목록(SYS-16). 묶음·시각 문구는 화면 층이 만들어 넘긴다. 앱에서는 알림 화면 본문 */
const meta = {
  title: "L5 페이지/PG-ReminderList",
  component: ReminderList,
  parameters: { debug: { isolate: true } },
  args: {
    sections: SECTIONS,
    now: NOW,
    onOpen: fn(),
    onSnooze: fn(),
    onComplete: fn(),
    onDelete: fn(),
  },
  decorators: (Story) => (
    <TooltipProvider>
      <div className="w-[min(100%,40rem)] p-4">
        <Story />
      </div>
    </TooltipProvider>
  ),
} satisfies Meta<typeof ReminderList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { sections: [] } };

/** 키보드: ↑/↓로 행 사이를 옮기고 Enter로 대상을 연다 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const first = c.getByRole("button", { name: "차 식기 전에" });
    first.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(c.getByRole("button", { name: "회의 자료 정리 보고서 초안" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(c.getByRole("button", { name: "회의 자료 보내기 배포 일정" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpen).toHaveBeenCalledWith("r1");
  },
};

/** 행 동작: 미루기 메뉴, 끝내기, 멈추기(타이머), 삭제 */
export const Actions: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "물 마시기 미루기" }));
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "1시간 뒤" }));
    await expect(args.onSnooze).toHaveBeenCalledWith("r3", "hour1");

    await userEvent.click(c.getByRole("button", { name: "회의 자료 보내기 끝내기" }));
    await expect(args.onComplete).toHaveBeenCalledWith("r1");

    await userEvent.click(c.getByRole("button", { name: "차 식기 전에 멈추기" }));
    await expect(args.onComplete).toHaveBeenCalledWith("t1");

    await userEvent.click(c.getByRole("button", { name: "빠른 메모: 장보기 알림 삭제" }));
    await expect(args.onDelete).toHaveBeenCalledWith("r2");
  },
};
