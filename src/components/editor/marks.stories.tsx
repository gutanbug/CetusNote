import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";

const CONTENT =
  '<p><strong>굵게</strong>, <em>기울임</em>, <u>밑줄</u>, <s>취소선</s>, <code>인라인 코드</code>, <a href="https://tiptap.dev">링크</a></p><p>하이라이트: <mark>노랑</mark> <mark data-color="var(--c-blue-bg)" style="background-color: var(--c-blue-bg)">파랑</mark> <mark data-color="var(--c-green-bg)" style="background-color: var(--c-green-bg)">초록</mark> <mark data-color="var(--c-pink-bg)" style="background-color: var(--c-pink-bg)">분홍</mark></p><p>글자색: <span style="color: var(--c-red-fg)">빨강</span> <span style="color: var(--c-blue-fg)">파랑</span> <span style="color: var(--c-purple-fg)">보라</span></p><p>H<sub>2</sub>O, E = mc<sup>2</sup>, 각주<sup>1</sup></p><p style="text-align: center">가운데 정렬 문단</p><p style="text-align: right">오른쪽 정렬 문단</p><p>자동 변환: -&gt; → , -- → —, (c) → ©, 1/2 → ½ 를 직접 입력해 보세요. 이모지: :rocket: 처럼 입력.</p>';

/** 인라인 서식 — **굵게** *기울임* ~~취소선~~ `코드` ==하이라이트==, ⌘U 밑줄, ⌘. 위 첨자, ⌘, 아래 첨자 */
const meta = {
  title: "L4 에디터/ED-InlineMarks",
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

/** 자동 변환 — 기호는 글자로 남는다(이모지가 되지 않음). `:rocket:`은 이모지 */
export const AutoReplace: Story = {
  args: { content: "<p></p>" },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    editor.commands.focus("end");
    await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
    await userEvent.keyboard("(c) (r) (tm) -> 1/2 :rocket: ");
    await waitFor(() => expect(editor.state.doc.textContent).toContain("© ® ™ → ½"));
    const kinds: string[] = [];
    editor.state.doc.descendants((n) => {
      if (n.isInline) kinds.push(n.type.name);
    });
    // 이모지 노드는 :rocket: 하나뿐
    await expect(kinds.filter((k) => k === "emoji")).toHaveLength(1);
  },
};
