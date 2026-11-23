import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorSpecimen } from "@/debug/editor-specimen";

const CONTENT = "<blockquote><p>단순함은 궁극의 정교함이다.</p></blockquote><p>인용 다음 문단.</p>";

/** 인용 — `>` + 스페이스 */
const meta = {
  title: "L4 에디터/ED-Quote",
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
