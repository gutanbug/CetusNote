import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";

const CONTENT =
  '<p>피타고라스 정리는 <span data-type="inline-math" data-latex="a^2 + b^2 = c^2"></span> 이다. 질량-에너지 등가 <span data-type="inline-math" data-latex="E = mc^2"></span>.</p><div data-type="block-math" data-latex="\\int_0^\\infty e^{-x^2} \\, dx = \\frac{\\sqrt{\\pi}}{2}"></div><p>잘못된 식: <span data-type="inline-math" data-latex="\\frac{1}{"></span></p>';

/** 수식 — 인라인 `$x^2$`, 블록 `$$$` + 스페이스(또는 `$$$식$$$`). 수식을 눌러 LaTeX 편집 */
const meta = {
  title: "L4 에디터/ED-Math",
  component: EditorSpecimen,
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { content: CONTENT },
};

/** 키보드 편집 — 방향키로 수식을 고른 뒤(노드 선택) Enter */
export const KeyboardEdit: Story = {
  args: { content: CONTENT },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    let pos = -1;
    editor.state.doc.descendants((n, p) => {
      if (pos < 0 && n.type.name === "inlineMath") pos = p;
    });
    // 전체 스토리를 함께 돌리면 수식(KaTeX) 그리기가 늦다 — 다 그린 뒤 고른다
    await waitFor(() => expect(canvasElement.querySelector(".katex")).not.toBeNull(), {
      timeout: 8000,
    });
    editor.chain().focus().setNodeSelection(pos).run();
    // 여러 스토리를 함께 돌리면 포커스가 늦게 들어올 수 있다 — 편집기에 들어온 뒤 Enter
    await waitFor(() => {
      if (!editor.view.hasFocus()) throw new Error("편집기에 포커스가 아직 없다");
    });
    await userEvent.keyboard("{Enter}");
    const input = await within(document.body).findByDisplayValue(
      "a^2 + b^2 = c^2",
      {},
      { timeout: 8000 },
    );
    await waitFor(() => expect(input).toHaveFocus());
  },
};

/** 읽기 전용 (휴지통 미리보기 등) */
export const ReadOnly: Story = {
  args: { content: CONTENT, editable: false },
};

/** 빈 줄에 `$$$` + 스페이스 — 빈 수식 블록이 들어가고 편집 창이 열린다. 적용하면 식이 들어간다 */
export const BlockShortcut: Story = {
  args: { content: "<p>적분 예시</p><p></p>" },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    editor.commands.focus("end");
    await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
    await userEvent.keyboard("$$$ ");
    const dialog = await within(document.body).findByRole("dialog", { name: "수식 편집" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "LaTeX" }), "x^2{Enter}");
    await waitFor(() => {
      let latex: string | undefined;
      editor.state.doc.descendants((n) => {
        if (n.type.name === "blockMath") latex = n.attrs.latex as string;
      });
      expect(latex).toBe("x^2");
    });
    await expect(editor.state.doc.textContent).not.toContain("$$$");
  },
};
