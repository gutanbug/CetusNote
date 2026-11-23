import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorSpecimen } from "@/debug/editor-specimen";

const CONTENT =
  "<table><tbody><tr><th><p>기능</p></th><th><p>우선</p></th><th><p>상태</p></th></tr><tr><td><p>코드 블록</p></td><td><p>P0</p></td><td><p>구현</p></td></tr><tr><td><p>표</p></td><td><p>P1</p></td><td><p>구현</p></td></tr><tr><td><p>수식</p></td><td><p>P1</p></td><td><p>구현</p></td></tr></tbody></table>";

/** 표 — 셀을 누르면 위에 표 편집 바(ED-TableMenu)가 뜬다. 열 경계를 끌어 너비 조절 */
const meta = {
  title: "L4 에디터/ED-Table",
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
