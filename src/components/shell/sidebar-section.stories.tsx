import type { Meta, StoryObj } from "@storybook/react-vite";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FilePlus, FolderPlus, Plus } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { SidebarItem } from "./sidebar-item";
import { SidebarSection } from "./sidebar-section";

/** 사이드바 섹션 — 작은 라벨 제목. 제목을 누르면 접힌다. 접기 화살표·＋는 hover/키보드 포커스에서 보인다 */
const meta = {
  title: "L3 셸/SH-SidebarSection",
  component: SidebarSection,
  args: {
    title: "즐겨찾기",
    children: (
      <>
        <SidebarItem emoji="🧭" label="2027 상반기 로드맵" />
        <SidebarItem emoji="🦀" label="Rust 소유권 정리" />
      </>
    ),
  },
  decorators: [(Story) => <div className="w-60 bg-sidebar p-2">{Story()}</div>],
} satisfies Meta<typeof SidebarSection>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 펼침 */
export const Expanded: Story = {};

/** 접힘 */
export const Collapsed: Story = { args: { defaultCollapsed: true } };

/** 추가 버튼이 있는 섹션 */
export const WithAction: Story = {
  args: { title: "문서", action: { label: "새 페이지", icon: Plus, onClick: () => {} } },
};

/** 추가 버튼이 메뉴를 여는 섹션 (페이지 섹션 — 새 페이지 / 새 폴더) */
export const WithActionMenu: Story = {
  args: {
    title: "문서",
    action: {
      label: "추가",
      icon: Plus,
      menu: (
        <>
          <DropdownMenuItem icon={<FilePlus strokeWidth={1.5} />}>새 페이지</DropdownMenuItem>
          <DropdownMenuItem icon={<FolderPlus strokeWidth={1.5} />}>새 폴더</DropdownMenuItem>
        </>
      ),
    },
  },
  play: async ({ canvasElement }) => {
    const add = within(canvasElement).getByRole("button", { name: "추가" });
    add.focus();
    await userEvent.keyboard("{Enter}");
    const menu = await within(document.body).findByRole("menu");
    // 메뉴는 짧게 나타나므로 다 보일 때까지 기다린다
    await waitFor(() =>
      expect(within(menu).getByRole("menuitem", { name: "새 폴더" })).toBeVisible(),
    );
    await expect(add).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(add).toHaveFocus());
  },
};

/** 키보드로 접고 펼치기 */
export const Toggle: Story = {
  play: async ({ canvasElement }) => {
    const head = within(canvasElement).getByRole("button", { name: "즐겨찾기" });
    await userEvent.click(head);
    await expect(head).toHaveAttribute("aria-expanded", "false");
    await expect(within(canvasElement).queryByText("Rust 소유권 정리")).not.toBeVisible();
    head.focus();
    await userEvent.keyboard("{Enter}");
    await expect(head).toHaveAttribute("aria-expanded", "true");
  },
};
