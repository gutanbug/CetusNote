import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { PageTabs, type PageTabItem } from "./page-tabs";

const ITEMS: PageTabItem[] = [
  { key: "1", kind: "page", title: "주간 회의록", emoji: "📝" },
  { key: "2", kind: "page", title: "업무 트래커", emoji: "🗂" },
  { key: "3", kind: "page", title: "이번 주 할 일", emoji: "✅" },
  { key: "4", kind: "home", title: "홈" },
  { key: "5", kind: "tag", title: "#회의" },
  { key: "6", kind: "page", title: "2026년 상반기 제품 로드맵 초안과 회고 정리", emoji: "📚" },
  { key: "7", kind: "page", title: "제목 없음" },
];

/** 상태를 가진 탭 바 — 고르기 · 닫기 · 새 탭이 실제로 움직인다 */
function Tabs(props: {
  onSelect: (i: number) => void;
  onClose: (i: number) => void;
  onAdd: () => void;
  initial?: PageTabItem[];
}) {
  const [items, setItems] = React.useState(props.initial ?? ITEMS);
  const [active, setActive] = React.useState(0);
  return (
    <div className="w-full max-w-240 border border-line">
      <PageTabs
        items={items}
        activeIndex={active}
        onSelect={(i) => {
          props.onSelect(i);
          setActive(i);
        }}
        onClose={(i) => {
          props.onClose(i);
          setItems((xs) => xs.filter((_, j) => j !== i));
          setActive((a) => (i < a ? a - 1 : Math.min(a, items.length - 2)));
        }}
        onAdd={() => {
          props.onAdd();
          setItems((xs) => [...xs, { key: String(Date.now()), kind: "home", title: "홈" }]);
          setActive(items.length);
        }}
      />
      <div className="h-24" />
    </div>
  );
}

/**
 * 페이지 탭 — 본문 위 한 줄(36px). 선택된 탭은 2px 포인트 밑줄, 닫기는 hover · 선택에서만.
 * hover는 툴바의 상태 강제로 확인. 긴 제목은 180px에서 말줄임.
 */
const meta = {
  title: "L3 셸/SH-PageTabs",
  component: Tabs,
  args: { onSelect: fn(), onClose: fn(), onAdd: fn() },
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 페이지 · 홈 · 태그 탭, 긴 제목, 아이콘 없는 페이지 */
export const Default: Story = {};

/** 탭이 둘뿐일 때 */
export const Two: Story = { args: { initial: ITEMS.slice(0, 2) } };

/** 키보드: ←→로 옮기고 Enter로 열기, Delete로 닫기. 마우스: 탭 누르기 · × 닫기 · + 새 탭 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const first = c.getByRole("tab", { name: "주간 회의록" });
    await expect(first).toHaveAttribute("aria-selected", "true");
    first.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(c.getByRole("tab", { name: "업무 트래커" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSelect).toHaveBeenCalledWith(1);
    await expect(c.getByRole("tab", { name: "업무 트래커" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{Delete}");
    await expect(args.onClose).toHaveBeenCalledWith(1);
    await waitFor(() => expect(c.queryByRole("tab", { name: "업무 트래커" })).toBeNull());
    await waitFor(() => expect(c.getByRole("tab", { name: "이번 주 할 일" })).toHaveFocus());
    await userEvent.click(c.getByRole("button", { name: "새 탭" }));
    await expect(args.onAdd).toHaveBeenCalled();
  },
};
