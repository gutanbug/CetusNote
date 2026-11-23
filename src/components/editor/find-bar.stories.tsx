import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Editor } from "@tiptap/core";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { getEditor } from "@/debug/editor-test";
import { FindBar } from "./find-bar";
import { getFind } from "./find-replace";
import { NoteEditor } from "./note-editor";

const CONTENT = [
  "<h2>주간 회의</h2>",
  "<p>이번 <strong>회</strong>의에서는 출시 일정을 정했어요. 다음 회의는 금요일이에요.</p>",
  "<ul><li><p>회의록 정리 — Rust 메모와 함께</p></li><li><p>디자인 검토</p></li></ul>",
  "<pre><code>// 회의 메모 스크립트\nconst rust = true;</code></pre>",
  "<p>RUST 설치는 다음 주에. 회의 끝.</p>",
].join("");

type Props = {
  replace?: boolean;
  initialQuery?: string;
  editable?: boolean;
  onClose?: () => void;
  onReplacedAll?: (n: number) => void;
};

/** 페이지 화면처럼: 본문 오른쪽 위에 막대 */
function FindSpecimen({ replace, initialQuery, editable = true, onClose, onReplacedAll }: Props) {
  const [editor, setEditor] = React.useState<Editor | null>(null);
  const [open, setOpen] = React.useState(true);
  return (
    <div className="relative mx-auto w-full max-w-(--content-w) pt-14">
      {open && editor ? (
        <FindBar
          editor={editor}
          replace={replace}
          initialQuery={initialQuery}
          onClose={() => {
            setOpen(false);
            onClose?.();
          }}
          onReplacedAll={onReplacedAll}
          className="absolute top-0 right-0 z-20"
        />
      ) : null}
      <NoteEditor content={CONTENT} editable={editable} onEditor={setEditor} />
    </div>
  );
}

/**
 * ED-FindBar — 페이지 안 찾기·바꾸기(⌘F · ⌥⌘F). 결과는 주황, 지금 결과는 포인트 색 채움.
 * Enter 다음 · ⇧Enter 이전 · Esc 닫기(지금 결과를 골라 두고 본문으로). 대소문자는 가리지 않는다.
 */
const meta = {
  title: "L4 에디터/ED-FindBar",
  component: FindSpecimen,
  args: { initialQuery: "회의", onClose: fn(), onReplacedAll: fn() },
} satisfies Meta<typeof FindSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 바꾸기 칸까지 (⌥⌘F) */
export const Replace: Story = { args: { replace: true, initialQuery: "Rust" } };

/** 결과 없음 */
export const NoResults: Story = { args: { initialQuery: "데이터베이스" } };

/** 읽기 전용 본문 — 바꾸기는 없다 */
export const ReadOnly: Story = { args: { editable: false, replace: true } };

const bar = (root: HTMLElement) => within(root).getByRole("search", { name: "페이지에서 찾기" });
const marks = (root: HTMLElement) => root.querySelectorAll(".ProseMirror .sn-find-match");
const current = (root: HTMLElement) =>
  root.querySelector(".ProseMirror .sn-find-current")?.textContent;

