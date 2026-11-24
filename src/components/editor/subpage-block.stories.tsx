import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { SubpageBlock } from "./subpage-block";

/** 하위 페이지 링크 — 카드가 아닌 한 줄. 열기는 Enter(⌘Enter 새 탭), 지운 페이지는 흐리게 */
const meta = {
  title: "L4 에디터/ED-SubpageBlock",
  component: SubpageBlock,
  args: {
    state: "ready",
    title: "주간 회의록 2026-11-19",
    icon: "📝",
    selected: false,
    onOpen: fn(),
    onRemove: fn(),
  },
  decorators: [(Story) => <div className="max-w-140 bg-app">{Story()}</div>],
} satisfies Meta<typeof SubpageBlock>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 — 아이콘 · 제목 · 「하위 페이지」(hover 때 보인다) */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole("button")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpen).toHaveBeenLastCalledWith({ newTab: false });
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect(args.onOpen).toHaveBeenLastCalledWith({ newTab: true });
    await expect(args.onOpen).toHaveBeenCalledTimes(2);
  },
};

/** hover — 하위 페이지 표시가 드러난다 (Debug 상태 강제와 같은 variant) */
export const Hover: Story = {
  decorators: [
    (Story) => (
      <div data-force="hover" className="max-w-140 bg-app">
        {Story()}
      </div>
    ),
  ],
};

/** 선택됨 — 얇은 accent 링 */
export const Selected: Story = { args: { selected: true } };

/** 제목 없는 페이지 */
export const Untitled: Story = { args: { title: "", icon: null } };

/** 긴 제목 — 한 줄로 생략(…) */
export const LongTitle: Story = {
  args: {
    title: "2026년 4분기 제품 로드맵과 팀별 우선순위, 외부 협력사 일정 정리 (초안 3차)",
  },
};

/** 지운 페이지 — 「삭제된 페이지」 흐리게, 블록 지우기 */
export const Missing: Story = {
  args: { state: "missing" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: /주간 회의록/ })).toBeNull();
    await expect(canvas.getByText("삭제된 페이지")).toBeVisible();
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "블록 지우기" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onRemove).toHaveBeenCalledTimes(1);
  },
};

/** 휴지통에 있는 페이지 — 열 수 없고 지우기만 된다 */
export const Trashed: Story = {
  args: { state: "trashed" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("휴지통에 있는 페이지")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /주간 회의록/ })).toBeNull();
  },
};

/** 불러오는 중 — 같은 높이의 자리표시자 */
export const Loading: Story = {
  args: { state: "loading" },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByText("페이지를 불러오는 중")).toBeInTheDocument(),
    );
  },
};
