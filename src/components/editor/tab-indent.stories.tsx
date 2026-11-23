import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Editor } from "@tiptap/core";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";
import { Toaster } from "@/components/ui/toast";
import { resetTabIndentHint } from "./tab-indent";

const CONTENT =
  "<p>회의 메모</p><p>\t들여 쓴 줄 — 탭 한 번</p><p>\t\t두 번 들여 쓴 줄</p><h3>\t제목도 들여쓸 수 있어요</h3><blockquote><p>\t인용 안에서도</p></blockquote>";

/**
 * Tab 들여쓰기 — 글을 쓰다 Tab을 누르면 포커스가 다음 칸으로 가지 않고 탭 문자(글자 2개 폭)를 넣는다.
 * Shift+Tab은 캐럿 앞(없으면 줄 맨 앞)의 탭을 지운다. 여러 줄을 고르면 줄마다.
 * 목록(하위 항목) · 표(다음 칸) · 코드 블록(2칸)은 각자의 Tab 동작을 따른다. Esc 다음 Tab은 에디터 밖으로.
 */
const meta = {
  title: "L4 에디터/ED-TabIndent",
  component: EditorSpecimen,
  args: { content: CONTENT },
  // 처음 들여쓸 때 뜨는 안내 토스트를 그린다
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

async function caretAt(editor: Editor, html: string, offset?: number) {
  editor.commands.setContent(html);
  // 첫 글 블록 안 (offset 없으면 끝)
  let at = -1;
  editor.state.doc.descendants((n, pos) => {
    if (at < 0 && n.isTextblock) at = pos + 1 + (offset ?? n.content.size);
    return at < 0;
  });
  editor.chain().focus().setTextSelection(at).run();
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
}
const first = (e: Editor) => e.state.doc.firstChild!;

/** 문단 — 캐럿 자리에 탭, 고른 글자는 탭으로 바뀜, Shift+Tab은 앞의 탭부터 지운다. 포커스는 에디터에 남는다 */
export const Paragraph: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    resetTabIndentHint();
    await caretAt(editor, "<p>회의 메모</p>", 0);
    await userEvent.keyboard("{Tab}");
    await expect(first(editor).textContent).toBe("\t회의 메모");
    await expect(editor.view.hasFocus()).toBe(true);
    // 처음 들여쓸 때 한 번 나가는 방법을 알린다
    await expect(
      await within(document.body).findByText("본문에서 나가려면 Esc를 누른 다음 Tab을 누르세요."),
    ).toBeInTheDocument();
    // 글 중간
    editor.commands.setTextSelection(4); // "\t회의|"
    await userEvent.keyboard("{Tab}");
    await expect(first(editor).textContent).toBe("\t회의\t 메모");
    // 고른 글자를 탭으로
    editor.commands.setTextSelection({ from: 5, to: 7 });
    await userEvent.keyboard("{Tab}");
    await expect(first(editor).textContent).toBe("\t회의\t\t모");
    // Shift+Tab: 캐럿 바로 앞의 탭
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect(first(editor).textContent).toBe("\t회의\t모");
    // 앞이 탭이 아니면 줄 맨 앞의 탭
    editor.commands.setTextSelection(first(editor).nodeSize - 1);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect(first(editor).textContent).toBe("회의\t모");
    // 지울 탭이 없어도 에디터 밖으로 나가지 않는다
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect(first(editor).textContent).toBe("회의\t모");
    await expect(editor.view.hasFocus()).toBe(true);
    // 실행 취소
    editor.commands.undo();
    await waitFor(() => expect(first(editor).textContent).not.toBe("회의\t모"));
  },
};

/** 여러 줄 — 줄마다 맨 앞에 탭, Shift+Tab으로 줄마다 하나씩 뺀다 */
export const MultipleLines: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await caretAt(editor, "<p>하나</p><h2>둘</h2><blockquote><p>셋</p></blockquote>", 0);
    editor.commands.setTextSelection({ from: 2, to: editor.state.doc.content.size - 3 });
    await userEvent.keyboard("{Tab}");
    const texts = () => {
      const out: string[] = [];
      editor.state.doc.descendants((n) => {
        if (n.isTextblock) out.push(n.textContent);
        return !n.isTextblock;
      });
      return out.slice(0, 3);
    };
    await expect(texts()).toEqual(["\t하나", "\t둘", "\t셋"]);
    await userEvent.keyboard("{Tab}");
    await expect(texts()).toEqual(["\t\t하나", "\t\t둘", "\t\t셋"]);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect(texts()).toEqual(["\t하나", "\t둘", "\t셋"]);
    // 전체 선택(⌘A) 뒤 Tab도 줄마다
    editor.commands.selectAll();
    await userEvent.keyboard("{Tab}");
    await expect(texts()).toEqual(["\t\t하나", "\t\t둘", "\t\t셋"]);
  },
};

/** 다른 블록은 자기 Tab — 목록은 하위 항목, 표는 다음 칸, 코드 블록은 2칸 */
export const OtherBlocksKeepTheirTab: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await caretAt(editor, "<ul><li><p>첫 항목</p></li><li><p>둘째 항목</p></li></ul>");
    editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize - 4);
    await userEvent.keyboard("{Tab}");
    await waitFor(() => {
      let nested = false;
      editor.state.doc.descendants((n) => {
        if (n.type.name === "listItem" && n.childCount > 1) nested = true;
      });
      expect(nested).toBe(true);
    });
    await expect(editor.state.doc.textContent).not.toContain("\t");

    await caretAt(editor, "<table><tr><td><p>가</p></td><td><p>나</p></td></tr></table>");
    await userEvent.keyboard("{Tab}");
    await expect(editor.state.selection.$from.parent.textContent).toBe("나");
    await expect(editor.state.doc.textContent).not.toContain("\t");

    await caretAt(editor, "<pre><code>let a = 1;</code></pre>", 0);
    await userEvent.keyboard("{Tab}");
    await expect(first(editor).textContent).toBe("  let a = 1;");
  },
};

/** 키보드로 빠져나가기 — Esc 다음 Tab이면 다음 요소로 포커스가 간다. 다른 키를 치면 다시 들여쓰기 */
export const EscapeThenTabLeaves: Story = {
  render: (args) => (
    <div className="grid gap-4">
      <EditorSpecimen {...args} />
      <button type="button" className="justify-self-start">
        다음 버튼
      </button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await caretAt(editor, "<p>회의 메모</p>");
    await userEvent.keyboard("{Escape}{ArrowLeft}{Tab}");
    await expect(first(editor).textContent).toBe("회의 메\t모");
    await userEvent.keyboard("{Escape}{Tab}");
    await expect(within(canvasElement).getByRole("button", { name: "다음 버튼" })).toHaveFocus();
    await expect(first(editor).textContent).toBe("회의 메\t모");
  },
};
