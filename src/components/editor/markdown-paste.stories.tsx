import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Editor } from "@tiptap/core";
import { expect, waitFor } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";

const SAMPLE = [
  "# 출시 회고",
  "",
  "이번 분기에는 **검색**과 *초성 찾기*를 넣었어요. 자세한 건 [설계 문서](https://example.com/design)와 `search-index.ts`를 보세요.",
  "",
  "## 잘한 점",
  "",
  "- 키보드만으로 쓸 수 있어요",
  "- 화면 크기를 바꿀 수 있어요",
  "  - 80%부터 150%까지",
  "",
  "1. 디자인 검토",
  "2. 접근성 점검",
  "",
  "- [x] 검색 순위 고치기",
  "- [ ] 마크다운 붙여넣기",
  "",
  "> 작게 자주 내보내기",
  "",
  "```ts",
  "const zoom = stepZoom(1, 1);",
  "```",
  "",
  "| 항목 | 상태 |",
  "| --- | --- |",
  "| 검색 | 완료 |",
  "| 붙여넣기 | 진행 |",
  "",
  "---",
  "",
  "끝.",
].join("\n");

/**
 * 마크다운 붙여넣기 — 다른 앱이나 AI 답변에서 복사한 마크다운을 블록과 서식으로 바꿔 붙인다.
 * 평범한 글, ⇧⌘V(서식 없이), 코드 블록 안은 지금처럼 글자 그대로.
 */
const meta = {
  title: "L4 에디터/ED-MarkdownPaste",
  component: EditorSpecimen,
  args: { content: "<p></p>" },
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 실제 붙여넣기 이벤트 (글자, 필요하면 HTML도 함께) */
function paste(editor: Editor, text: string, html?: string) {
  const data = new DataTransfer();
  data.setData("text/plain", text);
  if (html) data.setData("text/html", html);
  editor.view.dom.dispatchEvent(
    new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
  );
}

async function emptyDoc(editor: Editor, html = "<p></p>") {
  editor.commands.setContent(html);
  editor.chain().focus("start").run();
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
}

const types = (e: Editor) => {
  const out: string[] = [];
  e.state.doc.forEach((n) => out.push(n.type.name));
  return out;
};
const marksOf = (e: Editor, text: string) => {
  let found: string[] | null = null;
  e.state.doc.descendants((n) => {
    if (found === null && n.isText && n.text === text) found = n.marks.map((m) => m.type.name);
  });
  return found;
};

/** 보기: 붙여 넣은 결과 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await emptyDoc(editor);
    paste(editor, SAMPLE);
  },
};

/** 블록마다 맞는 노드로 — 제목·목록(중첩)·할 일(체크 상태)·인용·코드(언어)·표·구분선 */
export const Blocks: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await emptyDoc(editor);
    paste(editor, SAMPLE);
    await waitFor(() => expect(types(editor)[0], "첫 블록").toBe("heading"));
    await expect(types(editor).slice(0, 11), "블록 순서").toEqual([
      "heading",
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "taskList",
      "blockquote",
      "codeBlock",
      "table",
      "horizontalRule",
      "paragraph",
    ]);
    const doc = editor.state.doc;
    await expect(doc.child(0).attrs.level, "# → 제목 1").toBe(1);
    await expect(doc.child(2).attrs.level, "## → 제목 2").toBe(2);
    // 중첩 목록
    const nested = doc.child(3).child(1).lastChild!;
    await expect(nested.type.name, "하위 목록").toBe("bulletList");
    await expect(nested.textContent).toBe("80%부터 150%까지");
    // 할 일: 체크 상태, 글자 앞 공백 없음
    const tasks = doc.child(5);
    await expect(tasks.child(0).attrs.checked, "[x]").toBe(true);
    await expect(tasks.child(1).attrs.checked, "[ ]").toBe(false);
    await expect(tasks.child(1).textContent).toBe("마크다운 붙여넣기");
    // 코드 블록 언어
    await expect(doc.child(7).attrs.language, "```ts → 별칭 정리").toBe("typescript");
    await expect(doc.child(7).textContent).toBe("const zoom = stepZoom(1, 1);");
    // 표: 머리 행 + 2행
    await expect(doc.child(8).childCount, "표 행").toBe(3);
    await expect(doc.child(8).child(0).child(0).type.name).toBe("tableHeader");
    // 글 안 서식
    await expect(marksOf(editor, "검색"), "**굵게**").toEqual(["bold"]);
    await expect(marksOf(editor, "초성 찾기"), "*기울임*").toEqual(["italic"]);
    await expect(marksOf(editor, "설계 문서"), "[링크]()").toEqual(["link"]);
    await expect(marksOf(editor, "search-index.ts"), "`코드`").toEqual(["code"]);
    // 실행 취소 한 번이면 붙여넣기 전으로
    editor.commands.undo();
    await expect(editor.state.doc.textContent).toBe("");
  },
};

/** 평범한 글은 지금처럼 줄마다 문단. 마크다운 기호처럼 보이지 않으면 건드리지 않는다 */
export const PlainText: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await emptyDoc(editor);
    paste(editor, "오늘 할 일을 정리했어요\n내일은 디자인 검토");
    await waitFor(() => expect(editor.state.doc.childCount).toBe(2));
    await expect(types(editor)).toEqual(["paragraph", "paragraph"]);
    await expect(editor.state.doc.child(1).textContent).toBe("내일은 디자인 검토");
  },
};

/** 코드 블록 안에서는 마크다운도 글자 그대로 */
export const InsideCodeBlock: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await emptyDoc(editor, "<pre><code>x</code></pre>");
    editor.commands.setTextSelection(2);
    paste(editor, "# 제목\n- 항목");
    await waitFor(() => expect(editor.state.doc.firstChild!.textContent).toBe("x# 제목\n- 항목"));
    await expect(types(editor)[0]).toBe("codeBlock");
  },
};

/** 코드 편집기처럼 글자를 HTML 껍데기에 싸서 줘도 마크다운으로. 웹 페이지 HTML은 HTML 그대로 */
export const FromCodeEditor: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await emptyDoc(editor);
    const text = "## 메모\n- [ ] 확인하기";
    paste(
      editor,
      text,
      '<div style="white-space: pre;"><div><span>## 메모</span></div><div><span>- [ ] 확인하기</span></div></div>',
    );
    await waitFor(() => expect(types(editor).slice(0, 2)).toEqual(["heading", "taskList"]));

    await emptyDoc(editor);
    paste(editor, "웹 제목\n본문", "<h1>웹 제목</h1><p>본문</p>");
    await waitFor(() => expect(types(editor).slice(0, 2)).toEqual(["heading", "paragraph"]));
    await expect(editor.state.doc.firstChild!.textContent).toBe("웹 제목");
  },
};

/** 원본의 HTML 조각은 스키마에 없으면 버린다 — 스크립트·원격 이미지가 들어오지 않는다 */
export const UnsafeHtmlDropped: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await emptyDoc(editor);
    paste(
      editor,
      '# 제목\n\n<img src="x" onerror="window.__pwned=1">\n\n<script>window.__pwned=1</script>\n\n끝',
    );
    await waitFor(() => expect(types(editor)[0]).toBe("heading"));
    await expect(canvasElement.querySelector(".ProseMirror img"), "img 없음").toBeNull();
    await expect(canvasElement.querySelector(".ProseMirror script"), "script 없음").toBeNull();
    await expect((window as { __pwned?: number }).__pwned).toBeUndefined();
  },
};
