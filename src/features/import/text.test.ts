import { describe, expect, it } from "vitest";
import { dataUrlBytes, escapeHtml, pdfPagesToHtml, plainTextToHtml } from "./text";

describe("일반 텍스트 → 문단 (DATA-08)", () => {
  it("빈 줄로 문단을 나누고 문단 안 줄바꿈은 살린다", () => {
    expect(plainTextToHtml("첫 줄\n둘째 줄\n\n\n셋째 문단")).toBe(
      "<p>첫 줄<br>둘째 줄</p><p>셋째 문단</p>",
    );
  });
  it("CRLF·BOM을 무시하고 빈 입력은 빈 문자열", () => {
    expect(plainTextToHtml("﻿A\r\nB\r\n")).toBe("<p>A<br>B</p>");
    expect(plainTextToHtml("  \n\n ")).toBe("");
  });
  it("마크다운 기호와 HTML 조각은 글자 그대로 둔다", () => {
    expect(plainTextToHtml("# 제목 <b>x</b> & y")).toBe(
      "<p># 제목 &lt;b&gt;x&lt;/b&gt; &amp; y</p>",
    );
    expect(escapeHtml('"q"')).toBe("&quot;q&quot;");
  });
});

describe("PDF 쪽 글 → 문단 (DATA-08)", () => {
  it("쪽 사이와 빈 줄은 문단, 문단 안 줄바꿈은 공백, 줄 끝 하이픈은 잇는다", () => {
    expect(pdfPagesToHtml(["exam-\nple word\nnext line", "둘째 쪽\n\n"])).toBe(
      "<p>example word next line</p><p>둘째 쪽</p>",
    );
  });
  it("글자가 없는 쪽만 있으면 빈 문자열", () => {
    expect(pdfPagesToHtml(["", " \n "])).toBe("");
  });
});

describe("data URL 바이트 (DATA-08)", () => {
  it("base64 본문을 바이트로 바꾼다", () => {
    expect([...dataUrlBytes("data:image/png;base64,AQID")]).toEqual([1, 2, 3]);
  });
  it("data URL이 아니면 빈 배열", () => {
    expect(dataUrlBytes("img/a.png").length).toBe(0);
  });
});
