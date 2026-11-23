import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor, hoverBlock } from "@/debug/editor-test";

const CONTENT =
  '<h2>이번 주 할 일</h2><p>블록 왼쪽에 마우스를 올리면 ＋와 ⋮⋮가 보여요.</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>디자인 검토</p></li><li data-type="taskItem" data-checked="true"><p>회의록 정리</p></li></ul><blockquote><p>⋮⋮를 끌어서 블록 순서를 바꿀 수 있어요.</p></blockquote>';

/**
 * 블록 핸들 — 블록에 마우스를 올리면 왼쪽에 뜬다. ＋는 아래에 블록을 만들고 슬래시 메뉴를 연다.
 * ⋮⋮는 끌어서 옮기고(놓일 자리에 accent 2px 선), 누르면 블록 전체를 고른다.
 */
const meta = {
  title: "L4 에디터/ED-BlockHandle",
  component: EditorSpecimen,
  args: { content: CONTENT },
  // 핸들이 본문 왼쪽 바깥(48px)에 뜨므로 여백을 둔다
  decorators: [(Story) => <div className="pl-12">{Story()}</div>],
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** hover — 문단에 마우스를 올린 상태 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    getEditor(canvasElement);
    hoverBlock(canvasElement.querySelector(".ProseMirror > p")!);
    const add = await within(document.body).findByRole("button", { name: "아래에 블록 추가" });
    await waitFor(() => expect(add).toBeVisible());
  },
};

/** ＋ — 아래에 빈 블록을 만들고 슬래시 메뉴를 연다 */
export const AddBelow: Story = {
  // 열린 슬래시 메뉴의 스크롤 영역 — ED-SlashMenu 스토리와 같은 이유로 이 규칙만 끈다
  parameters: {
    a11y: { config: { rules: [{ id: "scrollable-region-focusable", enabled: false }] } },
  },
  play: async ({ canvasElement }) => {
    getEditor(canvasElement);
    hoverBlock(canvasElement.querySelector(".ProseMirror > h2")!);
    await userEvent.click(
      await within(document.body).findByRole("button", { name: "아래에 블록 추가" }),
    );
    await within(document.body).findByRole("listbox", { name: "블록 넣기" });
    // 제목 바로 아래에 "/"만 든 새 문단이 생긴다
    await expect(canvasElement.querySelector(".ProseMirror > h2 + p")).toHaveTextContent(/^\/$/);
  },
};

/** ⋮⋮ 누르기 — 블록 전체를 고른다 */
export const SelectBlock: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    hoverBlock(canvasElement.querySelector(".ProseMirror > blockquote")!);
    await userEvent.click(
      await within(document.body).findByRole("button", { name: /끌어서 옮기기/ }),
    );
    await waitFor(() => expect(editor.state.selection.toJSON().type).toBe("node"));
  },
};

/** ⌘⇧↓ / ⌘⇧↑ — 핸들 없이 키보드로 캐럿이 있는 블록을 옮긴다 */
export const KeyboardMove: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    const names = () => editor.state.doc.content.content.map((n) => n.type.name).slice(0, 2);
    // ProseMirror의 Mod는 macOS에서 ⌘, 그 밖에서는 Ctrl이다
    const mod = /Mac|iP(hone|ad)/.test(navigator.platform) ? "Meta" : "Control";
    editor.chain().focus().setTextSelection(2).run();
    // Tiptap의 focus()는 다음 프레임에 포커스를 옮긴다 — 키를 누르기 전에 기다린다
    await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
    await userEvent.keyboard(`{${mod}>}{Shift>}{ArrowDown}{/Shift}{/${mod}}`);
    await expect(names()).toEqual(["paragraph", "heading"]);
    await userEvent.keyboard(`{${mod}>}{Shift>}{ArrowUp}{/Shift}{/${mod}}`);
    await expect(names()).toEqual(["heading", "paragraph"]);
  },
};

/** ⌘/ — 캐럿이 있는 블록에 블록 메뉴가 붙고 첫 항목에 포커스가 간다. Esc는 닫고 캐럿으로 돌아간다 */
export const KeyboardMenu: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    const doc = canvasElement.ownerDocument.body;
    const mod = /Mac|iP(hone|ad)/.test(navigator.platform) ? "Meta" : "Control";
    editor.chain().focus().setTextSelection(2).run();
    await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
    await userEvent.keyboard(`{${mod}>}/{/${mod}}`);
    const menu = await within(doc).findByRole("menu", { name: "블록 메뉴" });
    await waitFor(() =>
      expect(within(menu).getByRole("menuitem", { name: "아래에 블록 추가" })).toHaveFocus(),
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(doc).queryByRole("menu", { name: "블록 메뉴" })).toBeNull());
    await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
  },
};
