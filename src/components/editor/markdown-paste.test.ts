import { describe, expect, it } from "vitest";
import { looksLikeMarkdown } from "./markdown-paste";

describe("looksLikeMarkdown", () => {
  it.each([
    "# 제목",
    "### 작은 제목",
    "- 항목",
    "* 항목",
    "1. 첫째",
    "2) 둘째",
    "- [ ] 할 일",
    "> 인용",
    "```js\nx\n```",
    "| a | b |\n| - | - |",
    "---",
    "앞 글\n\n- 목록이 중간에",
    "**굵게** 쓴 글",
    "`코드` 한 줄",
    "[링크](https://example.com)",
    "~~취소~~",
  ])("마크다운: %j", (text) => {
    expect(looksLikeMarkdown(text)).toBe(true);
  });

  it.each([
    "오늘 할 일을 정리했어요",
    "첫 줄\n둘째 줄",
    "https://example.com/page",
    "#태그처럼 붙여 쓴 글",
    "가격은 3*4=12",
    "2026.11.21 회의",
    "-1도까지 내려가요",
  ])("평범한 글: %j", (text) => {
    expect(looksLikeMarkdown(text)).toBe(false);
  });
});
