import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { SidebarSpecimen } from "@/debug/shell-sample";

/** 사이드바 틀 — 위(워크스페이스) · 가운데(스크롤 섹션) · 아래(휴지통·저장 상태). 오른쪽 끝을 끌어 너비 조절 */
const meta = {
  title: "L3 셸/SH-Sidebar",
  component: SidebarSpecimen,
} satisfies Meta<typeof SidebarSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 펼침 */
export const Expanded: Story = {};

/** 접힘 — 너비 0, 안의 요소는 포커스를 받지 않는다 */
export const Collapsed: Story = {
  args: { collapsed: true },
  play: async ({ canvasElement }) => {
    const aside = canvasElement.querySelector("aside")!;
    await expect(aside).toHaveAttribute("inert");
    await expect(aside).toHaveAttribute("data-collapsed", "true");
  },
};

/** macOS 앱(SYS-05) — 맨 위에 신호등 버튼 자리(상단 바 높이)를 비운다. 이 줄을 끌면 창이 움직인다 */
export const TitleBarInset: Story = {
  args: { titleBarInset: true },
  play: async ({ canvasElement }) => {
    const inset = canvasElement.querySelector("[data-slot=title-bar-inset]")!;
    await expect(inset).toHaveAttribute("data-tauri-drag-region");
  },
};