/** 찾기 — 서식 경계·목록·코드 블록까지, 대소문자 구분 없이. Enter 다음 · ⇧Enter 이전, 끝에서 돈다 */
export const Navigate: Story = {
  play: async ({ canvasElement }) => {
    const c = within(bar(canvasElement));
    const input = c.getByRole("textbox", { name: "찾을 글자" });
    await waitFor(() => expect(input).toHaveFocus());
    // 제목 1 + 문단(굵게 "회"+"의" 포함) 2 + 목록 1 + 코드 1 + 마지막 문단 1
    await waitFor(() => expect(c.getByText("1/6")).toBeInTheDocument());
    await expect(marks(canvasElement).length, "칠한 조각(굵게 경계는 둘로)").toBeGreaterThanOrEqual(
      6,
    );
    await userEvent.keyboard("{Enter}");
    await expect(c.getByText("2/6")).toBeInTheDocument();
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}{Shift>}{Enter}{/Shift}");
    await expect(c.getByText("6/6"), "처음에서 이전 → 끝").toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "다음 결과" }));
    await expect(c.getByText("1/6"), "끝에서 다음 → 처음").toBeInTheDocument();
    // 대소문자 무시
    await userEvent.clear(input);
    await userEvent.type(input, "rust");
    await waitFor(() => expect(c.getByText("1/3")).toBeInTheDocument());
    await expect(current(canvasElement)).toBe("Rust");
    // 결과 없음
    await userEvent.type(input, "zz");
    await expect(c.getByText("결과 없음")).toBeInTheDocument();
    await expect(c.getByRole("button", { name: "다음 결과" })).toBeDisabled();
    await expect(marks(canvasElement)).toHaveLength(0);
  },
};

/** 바꾸기 — 지금 결과만 바꾸고 다음으로, 모두 바꾸기는 실행 취소 한 번에 되돌린다 */
export const ReplaceFlow: Story = {
  args: { replace: true, initialQuery: "rust" },
  play: async ({ canvasElement, args }) => {
    const editor = getEditor(canvasElement);
    const c = within(bar(canvasElement));
    const to = c.getByRole("textbox", { name: "바꿀 글자" });
    await waitFor(() => expect(to).toHaveFocus());
    await waitFor(() => expect(c.getByText("1/3")).toBeInTheDocument());
    await userEvent.type(to, "Go");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(c.getByText("1/2")).toBeInTheDocument());
    await expect(editor.state.doc.textContent).toContain("Go 메모와 함께");
    await userEvent.click(c.getByRole("button", { name: "모두 바꾸기" }));
    await expect(args.onReplacedAll).toHaveBeenCalledWith(2);
    await expect(c.getByText("결과 없음")).toBeInTheDocument();
    await expect(editor.state.doc.textContent).toContain("const Go = true;");
    await expect(editor.state.doc.textContent).toContain("Go 설치는");
    editor.commands.undo();
    await expect(editor.state.doc.textContent, "모두 바꾸기 한 번 되돌림").toContain("RUST 설치는");
    await expect(editor.state.doc.textContent).toContain("Go 메모와 함께");
  },
};

/** Esc — 지금 결과를 본문에서 골라 두고 본문으로. 표시는 지운다 */
export const EscapeSelects: Story = {
  play: async ({ canvasElement, args }) => {
    const editor = getEditor(canvasElement);
    const c = within(bar(canvasElement));
    await waitFor(() => expect(c.getByText("1/6")).toBeInTheDocument());
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");
    await expect(args.onClose).toHaveBeenCalled();
    await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
    const { from, to } = editor.state.selection;
    await expect(editor.state.doc.textBetween(from, to)).toBe("회의");
    await expect(getFind(editor.state).query).toBe("");
    await expect(marks(canvasElement)).toHaveLength(0);
  },
};

/** 본문을 고치면 결과를 다시 센다 */
export const FollowsEdits: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    const c = within(bar(canvasElement));
    await waitFor(() => expect(c.getByText("1/6")).toBeInTheDocument());
    editor.commands.insertContentAt(editor.state.doc.content.size, "<p>새 회의 안건</p>");
    await waitFor(() => expect(c.getByText(/\/7$/)).toBeInTheDocument());
  },
};

/** 읽기 전용이면 바꾸기 칸·펼침 버튼이 없다 */
export const ReadOnlyHasNoReplace: Story = {
  args: { editable: false, replace: true },
  play: async ({ canvasElement }) => {
    const c = within(bar(canvasElement));
    await waitFor(() => expect(c.getByText("1/6")).toBeInTheDocument());
    await expect(c.queryByRole("textbox", { name: "바꿀 글자" })).toBeNull();
    await expect(c.queryByRole("button", { name: /바꾸기/ })).toBeNull();
  },
};
