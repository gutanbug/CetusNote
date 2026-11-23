import type { Meta, StoryObj } from "@storybook/react-vite";
import { House, Palette, Search, Trash2 } from "lucide-react";
import * as React from "react";
import { SAMPLE_PAGES } from "@/debug/shell-data";
import { RowMenu } from "@/debug/shell-sample";
import { PageTree } from "./page-tree";
import { SidebarItem } from "./sidebar-item";

/**
 * 사이드바 항목 — 아이콘 + 제목 + 단축키 힌트(hover·포커스) + 개수.
 * 트리 행(펼침 화살표 · hover 액션 ··· ＋ · 드래그 중)은 SH-PageTree가 같은 모양으로 그린다.
 */
const meta = {
  title: "L3 셸/SH-SidebarItem",
  component: SidebarItem,
  args: { icon: Search, label: "검색", shortcut: ["⌘", "K"] },
  decorators: [(Story) => <div className="grid w-60 gap-0.5 bg-sidebar p-2">{Story()}</div>],
} satisfies Meta<typeof SidebarItem>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 · hover · 포커스(Tab) — 툴바의 상태 강제로 hover를 본다 */
export const Default: Story = {};

/** 종류 — 단축키, 개수, 선택, 비활성, 이모지, 긴 제목 */
export const Variants: Story = {
  render: () => (
    <>
      <SidebarItem icon={House} label="홈" active />
      <SidebarItem icon={Search} label="검색" shortcut={["⌘", "K"]} />
      <SidebarItem icon={Trash2} label="휴지통" count={12} />
      <SidebarItem
        icon={Palette}
        label="포인트 색상"
        trailing={<span aria-hidden className="size-3 rounded-pill bg-accent" />}
      />
      <SidebarItem emoji="🏝️" label="제주 여행 준비물 — 3박 4일, 렌터카, 우천 대비" />
      <SidebarItem icon={Search} label="댓글 (1인 워크스페이스에서는 쓰지 않음)" disabled />
    </>
  ),
};

/** 트리 행 — 하위 펼침 · 선택 */
export const TreeRow: Story = {
  render: () => <Rows />,
};

/** 드래그 중 — 끄는 행은 반투명(프로토타입 opacity 0.5) */
export const Dragging: Story = {
  // 끄는 동안만 잠깐 보이는 상태라 대비 규칙에서 뺀다
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
  render: () => <Rows draggingId="reading" />,
};

function Rows({ draggingId }: { draggingId?: string }) {
  const [expanded, setExpanded] = React.useState(["work"]);
  return (
    <PageTree
      pages={SAMPLE_PAGES}
      activeId="roadmap"
      draggingId={draggingId}
      expanded={expanded}
      onExpandedChange={setExpanded}
      onOpen={() => {}}
      onAddChild={() => {}}
      rowMenu={(node) => <RowMenu node={node} />}
    />
  );
}
