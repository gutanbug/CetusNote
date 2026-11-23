import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorSpecimen } from "@/debug/editor-specimen";

const CONTENT =
  '<div data-type="callout" data-emoji="💡" data-color="blue"><p>단축키 <code>⌘K</code>로 어디서든 페이지를 찾을 수 있다.</p></div><div data-type="callout" data-emoji="⚠️" data-color="yellow"><p>휴지통은 30일 뒤 자동으로 비워진다.</p></div><div data-type="callout" data-emoji="✅" data-color="green"><p>모든 노트는 이 컴퓨터에만 저장된다.</p></div><div data-type="callout" data-emoji="❗" data-color="red"><p>내보내기 전에 백업 폴더를 확인하자.</p></div>';

/** 콜아웃 — `:::` + 스페이스. 아이콘을 눌러 이모지와 색을 바꾼다 */
const meta = {
  title: "L4 에디터/ED-Callout",
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
