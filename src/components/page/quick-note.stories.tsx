import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { popoverSurface } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { QuickNote } from "./quick-note";

const NOTES = [
  { id: "q3", text: "토요일 장보기: 우유, 달걀, 사과", when: "방금" },
  {
    id: "q2",
    text: "다음 회의 안건\n- 배포 일정 다시 잡기\n- 디자인 리뷰 담당 정하기",
    when: "12분 전",
  },
  { id: "q1", text: "Rust 수명 표기, 예제 하나 더 찾아보기", when: "어제" },
];

/** 빠른 메모 — 페이지를 만들지 않고 생각을 던져 두는 패널. 앱에서는 사이드바 팝오버(⌘⇧N) */
const meta = {
  title: "L5 페이지/PG-QuickNote",
  component: QuickNote,
  args: { notes: NOTES, onSave: fn(() => true), onPromote: fn(), onDelete: fn(), onClose: fn() },
  decorators: (Story) => (
    <div className={cn(popoverSurface, "w-80 p-0")}>
      <Story />
    </div>
  ),
} satisfies Meta<typeof QuickNote>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 메모가 없을 때 */
export const Empty: Story = { args: { notes: [] } };

/** 키보드: ⌘↵로 저장하면 입력 칸이 비고, 저장에 실패하면 글이 남는다 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const input = c.getByRole("textbox", { name: "새 메모" });
    await userEvent.click(input);
    await userEvent.keyboard("우산 챙기기{Meta>}{Enter}{/Meta}");
    await expect(args.onSave).toHaveBeenCalledWith("우산 챙기기");
    await expect(input).toHaveValue("");

    (args.onSave as ReturnType<typeof fn>).mockReturnValueOnce(false);
    await userEvent.keyboard("잃으면 안 되는 생각{Meta>}{Enter}{/Meta}");
    await expect(input).toHaveValue("잃으면 안 되는 생각");

    await userEvent.click(c.getAllByRole("button", { name: "메모 삭제" })[0]!);
    await expect(args.onDelete).toHaveBeenCalledWith("q3");
    await userEvent.click(c.getAllByRole("button", { name: "페이지로" })[1]!);
    await expect(args.onPromote).toHaveBeenCalledWith("q2");
  },
};
