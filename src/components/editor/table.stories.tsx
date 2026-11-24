import { expect, userEvent, waitFor, within } from "storybook/test";
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

/** 셀 안에서 ⌘A(Windows·Linux는 Ctrl+A) — 그 셀의 글자만 고른다(EDIT-15) */
export const SelectCellContent: Story = {
  args: { content: CONTENT },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const target = await canvas.findByText("코드 블록");
    const editorEl = target.closest<HTMLElement>(".ProseMirror");
    if (!editorEl) throw new Error("편집기를 찾지 못했다");
    // 클릭 대신 포커스와 DOM 선택을 셀 글자에 둔다(클릭은 이 환경에서 편집기에 닿지 않는다)
    editorEl.focus();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    const mod = navigator.platform.includes("Mac") ? "{Meta>}" : "{Control>}";
    const release = mod.replace(">", "/");
    await userEvent.keyboard(`${mod}a${release}`);
    await waitFor(() => expect(window.getSelection()?.toString()).toBe("코드 블록"));
  },
};
