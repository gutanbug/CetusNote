import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { normalizeDocCodeLanguages } from "@/lib/code-language";
import { createExtensions } from "./extensions";

/*
 * 열 때 저장된 언어 이름 고치기 (ED-CodeBlock, SYS-11).
 * 블록마다 트랜잭션을 보내면 큰 문서에서 하이라이트 전체 재계산이 블록 수만큼 돌아 수십 초 멈췄다.
 * 한 트랜잭션으로 모으고, 실행 취소 기록에는 남기지 않는다.
 */
describe("코드 블록 언어 이름 정리", () => {
  it("여러 블록의 줄임말을 한 트랜잭션으로 고치고 실행 취소에 남기지 않는다", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const blocks = Array.from({ length: 40 }, (_, i) => ({
      type: "codeBlock",
      attrs: { language: i % 2 ? "ts" : "py" },
      content: [{ type: "text", text: `v${i} = ${i}` }],
    }));
    const editor = new Editor({
      element,
      extensions: createExtensions({}),
      content: { type: "doc", content: blocks },
    });
    let changes = 0;
    editor.on("transaction", ({ transaction }) => {
      if (transaction.docChanged) changes += 1;
    });
    await new Promise((r) => setTimeout(r, 0));
    const languages = new Set<string>();
    editor.state.doc.forEach((n) => {
      if (n.type.name === "codeBlock") languages.add(n.attrs.language as string);
    });
    expect([...languages].sort()).toEqual(["python", "typescript"]);
    expect(changes).toBe(1);
    expect(editor.can().undo()).toBe(false);
    editor.destroy();
    element.remove();
  });

  it("줄임말 언어로 저장된 문서를 열 때 이름 고치기 트랜잭션이 생기지 않는다", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const doc = normalizeDocCodeLanguages({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [{ type: "text", text: "const a = 1" }],
        },
        {
          type: "codeBlock",
          attrs: { language: "yml" },
          content: [{ type: "text", text: "a: 1" }],
        },
      ],
    });
    const editor = new Editor({ element, extensions: createExtensions({}), content: doc });
    let changes = 0;
    editor.on("transaction", ({ transaction }) => {
      if (transaction.docChanged) changes += 1;
    });
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        const languages: unknown[] = [];
        editor.state.doc.forEach((n) => languages.push(n.attrs.language));
        expect(languages).toEqual(["typescript", "yaml"]);
        expect(changes).toBe(0);
        editor.destroy();
        element.remove();
        resolve();
      }, 0),
    );
  });

  it("HTML로 읽을 때도 줄임말을 목록 이름으로 바꾼다", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const editor = new Editor({
      element,
      extensions: createExtensions({}),
      content: '<pre><code class="language-py">print(1)</code></pre>',
    });
    expect(editor.state.doc.firstChild?.attrs.language).toBe("python");
    editor.destroy();
    element.remove();
  });
});
