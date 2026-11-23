import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, Download, Trash2 } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
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

/** 오른쪽 패널 머리 한 줄 (SHELL-19) — 제목 · 목차 · 페이지 메뉴 · 바꾸기 · 닫기. 같은 높이(44) */
const paneMeta = {
  variant: "pane",
  breadcrumb: undefined,
  editedAt: undefined,
  onToggleSidebar: undefined,
  onToggleFavorite: undefined,
  onFocusMode: undefined,
} as const;

/** 패널 머리 기본 — 제목을 누르면 주 화면에서 열고, 바꾸기·닫기는 오른쪽 끝 */
export const PaneDefault: Story = {
  args: {
    ...paneMeta,
    pane: { icon: "📝", title: "주간 회의록", onOpenMain: fn(), onSwap: fn(), onClose: fn() },
  },
  decorators: [(Story) => <div className="w-80 border-l border-line bg-app">{Story()}</div>],
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: /주간 회의록/ }));
    await expect(args.pane?.onOpenMain).toHaveBeenCalledTimes(1);
    await userEvent.click(c.getByRole("button", { name: "주 화면과 바꾸기" }));
    await expect(args.pane?.onSwap).toHaveBeenCalledTimes(1);
    await userEvent.click(c.getByRole("button", { name: "패널 닫기" }));
    await expect(args.pane?.onClose).toHaveBeenCalledTimes(1);
  },
};

/** 패널 머리 + 목차 · 페이지 메뉴 — Tab 순서: 제목 → 목차 → 페이지 메뉴 → 바꾸기 → 닫기 */
export const PaneKeyboard: Story = {
  args: {
    ...paneMeta,
    pane: { icon: "📝", title: "주간 회의록", onOpenMain: fn(), onSwap: fn(), onClose: fn() },
    outline: (
      <OutlineItems
        headings={[
          { level: 1, text: "출시 일정" },
          { level: 2, text: "디자인 검토" },
        ]}
        current={0}
        onSelect={() => {}}
      />
    ),
    pageMenu: (
      <>
        <DropdownMenuItem icon={<Copy {...ic} />}>복제</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" icon={<Trash2 {...ic} />}>
          휴지통으로
        </DropdownMenuItem>
      </>
    ),
  },
  decorators: [(Story) => <div className="w-80 border-l border-line bg-app">{Story()}</div>],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.tab();
    await expect(c.getByRole("button", { name: /주간 회의록/ })).toHaveFocus();
    await userEvent.tab();
    await expect(c.getByRole("button", { name: "목차" })).toHaveFocus();
    await userEvent.tab();
    await expect(c.getByRole("button", { name: "페이지 메뉴" })).toHaveFocus();
    await userEvent.tab();
    await expect(c.getByRole("button", { name: "주 화면과 바꾸기" })).toHaveFocus();
    await userEvent.tab();
    await expect(c.getByRole("button", { name: "패널 닫기" })).toHaveFocus();
  },
};

/**
 * 오른쪽 패널이 열려 있고 포커스는 주 화면에 있다 — 이 머리는 흐리게 (제목·아이콘 text-tertiary).
 * 자리·테두리는 그대로이고, Tab 순서와 hover·focus 링은 활성 쪽과 같다.
 */
export const PaneInactive: Story = {
  args: {
    ...paneMeta,
    dimmed: true,
    pane: { icon: "📝", title: "주간 회의록", onOpenMain: fn(), onSwap: fn(), onClose: fn() },
    pageMenu: (
      <>
        <DropdownMenuItem icon={<Copy {...ic} />}>복제</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" icon={<Trash2 {...ic} />}>
          휴지통으로
        </DropdownMenuItem>
      </>
    ),
  },
  decorators: [(Story) => <div className="w-80 border-l border-line bg-app">{Story()}</div>],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.tab();
    await expect(c.getByRole("button", { name: /주간 회의록/ })).toHaveFocus();
    await expect(c.getByRole("button", { name: "패널 닫기" })).toHaveClass("text-tertiary");
    await userEvent.tab();
    await expect(c.getByRole("button", { name: "페이지 메뉴" })).toHaveFocus();
  },
};

/** 좁은 패널(320px) 긴 제목 — 제목만 줄고 버튼은 밀려나지 않는다 */
export const PaneLongTitle: Story = {
  args: {
    ...paneMeta,
    pane: {
      title: "2026년 상반기 제품 로드맵 초안과 회고, 그리고 다음 분기 우선순위 정리",
      onOpenMain: fn(),
      onSwap: fn(),
      onClose: fn(),
    },
  },
  decorators: [(Story) => <div className="w-80 border-l border-line bg-app">{Story()}</div>],
};

/** 패널 머리 — 아이콘도 제목도 없는 페이지 */
export const PaneNoIconNoTitle: Story = {
  args: {
    ...paneMeta,
    pane: { title: "", onOpenMain: fn(), onSwap: fn(), onClose: fn() },
  },
  decorators: [(Story) => <div className="w-80 border-l border-line bg-app">{Story()}</div>],
};

/** 창이 좁아 오른쪽 패널이 숨은 상태 — 상단 바에 조용한 표시. 누르면 설명을 띄운다 */
export const PaneHiddenNotice: Story = {
  args: {
    paneHidden: { label: "오른쪽 패널 숨김됨 · 창을 넓히면 다시 보여요", onClick: fn() },
  },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: /오른쪽 패널 숨김됨/ }));
    await expect(args.paneHidden?.onClick).toHaveBeenCalledTimes(1);
  },
};
