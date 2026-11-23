import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";

const CONTENT =
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>주간 회고 쓰기</p></li><li data-type="taskItem" data-checked="false"><p>독서 노트 정리</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>1장 요약</p></li><li data-type="taskItem" data-checked="false"><p>2장 요약</p></li></ul></li><li data-type="taskItem" data-checked="false"><p>운동 30분</p></li></ul>';

/** 체크리스트 — `[ ]` `[x]` + 스페이스, 완료는 취소선 + 회색 */
const meta = {
  title: "L4 에디터/ED-TaskItem",
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

/** 설정 "완료한 체크 항목 흐리게"를 끈 모습 (SET-04) — 완료 항목도 보통 글자로 */
export const NotDimmed: Story = {
  args: { content: CONTENT, dimChecked: false },
};

/** EDIT-02 — 빈 항목 첫 문단에서 `- ` `1. ` `> ` `# ` 을 치면 항목을 빼고 그 블록으로 바꾼다 */
export const MarkdownShortcuts: Story = {
  args: { content: CONTENT },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    const EMPTY =
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li><li data-type="taskItem" data-checked="true"><p>둘째</p></li></ul>';
    const cases: [string, string][] = [
      ["1. ", "orderedList"],
      ["> ", "blockquote"],
      ["- ", "bulletList"],
      ["# ", "heading"],
    ];
    for (const [typed, expected] of cases) {
      editor.commands.setContent(EMPTY, { emitUpdate: false });
      // 빈 첫 항목 문단의 시작(1 목록 · 2 항목 · 3 문단)에 캐럿을 둔다
      editor.chain().focus().setTextSelection(3).run();
      await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
      await userEvent.keyboard(`${typed}할 일`);
      await expect(editor.state.doc.firstChild!.type.name).toBe(expected);
      await expect(editor.state.doc.firstChild!.textContent).toBe("할 일");
      // 항목 밖으로 빠진 뒤에도 남은 항목(둘째)은 체크리스트로 남는다
      await expect(editor.state.doc.child(1).type.name).toBe("taskList");
    }
  },
};
