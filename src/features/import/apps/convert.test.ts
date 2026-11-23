// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { htmlToDoc, markdownToDoc } from "@/components/editor/markdown-import";
import { convertObsidianVault } from "./obsidian";
import { convertNotion } from "./notion";

/** 노드 종류를 펼쳐 모은다 */
function types(node: JSONContent, out: JSONContent[] = []): JSONContent[] {
  out.push(node);
  for (const c of node.content ?? []) types(c, out);
  return out;
}

describe("가져온 Markdown·HTML이 편집기 스키마에서 살아남는다 (DATA-11)", () => {
  it("Obsidian 콜아웃과 노트 링크가 callout·pageMention 노드가 된다", async () => {
    const { nodes } = convertObsidianVault([
      { path: "목표.md", text: "" },
      { path: "c.md", text: "[[목표|목표 보기]] 본문\n\n> [!warning] 조심\n> 물을 마세요\n\n끝" },
    ]);
    const note = nodes.find((n) => n.key === "p:c")!;
    const doc = await markdownToDoc(note.markdown);
    const all = types(doc);
    const mention = all.find((n) => n.type === "pageMention");
    expect(mention?.attrs).toEqual({ id: "p:목표", label: "목표 보기" });
    const callout = all.find((n) => n.type === "callout");
    expect(callout?.attrs).toMatchObject({ emoji: "⚠️", color: "orange" });
    expect(JSON.stringify(callout)).toContain("물을 마세요");
  });

  it("Notion aside 콜아웃과 상대 링크 멘션이 살아남는다", async () => {
    const { nodes } = convertNotion([
      {
        path: "목차.md",
        text: "# 목차\n[본문](%EB%B3%B8%EB%AC%B8.md)\n\n<aside>\n💡 알아 둘 점\n</aside>",
      },
      { path: "본문.md", text: "# 본문" },
    ]);
    const note = nodes.find((n) => n.title === "목차")!;
    const doc = await markdownToDoc(note.markdown);
    const all = types(doc);
    expect(all.some((n) => n.type === "pageMention" && n.attrs?.id === "p:본문")).toBe(true);
    expect(all.some((n) => n.type === "callout" && n.attrs?.emoji === "💡")).toBe(true);
  });

  it("AppFlowy·AFFiNE HTML 문서는 스크립트를 버리고 제목을 읽는다", async () => {
    const html =
      "<html><head><title>제목</title></head><body><script>x()</script><p onclick='y'>본문</p></body></html>";
    const { title, doc } = await htmlToDoc(html);
    expect(title).toBe("제목");
    const text = JSON.stringify(doc);
    expect(text).toContain("본문");
    expect(text).not.toContain("x()");
  });
});
