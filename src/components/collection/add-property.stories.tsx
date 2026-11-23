import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "@/components/ui/icon-button";
import { Plus } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import { AddPropertyMenu } from "./property";

/** 속성 추가 메뉴 (COLL-08) — 종류 11가지. 표 머리 ＋ · 상세 · 속성 목록에서 연다 */
const meta = {
  title: "L6 컬렉션/CL-AddProperty",
  component: AddPropertyMenu,
  args: {
    onAdd: fn(),
    children: (
      <IconButton label="속성 추가">
        <Plus strokeWidth={1.5} />
      </IconButton>
    ),
  },
  decorators: [(Story) => <div className="bg-app p-6">{Story()}</div>],
} satisfies Meta<typeof AddPropertyMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 키보드로 열어 "다중 선택" 고르기 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    c.getByRole("button", { name: "속성 추가" }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(await body.findAllByRole("menuitem")).toHaveLength(11);
    await userEvent.click(body.getByRole("menuitem", { name: "다중 선택" }));
    await expect(args.onAdd).toHaveBeenCalledWith("multi");
  },
};
