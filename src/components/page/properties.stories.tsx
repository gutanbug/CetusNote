import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Status } from "@/components/ui/status-chip";
import { Properties, type PageTag } from "./properties";

const TAGS: PageTag[] = [
  { id: "t1", name: "회의", color: "blue" },
  { id: "t2", name: "디자인", color: "purple" },
  { id: "t3", name: "2026 상반기", color: "green" },
];

function Editable() {
  const [status, setStatus] = React.useState<Status | undefined>("진행 중");
  const [tags, setTags] = React.useState(TAGS);
  return (
    <Properties
      tags={tags}
      onRemoveTag={(id) => setTags((t) => t.filter((x) => x.id !== id))}
      tagEditor={
        <p className="p-1 text-caption text-secondary">태그 검색·추가는 기능 단계에서 붙여요.</p>
      }
      status={status}
      onStatusChange={setStatus}
      created="2026년 11월 18일"
      updated="3분 전"
    />
  );
}

/** 속성 영역 — 태그 · 상태 · 생성일/수정일. 이름 칸 112px, 값 칸은 누르면 편집 */
const meta = {
  title: "L5 페이지/PG-Properties",
  component: Editable,
  decorators: [(Story) => <div className="max-w-(--content-w)">{Story()}</div>],
} satisfies Meta<typeof Editable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 편집 가능 (hover로 값 칸 배경) */
export const Default: Story = {};

/** 비어 있음 · 읽기 전용 */
export const Empty: Story = {
  render: () => <Properties tags={[]} created="2026년 11월 19일" />,
};

/** 상태 바꾸기 — 메뉴 */
export const ChangeStatus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /상태 편집/ }));
    const menu = await within(document.body).findByRole("menu");
    await waitFor(() => expect(menu).toBeVisible());
    await userEvent.click(within(menu).getByRole("menuitemcheckbox", { name: "완료" }));
    await expect(
      within(canvasElement).getByRole("button", { name: "상태 편집, 지금은 완료" }),
    ).toBeVisible();
  },
};
