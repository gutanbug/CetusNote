import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";
import { OutlineItems, type OutlineEntry } from "./outline";

const HEADINGS: OutlineEntry[] = [
  { level: 1, text: "출시 일정" },
  { level: 2, text: "디자인 검토" },
  { level: 3, text: "다크 모드 색 대비" },
  { level: 2, text: "접근성 점검 — 키보드만으로 모든 화면 다니기" },
  { level: 1, text: "회고" },
];

type Props = { headings: OutlineEntry[]; current?: number; onSelect: (i: number) => void };

/** 상단 바처럼: 버튼 아래 메뉴로 연다 */
function Specimen(props: Props) {
  return (
    <div className="flex h-80 justify-end">
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger className="h-fit">목차</DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <OutlineItems {...props} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * OV-Outline — 목차(PAGE-12). 상단 바 목차 버튼 · ⌥⌘O. 제목 수준만큼 들이고, 지금 보는 제목은 포인트 색.
 * ↑↓ · Enter · 첫 글자 이동은 OV-Menu가 한다. 열면 지금 보는 제목에서 시작한다.
 */
const meta = {
  title: "L2 오버레이/OV-Outline",
  component: Specimen,
  args: { headings: HEADINGS, current: 2, onSelect: fn() },
} satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 첫 제목보다 위를 보고 있으면 표시 없음 */
export const NoCurrent: Story = { args: { current: -1 } };

/** H2부터 시작하는 문서 — 가장 높은 수준을 왼쪽 끝으로 */
export const StartsAtH2: Story = {
  args: {
    current: 0,
    headings: [
      { level: 2, text: "회의 안건" },
      { level: 3, text: "지난주 결정" },
      { level: 2, text: "다음 할 일" },
    ],
  },
};

/** 제목이 없는 문서 */
export const Empty: Story = { args: { headings: [], current: -1 } };

/** 열면 지금 보는 제목에 포커스 → ↓ · Enter로 고른다 */
export const Keyboard: Story = {
  play: async ({ args }) => {
    const body = within(document.body);
    const current = await body.findByRole("menuitem", { name: "다크 모드 색 대비" });
    await expect(current).toHaveAttribute("aria-current", "location");
    await waitFor(() => expect(current).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(args.onSelect).toHaveBeenCalledWith(3);
  },
};

/** 다크 — 지금 제목(포인트 색)이 하이라이트 배경 위에서도 읽히는지 */
export const Dark: Story = { globals: { theme: "dark" } };

/** Esc — 고르지 않고 닫으면 목차 버튼으로 포커스가 돌아간다 */
export const EscapeReturns: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("menuitem", { name: "다크 모드 색 대비" })).toHaveFocus(),
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(within(canvasElement).getByRole("button", { name: "목차" })).toHaveFocus(),
    );
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};
