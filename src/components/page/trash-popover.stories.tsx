import type { Meta, StoryObj } from "@storybook/react-vite";
import { Trash2 } from "lucide-react";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { SidebarItem } from "@/components/shell/sidebar-item";
import { TrashList, TrashPopover, type TrashItem } from "./trash-popover";

const ITEMS: TrashItem[] = [
  { id: "a", title: "11월 4일 주간 회의", emoji: "📝", deletedAt: "어제" },
  { id: "b", title: "옛 로드맵 초안 — 2026 하반기, 폐기된 안", emoji: "🧭", deletedAt: "3일 전" },
  { id: "c", title: "", deletedAt: "2주 전" },
];

function List({ items = ITEMS }: { items?: TrashItem[] }) {
  const [list, setList] = React.useState(items);
  const drop = (id: string) => setList((l) => l.filter((x) => x.id !== id));
  return (
    <div className="w-fit rounded-lg bg-elevated shadow-popover">
      <TrashList items={list} onRestore={drop} onPurge={drop} />
    </div>
  );
}

/** 휴지통 — 검색 · 목록 · 복원 / 영구 삭제(한 번 더 확인) · 빈 상태 */
const meta = {
  title: "L5 페이지/PG-TrashPopover",
  component: List,
} satisfies Meta<typeof List>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 목록 (행 hover로 복원·삭제 버튼) */
export const Default: Story = {};

/** 비어 있음 */
export const Empty: Story = { args: { items: [] } };

/** 검색 결과 없음 */
export const NoResult: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(
      within(canvasElement).getByRole("searchbox", { name: "휴지통 검색" }),
      "여행",
    );
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "“여행”에 해당하는 페이지가 없어요.",
    );
  },
};

/** 영구 삭제 — 행 안에서 한 번 더 묻는다 */
export const Purge: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "“11월 4일 주간 회의” 영구 삭제" }));
    await expect(c.getByText("영구 삭제할까요?")).toBeVisible();
    // 기본 포커스는 취소 — Enter는 확인을 닫고 영구 삭제 버튼으로 돌아간다
    await expect(c.getByRole("button", { name: "취소" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const purge = c.getByRole("button", { name: "“11월 4일 주간 회의” 영구 삭제" });
    await waitFor(() => expect(purge).toHaveFocus());
    await userEvent.keyboard("{Enter}{Tab}{Enter}");
    await expect(c.queryByText("11월 4일 주간 회의")).toBeNull();
    // 지운 뒤 포커스는 다음 행으로
    await waitFor(() =>
      expect(
        c.getByRole("button", { name: "“옛 로드맵 초안 — 2026 하반기, 폐기된 안” 복원" }),
      ).toHaveFocus(),
    );
  },
};

/** 사이드바 휴지통 항목에서 열기 */
export const FromSidebar: Story = {
  render: () => (
    <div className="w-60 bg-sidebar p-2">
      <TrashPopover items={ITEMS} onRestore={() => {}} onPurge={() => {}}>
        <SidebarItem icon={Trash2} label="휴지통" count={ITEMS.length} />
      </TrashPopover>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /휴지통/ }));
    const dialog = await within(document.body).findByRole("dialog", { name: "휴지통" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.keyboard("{Escape}");
  },
};
