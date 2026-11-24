import { createPage } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { docToMarkdown, markdownFileName, pageToMarkdown, type MdNode } from "./markdown";

const t = (
  text: string,
  ...marks: (string | { type: string; attrs?: Record<string, unknown> })[]
) => ({
  type: "text",
  text,
  ...(marks.length ? { marks: marks.map((m) => (typeof m === "string" ? { type: m } : m)) } : {}),
});
const p = (...content: MdNode[]) => ({ type: "paragraph", content });
const doc = (...content: MdNode[]) => docToMarkdown({ type: "doc", content });
const li = (...content: MdNode[]) => ({ type: "listItem", content });

describe("인라인 서식", () => {
  it("굵게·기울임·취소선·코드·링크", () => {
    expect(
      doc(
        p(
          t("굵게", "bold"),
          t(" · "),
          t("기울임", "italic"),
          t(" · "),
          t("취소", "strike"),
          t(" · "),
          t("a`b", "code"),
          t(" · "),
          t("문서", { type: "link", attrs: { href: "https://example.com/a b" } }),
        ),
      ),
    ).toBe("**굵게** · *기울임* · ~~취소~~ · ``a`b`` · [문서](<https://example.com/a b>)");
  });

  it("이어진 마크는 하나로 묶고, 경계 공백은 기호 바깥으로 뺀다", () => {
    expect(doc(p(t("앞 "), t("굵게 ", "bold"), t("굵은 기울임", "bold", "italic"), t(" 뒤")))).toBe(
      "앞 **굵게 *굵은 기울임*** 뒤",
    );
    expect(doc(p(t("a"), t(" b ", "bold"), t("c")))).toBe("a **b** c");
  });

  it("GitHub 호환 HTML: 밑줄·하이라이트·첨자. 글자색은 버린다", () => {
    expect(
      doc(
        p(
          t("밑줄", "underline"),
          t(" "),
          t("강조", { type: "highlight", attrs: { color: "yellow" } }),
          t(" H"),
          t("2", "subscript"),
          t("O x"),
          t("2", "superscript"),
          t(" "),
          t("빨강", { type: "textStyle", attrs: { color: "red" } }),
        ),
      ),
    ).toBe("<u>밑줄</u> <mark>강조</mark> H<sub>2</sub>O x<sup>2</sup> 빨강");
  });

  it("Markdown 기호와 줄 맨 앞 블록 기호를 이스케이프한다", () => {
    expect(
      doc(p(t("# 제목 아님")), p(t("- 목록 아님")), p(t("1. 번호 아님")), p(t("a*b_c [d] <e>"))),
    ).toBe("\\# 제목 아님\n\n\\- 목록 아님\n\n1\\. 번호 아님\n\na\\*b\\_c \\[d\\] \\<e>");
  });

  it("줄바꿈·수식·이모지", () => {
    expect(
      doc(
        p(
          t("첫 줄"),
          { type: "hardBreak" },
          t("둘째 줄 "),
          { type: "inlineMath", attrs: { latex: "x^2" } },
          t(" "),
          { type: "emoji", attrs: { name: "smile" } },
        ),
      ),
    ).toBe("첫 줄\\\n둘째 줄 $x^2$ 😄");
  });
});

