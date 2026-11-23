import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Editor, JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { expect, fn, waitFor } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";

const CONTENT = [
  "<h2>출시 준비</h2>",
  "<ul><li><p>디자인 검토</p></li><li><p>접근성 점검</p></li></ul>",
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>검색 순위</p></li></ul>',
  "<pre><code>const zoom = 1;\nconst next = 2;</code></pre>",
].join("");

/** 견본 변환: 블록 종류와 글자를 한 줄씩 (실제 앱은 features/export의 마크다운 변환을 준다) */
function outline(doc: JSONContent): string {
  const out: string[] = [];
  const walk = (n: JSONContent, depth: number) => {
    if (n.type === "text") return;
    if (n.type !== "doc") out.push(`${"  ".repeat(depth)}${n.type}`);
    n.content?.forEach((c) => walk(c, depth + 1));
  };
  walk(doc, -1);
  return out.join("\n");
}

/**
 * 마크다운으로 복사(EDIT-26) — 여러 블록을 복사하면 다른 앱용 글자(text/plain)를 위 계층 변환(마크다운)으로 만든다.
 * 한 블록 안의 일부(코드 블록 포함)는 글자 그대로. HTML 클립보드는 바뀌지 않는다.
 */
const meta = {
  title: "L4 에디터/ED-CopyAsText",
  component: EditorSpecimen,
  args: { content: CONTENT, copyAsText: fn(outline) },
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 클립보드로 나갈 글자 (실제 복사와 같은 경로) */
const copied = (editor: Editor, from: number, to: number) => {
  editor.view.dispatch(
    editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to)),
  );
  return editor.view.serializeForClipboard(editor.state.selection.content()).text;
};
/** n번째 글 블록의 시작 위치 */
const blockStart = (editor: Editor, n: number) => {
  let i = 0;
  let at = -1;
  editor.state.doc.descendants((node, pos) => {
    if (at < 0 && node.isTextblock && i++ === n) at = pos + 1;
    return at < 0;
  });
  return at;
};

export const Copy: Story = {
  play: async ({ canvasElement, args }) => {
    const editor = getEditor(canvasElement);
    await waitFor(() => expect(editor.state.doc.childCount).toBeGreaterThan(3));
    // 여러 블록: 제목부터 할 일까지 → 변환 함수가 블록 구조째 받는다
    const end = blockStart(editor, 3) + "검색 순위".length;
    const text = copied(editor, blockStart(editor, 0), end);
    await expect(text, "여러 블록 → 변환").toContain("bulletList");
    await expect(text).toContain("taskList");
    await expect(args.copyAsText).toHaveBeenCalled();
    // 한 블록 안의 일부 → 글자 그대로 (변환을 부르지 않는다)
    vi(args.copyAsText).mockClear();
    const s = blockStart(editor, 1);
    await expect(copied(editor, s, s + 3), "문단 일부").toBe("디자인");
    // 코드 블록 안의 여러 줄 → 글자 그대로
    const c = blockStart(editor, 4);
    await expect(copied(editor, c, c + "const zoom = 1;\nconst".length)).toBe(
      "const zoom = 1;\nconst",
    );
    await expect(args.copyAsText).not.toHaveBeenCalled();
  },
};

/** 변환이 없으면(읽기 전용 견본 등) 기본 글자 */
export const WithoutSerializer: Story = {
  args: { copyAsText: undefined },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await waitFor(() => expect(editor.state.doc.childCount).toBeGreaterThan(3));
    const text = copied(editor, blockStart(editor, 0), blockStart(editor, 2) + 5);
    // 기본 글자는 목록 기호가 빠지고 블록마다 빈 줄이 붙는다 — EDIT-26이 고치는 모양
    await expect(text).toContain("디자인 검토");
    await expect(text).not.toMatch(/^- /m);
  },
};

function vi(mock: unknown) {
  return mock as { mockClear(): void };
}
