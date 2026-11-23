import type { Meta, StoryObj } from "@storybook/react-vite";
import thumbTodo from "@/debug/samples/thumb-todo.jpg";
import thumbWeekly from "@/debug/samples/thumb-weekly.jpg";
import { RecentCard } from "./recent-card";

/** 최근 페이지 카드 — 아이콘 썸네일 · 제목 · 시간. hover는 툴바의 상태 강제로 확인 */
const meta = {
  title: "L5 페이지/PG-RecentCard",
  component: RecentCard,
  args: { title: "2027 상반기 로드맵", emoji: "🧭", meta: "3분 전" },
} satisfies Meta<typeof RecentCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 아이콘 없는 문서 — 문서 아이콘을 옅게 */
export const NoEmoji: Story = { args: { emoji: null, title: "주간 회의", meta: "어제" } };

/** 커버(또는 본문 첫 이미지)가 있으면 썸네일로 */
/** 컬렉션(보드·표·캘린더) — 이모지가 없으면 표 아이콘. 레코드는 시간 옆에 어느 컬렉션인지 적는다 */
export const Collection: Story = {
  args: { emoji: null, kind: "collection", title: "스프린트 보드", meta: "5분 전" },
};

/** 보드 카드(레코드) — 어느 컬렉션의 카드인지 시간 옆에 */
export const Record: Story = {
  args: { emoji: null, title: "스프린트 리뷰 준비", meta: "10분 전 · 스프린트 보드" },
};

export const WithThumb: Story = { args: { thumb: thumbWeekly, title: "주간 회의", emoji: "📝" } };

/** 긴 제목 — 말줄임 */
export const LongTitle: Story = {
  args: {
    title: "Rust 소유권과 빌림 규칙 정리 — 수명 표기까지",
    emoji: "🦀",
    meta: "2026년 11월 2일",
  },
};

/** 여러 장을 가로로 */
export const Rail: Story = {
  render: () => (
    <div className="flex gap-3">
      <RecentCard title="주간 회의" emoji="📝" meta="방금" thumb={thumbWeekly} />
      <RecentCard title="이번 주 할 일" emoji="✅" meta="10분 전" thumb={thumbTodo} />
      <RecentCard title="독서 노트" emoji="🔖" meta="1시간 전" />
      <RecentCard title="제목 없음" meta="2일 전" />
    </div>
  ),
};
