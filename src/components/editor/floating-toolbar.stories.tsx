import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";

const CONTENT =
  "<p>다음 주 <strong>출시 일정</strong>을 정리했어요. 디자인 검토는 화요일, 배포는 목요일 오후로 잡았어요.</p><ul><li><p>디자인 검토</p></li><li><p>배포 준비</p></li></ul>";

/** 서식 바 — 글자를 고르면 위에 뜬다. ⌥F10으로 들어가 ←→로 옮기고 Esc로 본문에 돌아간다. */
const meta = {
  title: "L4 에디터/ED-FloatingToolbar",
  component: EditorSpecimen,
  args: { content: CONTENT },
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 본문을 고른 상태 — 블록 변환(텍스트) · B I U S · 코드 · 링크 · 색 · 하이라이트 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    editor.chain().focus().setTextSelection({ from: 25, to: 32 }).run();
    const bar = await within(document.body).findByRole("toolbar", { name: "텍스트 서식" });
    await expect(
      within(bar).getByRole("button", { name: /블록 변환, 지금은 텍스트/ }),
    ).toBeVisible();
  },
};

/** 서식 켜짐 — 굵게 쓴 글자를 고르면 B가 눌린 상태. 기울임을 눌러 더한다 */
export const FormatOn: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    editor.chain().focus().setTextSelection({ from: 6, to: 11 }).run();
    const bar = await within(document.body).findByRole("toolbar", { name: "텍스트 서식" });
    await expect(within(bar).getByRole("button", { name: "굵게" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(within(bar).getByRole("button", { name: "기울임" }));
    await waitFor(() =>
      expect(
        canvasElement.querySelector(".ProseMirror strong em, .ProseMirror em strong"),
      ).not.toBeNull(),
    );
  },
};

/** 키보드 — ⌥F10으로 바에 들어가 → 로 옮기고, 블록 변환에서 "제목 2"를 고른다 */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    editor.chain().focus().setTextSelection({ from: 3, to: 10 }).run();
    const bar = await within(document.body).findByRole("toolbar", { name: "텍스트 서식" });
    await userEvent.keyboard("{Alt>}{F10}{/Alt}");
    const type = within(bar).getByRole("button", { name: /블록 변환/ });
    await waitFor(() => expect(type).toHaveFocus());
    await userEvent.keyboard("{ArrowRight}");
    await expect(within(bar).getByRole("button", { name: "굵게" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{Enter}");
    const item = await within(document.body).findByRole("menuitemcheckbox", { name: "제목 2" });
    await userEvent.click(item);
    await waitFor(() => expect(canvasElement.querySelector(".ProseMirror h2")).not.toBeNull());
  },
};

/** 링크 — 링크 버튼(⌘⇧K)으로 주소를 넣는다 */
export const Link: Story = {
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    editor.chain().focus().setTextSelection({ from: 25, to: 32 }).run();
    const bar = await within(document.body).findByRole("toolbar", { name: "텍스트 서식" });
    await userEvent.click(within(bar).getByRole("button", { name: "링크" }));
    const input = await within(document.body).findByLabelText("링크 주소");
    await userEvent.type(input, "example.com{Enter}");
    await waitFor(() =>
      expect(
        canvasElement.querySelector('.ProseMirror a[href="https://example.com"]'),
      ).not.toBeNull(),
    );
  },
};
