import { describe, expect, it } from "vitest";
import { docToMarkdown } from "@/features/export/markdown";
import { AUTO_LANGUAGE, detectLanguage, normalizeLanguage } from "./code-language";

describe("코드 언어 자동 감지 (ED-CodeBlock)", () => {
  it("언어가 비어 있으면 자동 감지, 줄임말은 목록 이름으로", () => {
    expect(normalizeLanguage(null)).toBe(AUTO_LANGUAGE);
    expect(normalizeLanguage("ts")).toBe("typescript");
    expect(normalizeLanguage("brainfuck")).toBe("plaintext");
  });

  it("쓴 글을 보고 언어를 추측한다", () => {
    expect(
      detectLanguage(
        'fn main() {\n    let mut v: Vec<i32> = Vec::new();\n    println!("{}", v.len());\n}',
      ),
    ).toBe("rust");
    expect(detectLanguage("def hello(name):\n    print(f'hi {name}')\n\nimport os")).toBe("python");
    expect(detectLanguage('{\n  "id": "01J",\n  "title": "회의록",\n  "tags": ["a"]\n}')).toBe(
      "json",
    );
  });

  it("짧거나 애매한 글은 모른다고 한다", () => {
    expect(detectLanguage("")).toBeUndefined();
    expect(detectLanguage("회의 메모")).toBeUndefined();
  });

  it("Markdown으로 내보낼 때 자동 감지 블록에 추측한 언어를 적는다", () => {
    const md = docToMarkdown({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: null },
          content: [
            { type: "text", text: "def hello(name):\n    print(f'hi {name}')\n\nimport os" },
          ],
        },
      ],
    });
    expect(md.startsWith("```python\n")).toBe(true);
  });
});
