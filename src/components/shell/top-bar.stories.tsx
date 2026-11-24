import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, Download, Trash2 } from "lucide-react";
import { SAMPLE_PATH } from "@/debug/shell-data";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { OutlineItems } from "@/components/ui/outline";
import { Breadcrumb } from "./breadcrumb";
import { TopBar } from "./top-bar";

const ic = { strokeWidth: 1.5 } as const;

/** 상단 바 — 사이드바 토글 · 경로 · 편집 시각 · 즐겨찾기 · 집중 모드 · 페이지 메뉴 (높이 44) */
const meta = {
  title: "L3 셸/SH-TopBar",
  component: TopBar,
  args: {
    breadcrumb: <Breadcrumb items={SAMPLE_PATH} />,
    editedAt: "3분 전 편집",
    onToggleSidebar: () => {},
    onToggleFavorite: () => {},
    onFocusMode: () => {},
    pageMenu: (
      <>
        <DropdownMenuItem icon={<Copy {...ic} />}>복제</DropdownMenuItem>
        <DropdownMenuItem icon={<Download {...ic} />}>Markdown으로 내보내기</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" icon={<Trash2 {...ic} />}>
          휴지통으로
        </DropdownMenuItem>
      </>
    ),
  },
  decorators: [(Story) => <div className="max-w-180 bg-app">{Story()}</div>],
} satisfies Meta<typeof TopBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 목차 버튼 (PAGE-12) — 즐겨찾기 왼쪽, ⌥⌘O */
export const WithOutline: Story = {
  args: {
    outline: (
      <OutlineItems
        headings={[
          { level: 1, text: "출시 일정" },
          { level: 2, text: "디자인 검토" },
        ]}
        current={1}
        onSelect={() => {}}
      />
    ),
  },
};

/** 스크롤됨 — 아래 구분선 */
export const Scrolled: Story = { args: { scrolled: true } };

/** 즐겨찾기 켜짐 · 사이드바 닫힘 */
export const FavoriteOn: Story = { args: { favorite: true, sidebarOpen: false } };

/** macOS 앱에서 사이드바가 숨었을 때(SYS-05) — 왼쪽에 신호등 버튼 자리를 비우고, 빈 곳을 끌면 창이 움직인다 */
export const TitleBarInset: Story = { args: { sidebarOpen: false, titleBar: "inset" } };
