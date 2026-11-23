import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { LONG_PATH, SAMPLE_PATH } from "@/debug/shell-data";
import { Breadcrumb } from "./breadcrumb";

/** 브레드크럼 — 경로, 지금 페이지는 강조, 길면 가운데를 “…” 메뉴로 접는다 */
const meta = {
  title: "L3 셸/SH-Breadcrumb",
  component: Breadcrumb,
  args: { items: SAMPLE_PATH },
  decorators: [(Story) => <div className="flex max-w-140 bg-app">{Story()}</div>],
} satisfies Meta<typeof Breadcrumb>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 · hover */
export const Default: Story = {};

/** 한 단계 */
export const Single: Story = { args: { items: [SAMPLE_PATH[0]] } };

/** 긴 경로 — 생략(…) */
export const Collapsed: Story = {
  args: { items: LONG_PATH },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "숨긴 경로 3개" }));
    const menu = await within(document.body).findByRole("menu");
    await expect(within(menu).getAllByRole("menuitem")).toHaveLength(3);
    await userEvent.keyboard("{Escape}");
  },
};
