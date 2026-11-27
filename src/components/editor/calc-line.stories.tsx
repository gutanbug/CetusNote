import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";

const CONTENT = [
  "<h2>이번 달 생활비</h2>",
  "<p>월세 = 650,000원</p>",
  "<p>관리비 = 120,000원</p>",
  "<p>월세 + 관리비 =</p>",
  "<p>1년이면 (월세 + 관리비) × 12 =</p>",
  "<p></p>",
  "<ul><li><p>점심 12,000원</p></li><li><p>커피 4,500원</p></li><li><p>저녁 15,000원</p></li><li><p>합계 =</p></li></ul>",
  "<p>할인가 50,000원 - 20% =</p>",
  "<p>회의 2시간 30분 × 4 =</p>",
  "<p>오늘 + 3주 =</p>",
  "<p>12월 25일까지 =</p>",
].join("");

/**
 * 계산 줄 (EDIT-38) — 줄이 `=`로 끝나면 결과를 흐린 글씨로 보여 준다. 캐럿이 줄 끝에 있으면 「Tab」 안내가 붙고,
 * Tab을 누르면 결과를 본문에 넣는다. `이름 = 식`으로 정한 이름은 아래 줄에서 쓴다.
 */
const meta = {
  title: "L4 에디터/ED-CalcLine",
  component: EditorSpecimen,
  args: { content: CONTENT },
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    getEditor(canvasElement);
    await waitFor(() =>
      expect(
        [...canvasElement.querySelectorAll(".sn-calc-result")]
          .slice(0, 4)
          .map((e) => e.childNodes[1]?.textContent),
      ).toEqual(["770,000원", "9,240,000원", "31,500원", "40,000원"]),
    );
  },
};

/** 줄 끝에서 Tab — 결과를 본문에 넣는다(넣은 뒤에는 결과 표시가 사라진다) */
export const AcceptWithTab: Story = {
  args: { content: "<p>점심 12,000 + 커피 4,500 =</p>" },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    editor.commands.focus("end");
    await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
    await waitFor(() =>
      expect(canvasElement.querySelector('.sn-calc-result[data-active="true"]')).toHaveTextContent(
        "16,500",
      ),
    );
    await userEvent.keyboard("{Tab}");
    await expect(canvasElement.querySelector(".ProseMirror p")).toHaveTextContent(
      "점심 12,000 + 커피 4,500 = 16,500",
    );
    await expect(canvasElement.querySelector(".sn-calc-result")).toBeNull();
  },
};

/** 설정에서 끄면 — 결과를 숨기고 Tab은 평소대로(들여쓰기) */
export const Off: Story = {
  args: { content: "<p>1 + 2 =</p>", calc: false },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await expect(canvasElement.querySelector(".sn-calc-result")).not.toBeVisible();
    editor.commands.focus("end");
    await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
    await userEvent.keyboard("{Tab}");
    await expect(editor.state.doc.textContent).toBe("1 + 2 =\t");
  },
};

/** 읽기 전용 — 결과는 보이고 넣기는 없다 */
export const ReadOnly: Story = {
  args: { content: "<p>2시간 30분 × 4 =</p>", editable: false },
};
