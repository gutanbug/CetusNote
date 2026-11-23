import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { getEditor } from "@/debug/editor-test";
import { EditorSpecimen } from "@/debug/editor-specimen";

const CONTENT =
  "<table><tbody><tr><th><p>이름</p></th><th><p>값</p></th></tr><tr><td><p>여기를 클릭</p></td><td><p>1</p></td></tr></tbody></table>";

/** 표 편집 바 — 표 안을 클릭하면 열린다 */
const meta = {
  title: "L4 에디터/ED-TableMenu",
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

/**
 * 키보드 경로 — 표 안에서 ⌥F10으로 표 도구에 들어가고, ←→ Home End로 옮기고,
 * Enter로 실행하면 포커스가 단추에 남고, Esc로 같은 셀의 본문 커서에 돌아간다.
 */
export const KeyboardPath: Story = {
  args: { content: CONTENT },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    let at = -1;
    editor.state.doc.descendants((n, pos) => {
      if (n.isText && n.text?.includes("여기를")) at = pos + 1;
    });
    editor.commands.focus(at);
    const bar = await within(document.body).findByRole("toolbar", { name: "표 도구" });
    await expect(bar).toBeVisible();

    await userEvent.keyboard("{Alt>}{F10}{/Alt}");
    const btn = (name: string) => within(bar).getByRole("button", { name });
    await expect(btn("위에 행 추가")).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(btn("아래에 행 추가")).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(btn("표 삭제")).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(btn("위에 행 추가")).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(btn("표 삭제")).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(btn("위에 행 추가")).toHaveFocus();
    for (let i = 0; i < 4; i++) await userEvent.keyboard("{ArrowRight}");
    await expect(btn("머리글 행 전환")).toHaveFocus();

    // Enter: 머리글 행이 바뀌고 포커스는 그 단추에 남는다
    const firstRowCell = () => {
      let name = "";
      editor.state.doc.descendants((n) => {
        if (!name && n.type.name === "tableRow") name = n.firstChild!.type.name;
      });
      return name;
    };
    await expect(firstRowCell()).toBe("tableHeader");
    await userEvent.keyboard("{Enter}");
    await expect(firstRowCell()).toBe("tableCell");
    await waitFor(() => expect(btn("머리글 행 전환")).toHaveFocus());

    // Esc: 본문으로, 같은 셀 안에 커서
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(editor.view.dom).toHaveFocus());
    const $from = editor.state.selection.$from;
    await expect($from.node($from.depth - 1).textContent).toBe("여기를 클릭");
  },
};
