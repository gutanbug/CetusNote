import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, GripVertical } from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { BlockMenu } from "./block-menu";

const ITEMS = [
  { id: "add", label: "아래에 블록 추가", icon: <Plus strokeWidth={1.5} /> },
  { id: "select", label: "끌어서 옮기기 · 블록 선택", icon: <GripVertical strokeWidth={1.5} /> },
];

/**
 * ED-BlockHandle의 키보드 메뉴 (⌘/) — 목록은 블록 옆에 붙고, 열리면 첫 항목에 포커스가 간다.
 * ↑↓ · Home · End로 옮기고, Enter로 고르고, Esc·Tab·바깥 누름은 닫는다(포커스는 호출한 쪽이 돌려준다).
 */
const meta = {
  title: "L4 에디터/ED-BlockHandle",
  component: BlockMenu,
  args: {
    label: "블록 메뉴",
    items: ITEMS,
    anchor: () => new DOMRect(120, 120, 600, 24),
    onSelect: () => {},
    onClose: () => {},
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-80 p-6">
        <div className="max-w-(--content-w) rounded-md bg-app p-3 text-body">
          블록 메뉴가 붙을 자리
        </div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BlockMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 열린 상태 — 첫 항목에 포커스 */
export const MenuOpen: Story = {
  play: async ({ canvasElement }) => {
    const menu = within(canvasElement.ownerDocument.body).getByRole("menu", { name: "블록 메뉴" });
    await waitFor(() =>
      expect(within(menu).getByRole("menuitem", { name: "아래에 블록 추가" })).toHaveFocus(),
    );
  },
};

/** ↓로 옮기고 Enter로 고르면 onSelect가 그 항목 id로 불린다 */
export const MenuKeyboardSelect: Story = {
  args: { onSelect: fn() },
  play: async ({ canvasElement, args }) => {
    const doc = canvasElement.ownerDocument.body;
    await userEvent.keyboard("{ArrowDown}");
    await expect(
      within(doc).getByRole("menuitem", { name: "끌어서 옮기기 · 블록 선택" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSelect).toHaveBeenCalledWith("select");
  },
};
