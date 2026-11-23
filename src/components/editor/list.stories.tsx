import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorSpecimen } from "@/debug/editor-specimen";

const CONTENT =
  "<ul><li><p>장보기</p><ul><li><p>채소</p><ul><li><p>양파</p></li><li><p>대파</p></li></ul></li><li><p>두부</p></li></ul></li><li><p>세탁소 들르기</p></li></ul><ol><li><p>설계 문서 쓰기</p><ol><li><p>저장 형식</p></li><li><p>검색 인덱스</p><ol><li><p>시작 시 생성</p></li></ol></li></ol></li><li><p>리뷰 받기</p></li></ol>";

/** 글머리 · 번호 목록, 3단계 중첩 — `-` `1.` + 스페이스, Tab으로 들여쓰기 */
const meta = {
  title: "L4 에디터/ED-List",
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
