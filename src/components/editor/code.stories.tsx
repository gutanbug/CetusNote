import type { Meta, StoryObj } from "@storybook/react-vite";
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
