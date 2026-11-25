import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";

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
 */
const meta = {
  title: "L4 에디터/ED-ToggleHeading",
  component: EditorSpecimen,
  args: { content: CONTENT },
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

const LONG_TITLE =
  "분기 검토 회의에서 나온 결정 사항을 모두 정리하고 담당자와 기한을 다시 확인한 뒤 공유 문서에 옮긴다";

/**
 * 첫 줄 맞춤: H1–H3, 펼침·접힘, 여러 줄로 줄어드는 긴 제목.
 * 단추 가운데와 제목 첫 줄 가운데의 차이가 2px 이내여야 한다 (다크·라이트 모두 같은 기하).
 */
export const Alignment: Story = {
  args: {
    content: `<div data-type="toggleHeading" data-open="true"><h1>${LONG_TITLE}</h1><p>본문 1</p></div><div data-type="toggleHeading" data-open="false"><h1>회의록</h1><p>숨은 본문</p></div><div data-type="toggleHeading" data-open="true"><h2>${LONG_TITLE}</h2><p>본문 2</p></div><div data-type="toggleHeading" data-open="false"><h2>결정 사항</h2><p>숨은 본문</p></div><div data-type="toggleHeading" data-open="true"><h3>${LONG_TITLE}</h3><p>본문 3</p></div><div data-type="toggleHeading" data-open="false"><h3>세부 작업</h3><p>숨은 본문</p></div>`,
  },
  play: async ({ canvasElement }) => {
    const rows = [...canvasElement.querySelectorAll<HTMLElement>('[data-type="toggleHeading"]')];
    await expect(rows).toHaveLength(6);
    for (const row of rows) {
      const heading = row.querySelector<HTMLElement>("h1, h2, h3");
      const button = row.querySelector<HTMLElement>("button");
      await expect(heading).not.toBeNull();
      await expect(button).not.toBeNull();
      // 제목 첫 줄의 글자 상자 (여러 줄이면 첫 번째 줄 조각)
      const range = document.createRange();
      range.selectNodeContents(heading!);
      const line = range.getClientRects()[0];
      const lineCenter = line.top + line.height / 2;
      const box = button!.getBoundingClientRect();
      const buttonCenter = box.top + box.height / 2;
      await expect(Math.abs(buttonCenter - lineCenter)).toBeLessThanOrEqual(2);
    }
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
    // 캐럿을 두고 포커스가 실제로 에디터에 들어올 때까지 기다린다 (키 입력이 에디터로 가도록)
    const caretAtEnd = async (text: string) => {
      let at = -1;
      editor.state.doc.descendants((n, pos) => {
        if (at < 0 && n.isTextblock && n.textContent === text) at = pos + 1 + n.content.size;
        return at < 0;
      });
      editor.chain().focus().setTextSelection(at).run();
      await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
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
    await caretAtEnd("1분기 계획");
    await userEvent.keyboard(`{${m}>}{Shift>}{Enter}{/Shift}{/${m}}`);
    await expect(toggles()[0].open).toBe(false);
    await waitFor(() => expect(bodyOf(0)).not.toBeNull());
    await expect(bodyOf(0)?.hidden).toBe(true);

    // 2) 다시 ⌘⇧↵ → 펼쳐진다
    await userEvent.keyboard(`{${m}>}{Shift>}{Enter}{/Shift}{/${m}}`);
    await expect(toggles()[0].open).toBe(true);
    await expect(bodyOf(0)).toBeNull();

    // 3) 접힌 두 번째 토글의 제목 끝에서 Enter → 문단이 생기고 토글이 펼쳐진다
    await caretAtEnd("배포 체크리스트");
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
    await expect(button.getAttribute("aria-label")).toBe("토글");
    await expect(button.getAttribute("aria-expanded")).toBe("false");
  },
};

/** 펼침 단추 툴팁: 마우스를 올리면 「토글 접기」가 보이고, 포커스는 옮겨 가지 않는다 */
export const Tooltip: Story = {
  args: {
    content: OPEN_H1,
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLElement>('[data-type="toggleHeading"] button');
    await expect(button).not.toBeNull();
    const before = document.activeElement;
    await userEvent.hover(button!);
    await waitFor(() =>
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe("접기"),
    );
    await expect(document.activeElement).toBe(before);
    await expect(
      canvasElement.querySelector('[data-type="toggleHeading"]')?.getAttribute("data-open"),
    ).toBe("true");
    // 키보드 포커스에서도 툴팁이 열리고, 열린 뒤에도 포커스는 단추에 남는다
    await userEvent.unhover(button!);
    await waitFor(() => expect(document.querySelector('[role="tooltip"]')).toBeNull());
    button!.focus();
    await waitFor(() =>
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe("접기"),
    );
    await expect(document.activeElement).toBe(button);
  },
};
