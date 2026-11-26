import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";

const col = (width: number, html: string) =>
  `<div data-type="column" data-width="${width}">${html}</div>`;
const block = (html: string) => `<div data-type="columns">${html}</div>`;

const TWO = block(
  col(1, "<p>왼쪽 열 — 할 일 목록</p><p>두 번째 문단</p>") + col(1, "<p>오른쪽 열 — 메모</p>"),
);
const THREE = block(col(1, "<p>첫째 열</p>") + col(1, "<p>둘째 열</p>") + col(1, "<p>셋째 열</p>"));
const FOUR = block(
  col(1, "<p>1</p>") + col(1, "<p>2</p>") + col(1, "<p>3</p>") + col(1, "<p>4</p>"),
);
const RESIZED = block(col(2, "<p>넓은 열 (비율 2)</p>") + col(1, "<p>좁은 열 (비율 1)</p>"));

const meta = {
  title: "L4 에디터/ED-Columns",
  component: EditorSpecimen,
  args: {
    content: `<p>단 나누기 위아래 본문</p>${TWO}<p>아래 문단</p>`,
  },
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 2열 (기본) */
export const TwoColumns: Story = {};

/** 3열 */
export const ThreeColumns: Story = { args: { content: THREE } };

/** 4열 */
export const FourColumns: Story = { args: { content: FOUR } };

/** 비율이 다른 2열 (손잡이로 바꾼 뒤의 모습). data-width(2·1)가 flex 비율로 그려진다 */
export const Resized: Story = {
  args: { content: RESIZED },
  play: async ({ canvasElement }) => {
    const cols = canvasElement.querySelectorAll<HTMLElement>('[data-type="column"]');
    await expect(cols[0].style.flexGrow).toBe("2");
    await expect(cols[1].style.flexGrow).toBe("1");
  },
};

/**
 * 손잡이 끌기: 경계 손잡이에서 포인터를 누르고 옮기면 두 열의 비율(data-width)이 바뀌고 합계는 그대로다.
 * 놓은 뒤에는 노드 attrs(문서)에 저장되어 flex-grow가 같이 바뀐다.
 */
export const DragResize: Story = {
  args: { content: TWO },
  play: async ({ canvasElement }) => {
    const handle = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLElement>('[data-type="columns"] > [aria-hidden]');
      if (!el) throw new Error("손잡이가 아직 없다");
      return el;
    });
    const cols = () => [...canvasElement.querySelectorAll<HTMLElement>('[data-type="column"]')];
    const before = cols().map((c) => Number(c.dataset.width));

    const r = handle.getBoundingClientRect();
    const x0 = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const pointer = (type: string, x: number, target: EventTarget) =>
      target.dispatchEvent(
        new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 }),
      );
    pointer("pointerdown", x0, handle);
    const first = cols()[0];
    for (const dx of [20, 40, 60]) pointer("pointermove", x0 + dx, window);
    // 놓기 전(끄는 중)에도 왼쪽 열이 따라 넓어져야 한다. 열 요소가 떨어져 나가면 안 된다(미리보기 회귀 방지)
    await expect(first.isConnected).toBe(true);
    await expect(Number(getComputedStyle(first).flexGrow)).toBeGreaterThan(before[0]);
    pointer("pointerup", x0 + 60, window);

    await waitFor(() => expect(Number(cols()[0].dataset.width)).toBeGreaterThan(before[0]));
    const after = cols().map((c) => Number(c.dataset.width));
    await expect(after[0] + after[1]).toBeCloseTo(before[0] + before[1]);
    await expect(Number(cols()[0].style.flexGrow)).toBeCloseTo(after[0]);
  },
};

/** 좁은 폭(32rem 아래): 열이 세로로 쌓인다 */
export const Narrow: Story = {
  args: { content: THREE },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

/** 읽기 전용 */
export const ReadOnly: Story = { args: { content: TWO, editable: false } };

/**
 * 키보드 play: Mod-Alt-←/→로 열 사이를 옮기고(끝 열에서는 멈춤), Mod-Alt-Shift-←/→로 캐럿 열 폭을 바꾸고,
 * Tab은 가로채지 않고 열 안에 탭 문자를 넣는다(EDIT-22).
 */
export const Keyboard: Story = {
  args: { content: THREE },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    // Tiptap의 Mod는 맥에서 ⌘(Meta), 그 밖에서 Ctrl
    const m = navigator.platform.includes("Mac") ? "Meta" : "Control";
    const columnIndex = () => {
      const { $from } = editor.state.selection;
      for (let d = $from.depth; d > 1; d--) {
        if ($from.node(d).type.name === "column") return $from.index(d - 1);
      }
      return -1;
    };
    const caretInColumn = async (text: string, where: "start" | "end" = "end") => {
      let at = -1;
      editor.state.doc.descendants((n, pos) => {
        if (at < 0 && n.isTextblock && n.textContent === text)
          at = where === "start" ? pos + 1 : pos + 1 + n.content.size;
        return at < 0;
      });
      editor.chain().focus().setTextSelection(at).run();
      await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
    };
    const widths = () => {
      const out: number[] = [];
      editor.state.doc.descendants((n) => {
        if (n.type.name === "columns") n.forEach((c) => out.push(Number(c.attrs.width)));
        return true;
      });
      return out;
    };

    // 1) 첫 열에서 Mod-Alt-→ → 둘째 열로
    await caretInColumn("첫째 열");
    await userEvent.keyboard(`{${m}>}{Alt>}{ArrowRight}{/Alt}{/${m}}`);
    await expect(columnIndex()).toBe(1);
    // 2) 한 번 더 → 셋째 열
    await userEvent.keyboard(`{${m}>}{Alt>}{ArrowRight}{/Alt}{/${m}}`);
    await expect(columnIndex()).toBe(2);
    // 3) 끝 열에서 Mod-Alt-→ → 그대로 (멈춤)
    await userEvent.keyboard(`{${m}>}{Alt>}{ArrowRight}{/Alt}{/${m}}`);
    await expect(columnIndex()).toBe(2);
    // 4) Mod-Alt-← → 둘째 열
    await userEvent.keyboard(`{${m}>}{Alt>}{ArrowLeft}{/Alt}{/${m}}`);
    await expect(columnIndex()).toBe(1);

    // 5) Mod-Alt-Shift-→ → 둘째 열이 넓어지고 셋째 열이 줄어든다(합은 그대로)
    const before = widths();
    await userEvent.keyboard(`{${m}>}{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}{/${m}}`);
    const after = widths();
    await expect(after[1]).toBeGreaterThan(before[1]);
    await expect(after[1] + after[2]).toBeCloseTo(before[1] + before[2]);

    // 6) Tab은 열 안(줄 맨 앞)에 탭 문자를 넣고 포커스는 에디터에 남는다
    await caretInColumn("둘째 열", "start");
    await userEvent.keyboard("{Tab}");
    await expect(editor.state.doc.textContent.includes("\t둘째 열")).toBe(true);
    await expect(editor.view.hasFocus()).toBe(true);
  },
};
