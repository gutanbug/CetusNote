import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorSpecimen } from "@/debug/editor-specimen";

const CONTENT =
  '<details open><summary>회의 안건 펼쳐 보기</summary><div data-type="detailsContent"><p>1. 지난주 실행 항목 확인</p><p>2. 다음 스프린트 범위</p></div></details><details><summary>닫힌 토글 — 눌러서 열기</summary><div data-type="detailsContent"><p>숨겨진 내용</p></div></details>';

/** 토글 — `>>` + 스페이스. 열림/닫힘이 문서에 저장된다 */
const meta = {
  title: "L4 에디터/ED-Toggle",
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
