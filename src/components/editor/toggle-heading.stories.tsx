import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";
import { ToggleHeading } from "./toggle-heading";

const OPEN_H1 =
  '<div data-type="toggleHeading" data-open="true"><h1>1분기 계획</h1><p>에디터 기본 블록을 끝낸다.</p><p>검색 색인을 점검한다.</p></div>';
const CLOSED_H2 =
  '<div data-type="toggleHeading" data-open="false"><h2>배포 체크리스트</h2><p>접힌 동안 숨겨지는 내용</p></div>';
const OPEN_H3 =
  '<div data-type="toggleHeading" data-open="true"><h3>세부 작업</h3><p>코드 블록과 표를 먼저 만든다.</p></div>';
const CONTENT = `<p>토글 제목은 제목 줄 자체가 접힌다.</p>${OPEN_H1}${CLOSED_H2}${OPEN_H3}<p>본문은 토글 밖에 그대로 남는다.</p>`;

/**
 * ED-ToggleHeading — 제목(H1–H3) 줄이 접히는 토글. 펼침 상태는 문서에 저장된다.
 * 키보드: ⌘⇧↵(또는 펼침 단추에 포커스 후 Enter·Space)로 접고 펼친다. 접힌 제목 끝에서 Enter를 치면 펼쳐진다.
 * 이 견본은 ED-Editor 확장 묶음에 아직 넣지 않은 노드를 `extraExtensions`로 붙인다(phase 2에서 등록).
 */
const meta = {
  title: "L4 에디터/ED-ToggleHeading",
  component: EditorSpecimen,
  args: { content: CONTENT, extraExtensions: [ToggleHeading] },
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 모두 접힌 상태 (접힌 제목만 보인다) */
export const Collapsed: Story = {
  args: {
    content: `<div data-type="toggleHeading" data-open="false"><h1>회의록</h1><p>숨겨진 내용 1</p></div><div data-type="toggleHeading" data-open="false"><h2>결정 사항</h2><p>숨겨진 내용 2</p></div>`,
  },
};

/** 읽기 전용 (휴지통 미리보기 등): 펼침 단추는 눌리지 않고 상태만 보인다 */
export const ReadOnly: Story = {
  args: { editable: false },
};

/** 키보드 play: 접기·펼치기 단축키, 접힌 제목 끝의 Enter, 펼침 단추의 Enter */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    const toggles = () => {
      const out: { open: boolean; body: number }[] = [];
      editor.state.doc.forEach((node) => {
        if (node.type.name === "toggleHeading")
          out.push({ open: node.attrs.open !== false, body: node.childCount - 1 });
      });
      return out;
    };
    const caretAtEnd = (text: string) => {
      let at = -1;
      editor.state.doc.descendants((n, pos) => {
        if (at < 0 && n.isTextblock && n.textContent === text) at = pos + 1 + n.content.size;
        return at < 0;
      });
      editor.chain().focus().setTextSelection(at).run();
    };
    const bodyOf = (index: number) =>
      canvasElement
        .querySelectorAll<HTMLElement>('[data-type="toggleHeading"]')
        [index]?.querySelector<HTMLElement>("[data-collapsed]");

    // 0) HTML의 data-open="false"는 접힌 채로 읽힌다 (두 번째 토글)
    await expect(toggles()[1].open).toBe(false);

    // Tiptap의 Mod는 맥에서 ⌘(Meta), 그 밖에서 Ctrl
    const m = navigator.platform.includes("Mac") ? "Meta" : "Control";
    // 1) 첫 번째 토글 제목 끝에서 ⌘⇧↵ → 접힌다. 내용은 숨긴다
    caretAtEnd("1분기 계획");
    await userEvent.keyboard(`{${m}>}{Shift>}{Enter}{/Shift}{/${m}}`);
    await expect(toggles()[0].open).toBe(false);
    await waitFor(() => expect(bodyOf(0)).not.toBeNull());
    await expect(bodyOf(0)?.hidden).toBe(true);

    // 2) 다시 ⌘⇧↵ → 펼쳐진다
    await userEvent.keyboard(`{${m}>}{Shift>}{Enter}{/Shift}{/${m}}`);
    await expect(toggles()[0].open).toBe(true);
    await expect(bodyOf(0)).toBeNull();

    // 3) 접힌 두 번째 토글의 제목 끝에서 Enter → 문단이 생기고 토글이 펼쳐진다
    caretAtEnd("배포 체크리스트");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(toggles()[1].open).toBe(true));
    await expect(toggles()[1].body).toBe(2);
    await expect(editor.view.hasFocus()).toBe(true);

    // 4) 펼침 단추에 포커스 후 Enter → 접힌다 (단추 이름·aria-expanded)
    const button = canvasElement.querySelectorAll<HTMLButtonElement>(
      '[data-type="toggleHeading"] button',
    )[2];
    button.focus();
    await expect(button.getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(toggles()[2].open).toBe(false));
    await expect(button.getAttribute("aria-expanded")).toBe("false");
    await expect(button.getAttribute("aria-label")).toBe("토글 펼치기");
  },
};