describe("블록", () => {
  it("제목·인용·구분선·코드 블록", () => {
    expect(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [t("안건")] },
        { type: "blockquote", content: [p(t("첫 문단")), p(t("둘째 문단"))] },
        { type: "horizontalRule" },
        { type: "codeBlock", attrs: { language: "ts" }, content: [t("const a = `x`;\n```")] },
        { type: "codeBlock", attrs: { language: "plaintext" }, content: [t("plain\n")] },
      ),
    ).toBe(
      "## 안건\n\n> 첫 문단\n>\n> 둘째 문단\n\n---\n\n````ts\nconst a = `x`;\n```\n````\n\n```\nplain\n```",
    );
  });

  it("중첩 목록·번호 목록·할 일", () => {
    expect(
      doc(
        {
          type: "bulletList",
          content: [
            li(p(t("하나")), { type: "bulletList", content: [li(p(t("하나-하나")))] }),
            li(p(t("둘"))),
          ],
        },
        { type: "orderedList", attrs: { start: 3 }, content: [li(p(t("셋"))), li(p(t("넷")))] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [p(t("끝남"))] },
            { type: "taskItem", attrs: { checked: false }, content: [p(t("남음"))] },
          ],
        },
      ),
    ).toBe("- 하나\n  - 하나-하나\n- 둘\n\n3. 셋\n4. 넷\n\n- [x] 끝남\n- [ ] 남음");
  });

  it("콜아웃 → 이모지 인용, 토글 → <details>", () => {
    expect(
      doc(
        {
          type: "callout",
          attrs: { emoji: "⚠️", color: "red" },
          content: [p(t("주의")), p(t("둘째 줄"))],
        },
        {
          type: "details",
          attrs: { open: true },
          content: [
            { type: "detailsSummary", content: [t("지난 회의 요약")] },
            {
              type: "detailsContent",
              content: [{ type: "bulletList", content: [li(p(t("일정 확정")))] }],
            },
          ],
        },
      ),
    ).toBe(
      "> ⚠️ 주의\n>\n> 둘째 줄\n\n<details open>\n<summary>지난 회의 요약</summary>\n\n- 일정 확정\n\n</details>",
    );
  });

  it("표 → GFM 표 (셀 줄바꿈 <br>, | 이스케이프, 칸 수 맞춤)", () => {
    const cell = (type: string, ...ps: MdNode[]) => ({ type, content: ps });
    expect(
      doc({
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [cell("tableHeader", p(t("항목"))), cell("tableHeader", p(t("담당")))],
          },
          {
            type: "tableRow",
            content: [
              cell("tableCell", p(t("a|b")), p(t("둘째 줄"))),
              cell("tableCell", p(t("민수", "bold"))),
            ],
          },
          { type: "tableRow", content: [cell("tableCell", p(t("혼자")))] },
        ],
      }),
    ).toBe("| 항목 | 담당 |\n| --- | --- |\n| a\\|b<br>둘째 줄 | **민수** |\n| 혼자 |  |");
  });

  it("이미지 → ![캡션](워크스페이스 경로)", () => {
    expect(
      doc({
        type: "image",
        attrs: { src: "assets/01JD0000000000000000000000/img-1.png", width: 50 },
        content: [t("회의실 [화이트보드]")],
      }),
    ).toBe("![회의실 \\[화이트보드\\]](assets/01JD0000000000000000000000/img-1.png)");
  });

  it("내려받는 중인 웹 이미지 → 원래 웹 주소 (data: 주소는 비운다)", () => {
    expect(doc({ type: "image", attrs: { src: null, remote: "https://example.com/a.png" } })).toBe(
      "![](https://example.com/a.png)",
    );
    expect(doc({ type: "image", attrs: { src: null, remote: "data:image/png;base64,AA" } })).toBe(
      "![]()",
    );
  });

  it("블록 수식·빈 문단·모르는 블록", () => {
    expect(
      doc(
        { type: "blockMath", attrs: { latex: "E=mc^2" } },
        { type: "paragraph" },
        { type: "futureBlock", content: [p(t("안쪽 글"))] },
      ),
    ).toBe("$$\nE=mc^2\n$$\n\n안쪽 글");
  });
});

describe("페이지 멘션 (EDIT-13)", () => {
  const m = (id: string, label: string) => ({ type: "pageMention", attrs: { id, label } });
  it("링크로 적는다 — 지금 제목을 주면 그 제목, 없으면 넣을 때의 제목", () => {
    const page = {
      ...createPage({ title: "메모" }),
      content: {
        type: "doc" as const,
        content: [p(t("관련: "), m("a", "옛 제목"), m("b", "로그_1"))],
      },
    };
    const md = pageToMarkdown(page, (id) => (id === "a" ? "새 제목" : undefined));
    expect(md).toContain("관련: [새 제목](cetusnote://page/a)[로그\\_1](cetusnote://page/b)");
    expect(pageToMarkdown(page)).toContain("[옛 제목](cetusnote://page/a)");
  });
});

