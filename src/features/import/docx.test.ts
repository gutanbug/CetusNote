// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { htmlToDoc } from "@/components/editor/markdown-import";
import { docxToHtml } from "./docx";

// 앱은 Vite가 mammoth의 browser 진입점(arrayBuffer 입력)을 고른다. 테스트(Node)는 Node 진입점(buffer 입력)을 고르므로,
// 앱과 같은 브라우저 번들로 바꿔 끼운다
vi.mock("mammoth", async () => {
  // @ts-expect-error 브라우저 번들에는 타입 선언이 없다
  const browser = await import("mammoth/mammoth.browser.js");
  return { default: browser.default };
});

const fixture = () => new Uint8Array(readFileSync(resolve(__dirname, "fixtures/sample.docx")));

describe(".docx 가져오기 (DATA-08)", () => {
  it("제목 스타일은 h1, 글은 문단으로 HTML이 된다", async () => {
    const html = await docxToHtml(fixture());
    expect(html).toContain("<h1>워드 제목</h1>");
    expect(html).toContain("<strong>굵은 글</strong>");
    expect(html).toContain("둘째 문단");
  });

  it("HTML 경로를 거치면 첫 h1이 제목이 되고 굵은 글 표시가 남는다", async () => {
    const r = await htmlToDoc(await docxToHtml(fixture()));
    expect(r.title).toBe("워드 제목");
    expect(JSON.stringify(r.doc)).toContain('"type":"bold"');
    expect(JSON.stringify(r.doc)).toContain("둘째 문단");
  });
});
