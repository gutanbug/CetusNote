import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { TemplateCard } from "./template-card";
import { SAMPLE_DOCS } from "./template-samples";

/** 템플릿 카드 — 이모지 · 이름 · 설명 · 본문 미리보기 · ··· 메뉴. hover는 툴바의 상태 강제로 확인 */
const meta = {
  title: "L5 페이지/PG-TemplateCard",
  component: TemplateCard,
  args: {
    emoji: "📝",
    name: "회의록",
    description: "참석자 · 안건 · 결정 · 액션 아이템",
    doc: SAMPLE_DOCS.meeting,
    onPick: fn(),
    onEdit: fn(),
    onDuplicate: fn(),
    onDelete: fn(),
  },
  decorators: [(Story) => <div className="w-70">{Story()}</div>],
} satisfies Meta<typeof TemplateCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 체크리스트 — 끝낸 항목은 채운 상자와 취소선 */
export const Daily: Story = {
  args: {
    emoji: "🌤",
    name: "일일 노트",
    description: "오늘 할 일 · 기록 · 회고",
    doc: SAMPLE_DOCS.daily,
  },
};

/** 코드 블록이 있는 템플릿 */
export const Study: Story = {
  args: {
    emoji: "📚",
    name: "학습 노트",
    description: "요약 · 예제 코드 · 기억할 점",
    doc: SAMPLE_DOCS.study,
  },
};

/** 빈 본문 — "빈 문서" */
export const Empty: Story = {
  args: { emoji: "", name: "새 템플릿", description: "", doc: SAMPLE_DOCS.empty },
};

/** 마우스가 올라간 상태 — ··· 버튼이 드러난다 (평소에는 숨김, 키보드 포커스에서도 드러남) */
export const MenuRevealed: Story = {
  decorators: [(Story) => <div data-force="hover">{Story()}</div>],
};

/** 메뉴 없음 — 고르기만 */
export const PickOnly: Story = {
  args: { onEdit: undefined, onDuplicate: undefined, onDelete: undefined },
};

/** 긴 이름·설명 — 줄바꿈, 이름은 ··· 버튼과 겹치지 않는다 */
export const LongText: Story = {
  args: {
    emoji: "🔖",
    name: "읽은 글 정리와 다음에 찾아볼 것들 모음",
    description: "출처 · 핵심 주장 · 내 생각 · 함께 읽으면 좋은 글과 다음에 찾아볼 것",
  },
};
