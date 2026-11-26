// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { looksLikeMarkdown, markdownToDom } from "./markdown-paste";

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

describe("왕복: 콜아웃 인용과 페이지 링크 (DATA-08 · DATA-10)", () => {
  it("> [!종류] 이모지 인용은 콜아웃 블록이 되고 색·이모지를 옮긴다", () => {
    const body = markdownToDom("> [!CAUTION] ⚠️ 조심\n> 둘째 줄\n\n> [!CETUS-brown] 🌿 갈색");
    const boxes = [...body.querySelectorAll('div[data-type="callout"]')];
    expect(boxes.map((b) => [b.getAttribute("data-color"), b.getAttribute("data-emoji")])).toEqual([
      ["red", "⚠️"],
      ["brown", "🌿"],
    ]);
    expect(boxes[0]!.textContent).toContain("조심");
    expect(boxes[0]!.querySelector("p")!.textContent).toBe("조심둘째 줄");
  });

  it("일반 인용(종류 표지 없음)은 그대로 인용으로 남는다", () => {
    const body = markdownToDom("> 그냥 인용");
    expect(body.querySelector("blockquote")).not.toBeNull();
    expect(body.querySelector('div[data-type="callout"]')).toBeNull();
  });

  it("cetusnote://page/<id> 링크는 워크스페이스에 있을 때만 페이지 멘션이 된다", () => {
    const text = "[옛 제목](cetusnote://page/P1) 과 [없는](cetusnote://page/P9)";
    const body = markdownToDom(text, undefined, {
      pageLabel: (id) => (id === "P1" ? "새 제목" : undefined),
    });
    const mention = body.querySelector("span[data-page-mention]");
    expect(mention?.getAttribute("data-page-mention")).toBe("P1");
    expect(mention?.textContent).toBe("새 제목");
    expect(body.querySelector('a[href="cetusnote://page/P9"]')).not.toBeNull();
  });
});
