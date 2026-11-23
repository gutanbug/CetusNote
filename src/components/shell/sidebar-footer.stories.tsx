import type { Meta, StoryObj } from "@storybook/react-vite";
import { SidebarFooter } from "./sidebar-footer";

/** 사이드바 하단 — 휴지통(개수) + 저장 상태 */
const meta = {
  title: "L3 셸/SH-SidebarFooter",
  component: SidebarFooter,
  args: { trashCount: 3, onOpenTrash: () => {}, saveState: "saved" },
  decorators: [(Story) => <div className="w-60 bg-sidebar">{Story()}</div>],
} satisfies Meta<typeof SidebarFooter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SaveError: Story = { args: { saveState: "error", onRetrySave: () => {} } };
