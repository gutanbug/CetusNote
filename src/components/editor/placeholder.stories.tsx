import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorSpecimen } from "@/debug/editor-specimen";

/** 플레이스홀더 — 빈 줄에 "'/'를 입력해 명령어 사용", 빈 제목에 "제목 1" */
const meta = {
  title: "L4 에디터/ED-Placeholder",
  component: EditorSpecimen,
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { content: "", autoFocus: true },
};

export const EmptyHeading: Story = {
  args: { content: "<h1></h1>", autoFocus: true },
  // 빈 제목을 보여 주는 것이 이 견본의 목적이다
  parameters: { a11y: { config: { rules: [{ id: "empty-heading", enabled: false }] } } },
};
