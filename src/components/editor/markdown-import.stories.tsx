import type { Meta, StoryObj } from "@storybook/react-vite";
import type { JSONContent } from "@tiptap/core";
import * as React from "react";
import { expect, waitFor, within } from "storybook/test";
import { markdownToDoc } from "./markdown-import";
import { NoteEditor } from "./note-editor";

const SAMPLE = [
  "## 이번 주",
  "",
  "- [x] 검색 순위",
  "- [ ] 붙여넣기",
  "",
  "![구조도](img/arch.png)",
  "",
  "![없는 그림](img/missing.png)",
  "",
  "![웹 그림](https://example.com/a.png)",
  "",
  "![](../outside.png)",
  "",
  "```ts",
  "const a = 1;",
  "```",
].join("\n");

/** 견본: img/arch.png만 있는 폴더 */
const resolve = async (src: string) => {
  if (src === "img/arch.png") return "assets/demo/img-arch.png";
  throw new Error("not found");
};

type Props = { text: string; withImages?: boolean };

/** 변환 결과를 에디터로 그리고, 문서 JSON을 data 속성에 둔다(검사용) */
function ImportSpecimen({ text, withImages = true }: Props) {
  const [doc, setDoc] = React.useState<JSONContent | null>(null);
  React.useEffect(() => {
    let live = true;
    void markdownToDoc(text, withImages ? resolve : undefined).then((d) => live && setDoc(d));
    return () => {
      live = false;
    };
  }, [text, withImages]);
  if (!doc) return <p className="text-caption text-tertiary">변환 중…</p>;
  return (
    <div data-doc={JSON.stringify(doc)} className="mx-auto max-w-(--content-w)">
      <NoteEditor content={doc} editable={false} />
    </div>
  );
}

/**
 * Markdown 가져오기 변환(DATA-08) — 붙여넣기(EDIT-23)와 같은 변환 + 상대 경로 이미지.
 * 폴더 안 이미지는 assets 경로로, 못 찾으면 캡션(없으면 경로) 글로, 웹 이미지는 내려받을 자리로 남긴다.
 */
const meta = {
  title: "L4 에디터/ED-MarkdownPaste",
  id: "l4-에디터-ed-markdownpaste-import",
  component: ImportSpecimen,
  args: { text: SAMPLE },
} satisfies Meta<typeof ImportSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

const docOf = async (root: HTMLElement) => {
  const el = await waitFor(() => {
    const found = root.querySelector<HTMLElement>("[data-doc]");
    if (!found) throw new Error("not yet");
    return found;
  });
  return JSON.parse(el.dataset.doc!) as JSONContent;
};
const types = (d: JSONContent) => (d.content ?? []).map((n) => n.type);

export const Import: Story = {
  play: async ({ canvasElement }) => {
    const d = await docOf(canvasElement);
    await expect(types(d)).toEqual([
      "heading",
      "taskList",
      "image",
      "paragraph",
      "image",
      "paragraph",
      "codeBlock",
    ]);
    const [, , local, missing, web, outside, code] = d.content!;
    await expect(local!.attrs).toMatchObject({ src: "assets/demo/img-arch.png", remote: null });
    await expect(missing!.content?.[0]?.text, "못 찾으면 캡션 글").toBe("없는 그림");
    await expect(web!.attrs).toMatchObject({ src: null, remote: "https://example.com/a.png" });
    await expect(outside!.content?.[0]?.text, "캡션이 없으면 경로").toBe("../outside.png");
    await expect(code!.attrs?.language).toBe("typescript");
    await expect(within(canvasElement).getByText("검색 순위")).toBeInTheDocument();
  },
};

/** 폴더를 모르면(브라우저 미리보기) 상대 경로 이미지는 모두 글로 */
export const WithoutFolder: Story = {
  args: { withImages: false },
  play: async ({ canvasElement }) => {
    const d = await docOf(canvasElement);
    await expect(d.content!.filter((n) => n.type === "image")).toHaveLength(1);
    await expect(JSON.stringify(d)).toContain("구조도");
  },
};

/** 위험한 주소는 이미지로 만들지 않는다 */
export const UnsafeSources: Story = {
  args: {
    text: "![a](javascript:alert(1))\n\n![b](file:///etc/passwd.png)\n\n![c](/abs/x.png)\n\n끝",
  },
  play: async ({ canvasElement }) => {
    const d = await docOf(canvasElement);
    await expect(types(d)).toEqual(["paragraph"]);
  },
};
