import { describe, expect, it } from "vitest";
import { normalizeDocCodeLanguages, storedLanguage } from "@/lib/code-language";
import { normalizeLanguage } from "./code-block";

describe("normalizeLanguage", () => {
  it("줄임말을 목록 이름으로 바꾼다", () => {
    expect(normalizeLanguage("ts")).toBe("typescript");
    expect(normalizeLanguage("PY")).toBe("python");
    expect(normalizeLanguage("yml")).toBe("yaml");
  });
  it("목록에 있는 이름은 그대로 둔다", () => {
    expect(normalizeLanguage("rust")).toBe("rust");
  });
  it("모르는 언어는 일반 텍스트, 빈 값은 자동 감지", () => {
    expect(normalizeLanguage("brainfuck")).toBe("plaintext");
    expect(normalizeLanguage(null)).toBe("auto");
  });
});

describe("저장 시점 언어 정리 (SYS-11)", () => {
  it("storedLanguage: 자동 감지는 null, 줄임말은 목록 이름", () => {
    expect(storedLanguage("ts")).toBe("typescript");
    expect(storedLanguage("auto")).toBeNull();
    expect(storedLanguage("")).toBeNull();
    expect(storedLanguage(undefined)).toBeNull();
  });
  it("normalizeDocCodeLanguages: 코드 블록 언어만 바꾸고 원본은 그대로 둔다", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "codeBlock", attrs: { language: "py" }, content: [{ type: "text", text: "x" }] },
        { type: "paragraph", content: [{ type: "text", text: "yml" }] },
        { type: "codeBlock", attrs: { language: "rust" } },
      ],
    };
    const out = normalizeDocCodeLanguages(doc);
    expect(out.content[0]!.attrs!.language).toBe("python");
    expect(out.content[0]!.content).toEqual([{ type: "text", text: "x" }]);
    expect(out.content[1]).toBe(doc.content[1]);
    expect(out.content[2]).toBe(doc.content[2]);
    expect(doc.content[0]!.attrs!.language).toBe("py");
  });
  it("normalizeDocCodeLanguages: 바뀔 것이 없으면 같은 객체를 돌려준다", () => {
    const doc = { type: "doc", content: [{ type: "codeBlock", attrs: { language: "rust" } }] };
    expect(normalizeDocCodeLanguages(doc)).toBe(doc);
  });
});
