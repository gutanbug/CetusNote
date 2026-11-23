import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { TodayTodos, type TodayTodo } from "./today-todos";

const ITEMS: TodayTodo[] = [
  {
    id: "1",
    text: "발표 자료 초안 공유",
    checked: false,
    pageId: "a",
    pageTitle: "주간 회의",
    pageEmoji: "📝",
  },
  {
    id: "2",
    text: "디자인 리뷰 일정 잡기",
    checked: false,
    pageId: "a",
    pageTitle: "주간 회의",
    pageEmoji: "📝",
  },
  {
    id: "3",
    text: "《데이터 중심 애플리케이션 설계》 5장 읽기",
    checked: true,
    pageId: "b",
    pageTitle: "독서 노트",
    pageEmoji: "🔖",
  },
  { id: "4", text: "세금 계산서 확인", checked: false, pageId: "c", pageTitle: "" },
];

function Todos({
  onOpenPage,
  initial = ITEMS,
}: {
  onOpenPage: (id: string) => void;
  initial?: TodayTodo[];
}) {
  const [items, setItems] = React.useState(initial);
  return (
    <div className="w-160">
      <TodayTodos
        items={items}
        onCheckedChange={(id, checked) =>
          setItems((xs) => xs.map((x) => (x.id === id ? { ...x, checked } : x)))
        }
        onOpenPage={onOpenPage}
      />
    </div>
  );
}

/** 오늘의 할 일 — 여러 문서의 체크리스트. 체크하면 취소선, 오른쪽 문서 이름을 누르면 그 문서로 */
const meta = {
  title: "L5 페이지/PG-TodayTodos",
  component: Todos,
  args: { onOpenPage: fn() },
} satisfies Meta<typeof Todos>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 할 일이 없을 때 */
export const Empty: Story = { args: { initial: [] } };

/** 키보드: 체크박스를 Space로, 문서 이름을 Enter로 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const box = c.getByRole("checkbox", { name: "발표 자료 초안 공유 완료 표시" });
    box.focus();
    await userEvent.keyboard(" ");
    await expect(box).toHaveAttribute("data-state", "checked");
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpenPage).toHaveBeenCalledWith("a");
  },
};
