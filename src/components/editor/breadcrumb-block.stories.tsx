import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Crumb } from "@/components/shell/breadcrumb";
import { BreadcrumbBlock } from "./breadcrumb-block";

const ROOT: Crumb = { id: "w-root", title: "개인 노트", emoji: "🏠" };
const SHORT: Crumb[] = [
  { id: "w-root", title: "개인 노트", emoji: "🏠" },
  { id: "f-work", title: "업무", emoji: "💼" },
  { id: "p-weekly", title: "주간 회의록", emoji: "📝" },
];
const DEEP: Crumb[] = [
  ROOT,
  { id: "f-work", title: "업무", emoji: "💼" },
  { id: "f-2026", title: "2026년", emoji: "🗓" },
  { id: "f-q4", title: "4분기", emoji: "📁" },
  { id: "p-product", title: "제품 기획", emoji: "🧭" },
  { id: "p-roadmap", title: "로드맵", emoji: "🗺" },
  { id: "p-weekly", title: "주간 회의록 2026-11-19", emoji: "📝" },
];

/** 경로 블록 — 본문 안에서 이 페이지의 상위 경로. 누르면 그 페이지로 간다 */
const meta = {
  title: "L4 에디터/ED-Breadcrumb",
  component: BreadcrumbBlock,
  args: { items: SHORT, onNavigate: fn(), selected: false },
  decorators: [(Story) => <div className="max-w-140 bg-app">{Story()}</div>],
} satisfies Meta<typeof BreadcrumbBlock>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 — 세 단계. 마지막(지금 페이지)은 누를 수 없다 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("navigation", { name: "경로" })).toBeVisible();
    await expect(
      canvas.getByText(/주간 회의록/, { selector: "[aria-current] span" }),
    ).toBeVisible();
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: /개인 노트/ })).toHaveFocus();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await expect(args.onNavigate).toHaveBeenLastCalledWith("f-work");
  },
};

/** 최상위 페이지 — 현재 페이지 이름 하나만 */
export const Root: Story = {
  args: { items: [{ id: "p-root", title: "시작 메모", emoji: "✏️" }] },
};

/** 깊은 경로 — 가운데를 「…」 메뉴로 접는다 */
export const Deep: Story = {
  args: { items: DEEP },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // 포커스 순서: 첫 항목 → 「…」 (현재 페이지 span은 포커스 대상이 아님)
    await userEvent.tab();
    await userEvent.tab();
    const more = canvas.getByRole("button", { name: "숨긴 경로 4개" });
    await expect(more).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const menu = await within(document.body).findByRole("menu");
    await expect(within(menu).getAllByRole("menuitem")).toHaveLength(4);
    await userEvent.keyboard("{Enter}");
    await expect(args.onNavigate).toHaveBeenCalledTimes(1);
  },
};

/** 긴 제목 — 한 칸에서 생략(…), 전체 제목은 툴팁처럼 title로 */
export const LongTitles: Story = {
  args: {
    items: [
      {
        id: "w-root",
        title: "개인 노트 — 업무용 워크스페이스 (2026 이전 보관 자료 포함)",
        emoji: "🏠",
      },
      {
        id: "p-long",
        title: "고객사 미팅 준비 자료 정리 최종본 v7 (검토 중, 외부 공유 금지)",
        emoji: "📄",
      },
    ],
  },
};

/** 선택됨 — 얇은 accent 링 */
export const Selected: Story = { args: { selected: true } };

/** 경로를 읽는 중 */
export const Loading: Story = {
  args: { items: undefined },
};

/** 경로를 찾을 수 없음 (페이지가 지워졌을 때) */
export const Missing: Story = { args: { items: [] } };
