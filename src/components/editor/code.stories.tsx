import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { getEditor } from "@/debug/editor-test";
import { EditorSpecimen } from "@/debug/editor-specimen";

const CONTENT =
  '<pre><code class="language-typescript">// 페이지 1개 = JSON 파일 1개\ntype Page = {\n  id: string;\n  title: string;\n  updatedAt: number;\n};\n\nexport async function savePage(page: Page): Promise&lt;void&gt; {\n  const json = JSON.stringify(page, null, 2);\n  await writeAtomic(`pages/${page.id}.json`, json);\n}</code></pre><pre><code class="language-rust">#[tauri::command]\nfn read_page(id: String) -&gt; Result&lt;String, String&gt; {\n    let path = workspace_dir().join(format!("pages/{id}.json"));\n    std::fs::read_to_string(path).map_err(|e| e.to_string())\n}</code></pre><pre><code class="language-bash">pnpm app   # 개발 실행</code></pre>';

/** 코드 블록 — ``` 또는 ```ts + 스페이스. 언어 선택 · 하이라이트 · 복사 */
const meta = {
  title: "L4 에디터/ED-CodeBlock",
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

/**
 * 언어 바꾸기 · 복사 — 언어 목록은 처음 펼칠 때 채운다(블록이 많아도 열기가 빠르도록).
 * 복사하면 "복사됨"이 잠깐 보이고 본문 글자가 클립보드로 간다.
 */
export const LanguageAndCopy: Story = {
  args: { content: CONTENT },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const editor = getEditor(canvasElement);
    const [first] = await c.findAllByRole("combobox", { name: "코드 언어" });
    await userEvent.click(first);
    await userEvent.selectOptions(first, "python");
    await waitFor(() => expect(editor.state.doc.child(0).attrs.language).toBe("python"));
    await waitFor(() =>
      expect(canvasElement.querySelector("pre code")).toHaveClass("language-python"),
    );

    const writes: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          writes.push(text);
        },
      },
    });
    await userEvent.click(c.getAllByRole("button", { name: "코드 복사" })[0]);
    await waitFor(() => expect(c.getAllByText("복사됨").length).toBeGreaterThan(0));
    expect(writes[0]).toContain("export async function savePage");
  },
};