describe("페이지", () => {
  it("front matter 없이 `# 아이콘 제목` 한 번 + 본문", () => {
    const page = {
      ...createPage({ title: "회의록", icon: "📝" }),
      props: {
        tags: ["회의", "기획"],
        status: "진행 중" as const,
        assignee: null,
        due: null,
        values: {},
      },
      content: { type: "doc" as const, content: [p(t("안건 1"))] },
      createdAt: "2026-11-19T09:00:00.000Z",
      updatedAt: "2026-11-19T09:12:00.000Z",
    };
    expect(pageToMarkdown(page)).toBe("# 📝 회의록\n\n안건 1\n");
  });

  it("본문 맨 앞 H1이 제목과 같으면 한 번만 쓴다 (아이콘은 머리에)", () => {
    const h1 = (text: string) => ({
      type: "heading",
      attrs: { level: 1 },
      content: [t(text)],
    });
    const page = {
      ...createPage({ title: "회의록", icon: "📝" }),
      content: { type: "doc" as const, content: [h1("회의록"), p(t("안건 1"))] },
    };
    expect(pageToMarkdown(page)).toBe("# 📝 회의록\n\n안건 1\n");
    // 제목과 다른 H1은 그대로 남긴다
    const other = {
      ...createPage({ title: "회의록" }),
      content: { type: "doc" as const, content: [h1("다른 제목"), p(t("본문"))] },
    };
    expect(pageToMarkdown(other)).toBe("# 회의록\n\n# 다른 제목\n\n본문\n");
  });

  it("빈 제목은 “제목 없음”, 속성은 적지 않는다", () => {
    const md = pageToMarkdown(createPage());
    expect(md).toBe("# 제목 없음\n");
  });

  it("파일 이름에 못 쓰는 글자를 뺀다", () => {
    expect(markdownFileName({ title: "a/b: c?" })).toBe("a b c.md");
    expect(markdownFileName({ title: "  " })).toBe("제목 없음.md");
    expect(markdownFileName({ title: "..숨김" })).toBe("숨김.md");
  });
});

describe("복사용 글자 (EDIT-26)", () => {
  const tx = (text: string): MdNode => ({ type: "text", text });
  const para = (...c: MdNode[]): MdNode => ({ type: "paragraph", content: c });
  it("escape: false면 글자 속 기호를 그대로 둔다(블록 기호는 남긴다)", () => {
    const doc: MdNode = {
      type: "doc",
      content: [
        para(tx("snake_case와 3*4")),
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [para(tx("항목 [1]"))] }],
        },
      ],
    };
    expect(docToMarkdown(doc)).toContain("snake\\_case");
    expect(docToMarkdown(doc, { escape: false })).toBe("snake_case와 3*4\n\n- 항목 [1]");
    // 다음 호출은 다시 이스케이프한다(옵션이 새지 않는다)
    expect(docToMarkdown(doc)).toContain("3\\*4");
  });

  it("titleOf로 멘션을 지금 제목으로", () => {
    const doc: MdNode = {
      type: "doc",
      content: [para({ type: "pageMention", attrs: { id: "01ABC", label: "옛 제목" } })],
    };
    expect(docToMarkdown(doc, { escape: false, titleOf: () => "새 제목" })).toBe(
      "[새 제목](cetusnote://page/01ABC)",
    );
  });
});

describe("목차 블록 (ED-TableOfContents)", () => {
  const toc = { type: "tableOfContents" };
  const h = (level: number, text: string) => ({
    type: "heading",
    attrs: { level },
    content: [t(text)],
  });
  /** 맨 끝 블록(목차 목록)만 본다 */
  const last = (out: string) => out.split("\n\n").pop();

  it("H1–H3를 들여쓴 링크 목록으로 쓴다", () => {
    const out = doc(h(1, "시작"), h(2, "배경"), h(3, "세부"), h(2, "결론"), toc);
    expect(last(out)).toBe(
      ["- [시작](#시작)", "  - [배경](#배경)", "    - [세부](#세부)", "  - [결론](#결론)"].join(
        "\n",
      ),
    );
  });

  it("건너뛴 수준도 한 단계 아래로 들여쓴다", () => {
    expect(last(doc(h(1, "가"), h(3, "나"), toc))).toBe("- [가](#가)\n  - [나](#나)");
  });

  it("같은 제목은 앵커에 -1, -2를 붙인다", () => {
    expect(last(doc(h(2, "메모"), h(2, "메모"), toc))).toBe("- [메모](#메모)\n- [메모](#메모-1)");
  });

  it("제목이 없으면 아무것도 쓰지 않는다", () => {
    expect(doc(p(t("본문")), toc)).toBe("본문");
  });

  it("목차 블록 자신과 빈 제목은 목록에 없다", () => {
    expect(last(doc(h(1, "   "), h(1, "있음"), toc))).toBe("- [있음](#있음)");
  });

  it("복사(글자 그대로)에서도 같은 목록을 쓴다", () => {
    const out = docToMarkdown({ type: "doc", content: [h(1, "가*나"), toc] }, { escape: false });
    expect(out.split("\n\n").pop()).toBe("- [가*나](#가나)");
  });
});
