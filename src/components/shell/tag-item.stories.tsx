import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { TagItem } from "./tag-item";

/** 사이드바 태그 — 색 점 + 이름 + 개수. 기본 · hover(툴바 상태 강제) · 선택 */
const meta = {
  title: "L3 셸/SH-TagItem",
  component: TagItem,
  args: { name: "회의", color: "blue", count: 8, onClick: fn() },
  decorators: [(Story) => <div className="grid w-60 gap-0.5 bg-sidebar p-2">{Story()}</div>],
} satisfies Meta<typeof TagItem>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 여러 색 · 선택 · 긴 이름 · 0개 */
export const List: Story = {
  render: () => (
    <>
      <TagItem name="회의" color="blue" count={8} />
      <TagItem name="기획" color="purple" count={5} active />
      <TagItem name="개인" color="green" count={3} />
      <TagItem name="공부" color="orange" count={2} />
      <TagItem name="여행 — 제주, 부산, 강릉 일정 모음" color="pink" count={12} />
      <TagItem name="보관" count={0} />
    </>
  ),
};

/** 행의 ··· 메뉴(SHELL-18): 누르면 행을 넘겨 태그 메뉴를 연다 */
export const WithMenu: Story = {
  args: { onMenu: fn() },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "회의 태그 메뉴" }));
    await expect(args.onMenu).toHaveBeenCalledTimes(1);
    await expect(args.onMenu).toHaveBeenCalledWith(
      expect.objectContaining({ dataset: expect.objectContaining({ slot: "tag-item" }) }),
    );
  },
};

/** 키보드: Tab으로 와서 Enter로 연다. 이름과 개수를 함께 읽는다 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const item = c.getByRole("button", { name: /^회의.*8/ });
    await userEvent.tab();
    await expect(item).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalled();
  },
};
