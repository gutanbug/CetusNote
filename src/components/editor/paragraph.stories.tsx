import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorSpecimen } from "@/debug/editor-specimen";

const CONTENT =
  "<p>오늘 회의에서 다음 분기 목표를 정했다. 핵심은 <strong>로컬 우선</strong>과 빠른 검색이다.</p><p>두 번째 문단은 줄바꿈 없이 길게 이어지는 문장이 어떻게 감기는지 확인하기 위한 예시다. 한글과 English가 섞여도 자연스럽게 줄이 바뀌어야 한다.</p>";

/** 텍스트 — 본문 16px / 1.7 */
const meta = {
  title: "L4 에디터/ED-Paragraph",
  component: EditorSpecimen,
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { content: CONTENT },
};

/** 읽기 전용 (휴지통 미리보기 등) */
export const ReadOnly: Story = {
  args: { content: CONTENT, editable: false },
};
