import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorSpecimen } from "@/debug/editor-specimen";

const CONTENT =
  "<h1>제품 로드맵</h1><p>상반기 계획을 정리한다.</p><h2>1분기</h2><p>에디터 기본 블록을 완성한다.</p><h3>세부 작업</h3><p>코드 블록과 표를 먼저 만든다.</p>";

/** 제목 H1–H3 — `#` `##` `###` + 스페이스 */
const meta = {
  title: "L4 에디터/ED-Heading",
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
