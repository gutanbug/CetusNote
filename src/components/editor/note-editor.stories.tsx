import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { SAMPLE_DOC as ALL } from "@/debug/sample-doc";

/** 모든 문법을 한 문서에 — 직접 입력해 단축 입력과 서식을 시험한다 */
const meta = {
  title: "L4 에디터/ED-Editor",
  component: EditorSpecimen,
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AllSyntax: Story = {
  args: { content: ALL },
};

export const ReadOnly: Story = {
  args: { content: ALL, editable: false },
};
