// @vitest-environment happy-dom
import { markdownToDoc } from "@/components/editor/markdown-import";
import { parseMarkdownFile } from "@/features/import/markdown";
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

  it("콜아웃 → 종류 표지 인용, 토글 → <details>", () => {
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
      "> [!CAUTION] ⚠️ 주의\n>\n> 둘째 줄\n\n<details open>\n<summary>지난 회의 요약</summary>\n\n- 일정 확정\n\n</details>",
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

describe("편집 블록 phase 2 (EDIT-28·29·34·36)", () => {
  it("토글 제목 → <details>, 요약은 <h2> 제목 줄, 접힌 내용은 나머지 블록", () => {
    const md = doc({
      type: "toggleHeading",
      attrs: { open: false },
      content: [
        { type: "heading", attrs: { level: 2 }, content: [t("접힌 제목")] },
        p(t("숨은 본문")),
      ],
    });
    expect(md).toBe("<details>\n<summary><h2>접힌 제목</h2></summary>\n\n숨은 본문\n\n</details>");
    expect(
      doc({
        type: "toggleHeading",
        attrs: { open: true },
        content: [{ type: "heading", attrs: { level: 1 }, content: [t("빈")] }],
      }),
    ).toBe("<details open>\n<summary><h1>빈</h1></summary>\n</details>");
  });

  it("열 묶음 → 열 표지 주석으로 감싸고 열 너비를 남긴다 (DATA-04)", () => {
    const col = (width: number, ...content: MdNode[]) => ({
      type: "column",
      attrs: { width },
      content,
    });
    const md = doc({
      type: "columns",
      content: [col(2, p(t("왼쪽"))), col(1, p(t("오른쪽"))), col(1)],
    });
    expect(md).toBe(
      [
        "<!-- cetusnote:columns -->",
        "<!-- cetusnote:column width=2 -->",
        "왼쪽",
        "<!-- /cetusnote:column -->",
        "<!-- cetusnote:column width=1 -->",
        "오른쪽",
        "<!-- /cetusnote:column -->",
        "<!-- cetusnote:column width=1 -->",
        "<!-- /cetusnote:column -->",
        "<!-- /cetusnote:columns -->",
      ].join("\n\n"),
    );
  });

  it("하위 페이지 → 페이지 링크 (지금 제목, 없으면 '하위 페이지')", () => {
    const page = {
      ...createPage({ title: "부모" }),
      content: { type: "doc" as const, content: [{ type: "subpage", attrs: { pageId: "c1" } }] },
    };
    expect(pageToMarkdown(page, (id) => (id === "c1" ? "자식" : undefined))).toContain(
      "[자식](cetusnote://page/c1)",
    );
    expect(pageToMarkdown(page)).toContain("[하위 페이지](cetusnote://page/c1)");
  });

  it("날짜 칩 → @YYYY-MM-DD 글자 (시각·알림은 글로 옮기지 않는다)", () => {
    const md = doc(
      p(t("마감 "), {
        type: "dateChip",
        attrs: { date: "2026-12-01", time: "09:30", reminder: { kind: "morning" } },
      }),
    );
    expect(md).toBe("마감 @2026-12-01");
  });

  it("경로 표시 블록은 글로 남지 않는다 (손실)", () => {
    expect(doc({ type: "breadcrumb" }, p(t("본문")))).toBe("본문");
  });
});

// ── 왕복: 내보낸 Markdown을 다시 가져와 같은 구조가 되는지 (DATA-04 · DATA-08 · DATA-10) ──

type Json = { type?: string; attrs?: Record<string, unknown>; content?: Json[]; text?: string };
/** 문서 트리에서 종류가 type인 노드를 차례로 모은다 */
function nodesOf(node: Json, type: string): Json[] {
  const own = node.type === type ? [node] : [];
  return [...own, ...(node.content ?? []).flatMap((c) => nodesOf(c, type))];
}
const textOf = (node: Json): string => node.text ?? (node.content ?? []).map(textOf).join("");

describe("왕복: 내보내기 → 가져오기", () => {
  it("콜아웃: 이모지·색·글이 그대로 돌아온다 (표준 종류와 CETUS 종류 모두)", async () => {
    const md = doc(
      { type: "callout", attrs: { emoji: "⚠️", color: "red" }, content: [p(t("주의"))] },
      {
        type: "callout",
        attrs: { emoji: "🌿", color: "brown" },
        content: [p(t("첫 줄")), p(t("둘째 줄"))],
      },
    );
    expect(md).toContain("> [!CAUTION] ⚠️ 주의");
    expect(md).toContain("> [!CETUS-brown] 🌿 첫 줄");
    const boxes = nodesOf((await markdownToDoc(md)) as Json, "callout");
    expect(boxes.map((b) => [b.attrs?.emoji, b.attrs?.color, textOf(b)])).toEqual([
      ["⚠️", "red", "주의"],
      ["🌿", "brown", "첫 줄둘째 줄"],
    ]);
  });

  it("Obsidian 콜아웃(이모지 없음)도 가져온다: 종류는 색으로, 이모지는 기본 💡", async () => {
    const [box] = nodesOf((await markdownToDoc("> [!TIP]\n> 물을 자주 마셔요")) as Json, "callout");
    expect(box?.attrs).toMatchObject({ emoji: "💡", color: "green" });
    expect(textOf(box!)).toBe("물을 자주 마셔요");
  });

  it("토글: <details>와 요약·내용이 토글 블록으로 돌아온다", async () => {
    const md = doc({
      type: "details",
      attrs: { open: true },
      content: [
        { type: "detailsSummary", content: [t("지난 회의 요약")] },
        { type: "detailsContent", content: [p(t("숨은 본문"))] },
      ],
    });
    const back = (await markdownToDoc(md)) as Json;
    const [d] = nodesOf(back, "details");
    expect(d?.attrs?.open).toBe(true);
    expect(textOf(nodesOf(d!, "detailsSummary")[0]!)).toBe("지난 회의 요약");
    expect(textOf(nodesOf(d!, "detailsContent")[0]!)).toBe("숨은 본문");
  });

  it("페이지 링크: 워크스페이스에 있는 id는 페이지 멘션으로, 없으면 링크 글로 남는다", async () => {
    const md = doc(p(t("보기 "), { type: "pageMention", attrs: { id: "P1", label: "옛" } }));
    expect(md).toContain("[옛](cetusnote://page/P1)");
    const titles: Record<string, string> = { P1: "새 제목" };
    const found = (await markdownToDoc(md, undefined, (id) => titles[id])) as Json;
    expect(nodesOf(found, "pageMention")[0]?.attrs).toMatchObject({ id: "P1", label: "새 제목" });
    const missing = (await markdownToDoc(md, undefined, () => undefined)) as Json;
    expect(nodesOf(missing, "pageMention")).toHaveLength(0);
  });

  it("front matter: id·tags·아이콘이 파일에서 돌아온다 (페이지 링크를 잇는 근거)", () => {
    const page = {
      ...createPage({ title: "회의록", icon: "📝" }),
      id: "01PAGE",
      props: { tags: ["회의", "기획"], status: null, assignee: null, due: null, values: {} },
      content: { type: "doc" as const, content: [p(t("안건 1"))] },
      createdAt: "2026-11-19T09:00:00.000Z",
      updatedAt: "2026-11-19T09:12:00.000Z",
    };
    const md = pageToMarkdown(page);
    expect(md.startsWith('---\nid: "01PAGE"\ntags: ["회의", "기획"]\n')).toBe(true);
    const head = parseMarkdownFile("회의록.md", md);
    expect(head).toMatchObject({
      title: "회의록",
      id: "01PAGE",
      tags: ["회의", "기획"],
      icon: "📝",
    });
    expect(head.body).toContain("안건 1");
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
    expect(pageToMarkdown(page, undefined, undefined, { frontMatter: false })).toBe(
      "# 📝 회의록\n\n안건 1\n",
    );
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
    expect(pageToMarkdown(page, undefined, undefined, { frontMatter: false })).toBe(
      "# 📝 회의록\n\n안건 1\n",
    );
    // 제목과 다른 H1은 그대로 남긴다
    const other = {
      ...createPage({ title: "회의록" }),
      content: { type: "doc" as const, content: [h1("다른 제목"), p(t("본문"))] },
    };
    expect(pageToMarkdown(other, undefined, undefined, { frontMatter: false })).toBe(
      "# 회의록\n\n# 다른 제목\n\n본문\n",
    );
  });

  it("빈 제목은 “제목 없음”, 속성은 적지 않는다", () => {
    const md = pageToMarkdown(createPage(), undefined, undefined, { frontMatter: false });
    expect(md).toBe("# 제목 없음\n");
  });

  it("파일 이름에 못 쓰는 글자를 뺀다", () => {
    expect(markdownFileName({ title: "a/b: c?" })).toBe("a b c.md");
    expect(markdownFileName({ title: "  " })).toBe("제목 없음.md");
    expect(markdownFileName({ title: "..숨김" })).toBe("숨김.md");
  });

  it("파일 이름(.md 포함) 255바이트 이하: 한글은 3바이트씩 센다", () => {
    const name = markdownFileName({ title: "가".repeat(120) });
    expect(name.endsWith(".md")).toBe(true);
    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(255);
    expect(name).toBe(`${"가".repeat(84)}.md`);
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

describe("경로 표시 · 하위 페이지 Markdown (EDIT-29, EDIT-30)", () => {
  it("경로 블록은 A › B 글로 내보낸다", () => {
    expect(
      docToMarkdown({ type: "doc", content: [{ type: "breadcrumb" }] } as MdNode, {
        path: ["폴더", "상위", "현재"],
      }),
    ).toBe("폴더 › 상위 › 현재");
  });

  it("경로를 모르면(복사 등) 경로 블록은 빠진다", () => {
    expect(
      docToMarkdown({ type: "doc", content: [{ type: "breadcrumb" }, p(t("본문"))] } as MdNode),
    ).toBe("본문");
  });

  it("하위 페이지 블록은 지금 제목의 페이지 링크", () => {
    expect(
      docToMarkdown(
        { type: "doc", content: [{ type: "subpage", attrs: { pageId: "p1" } }] } as MdNode,
        { titleOf: (id) => (id === "p1" ? "하위 제목" : undefined) },
      ),
    ).toBe("[하위 제목](cetusnote://page/p1)");
  });
});

describe("파일 첨부 (EDIT-31~33)", () => {
  it("첨부는 워크스페이스 경로 링크로 내보낸다 (파일은 함께 내보내지 않는다)", () => {
    const path = "assets/01JD0000000000000000000001/01JD0000000000000000000002-notes.pdf";
    const md = doc({ type: "attachment", attrs: { path, name: "회의 메모.pdf", kind: "pdf" } });
    expect(md).toContain(`[회의 메모.pdf](${path})`);
  });
});

describe("단일 페이지 이미지 링크 (DATA-04)", () => {
  it("assetHref가 주면 이미지·첨부 링크를 바꾸고, 원격 주소는 그대로 둔다", () => {
    const page = createPage({ title: "사진" });
    page.content = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "assets/01JD0000000000000000000000/a b.png", alt: "" } },
        {
          type: "attachment",
          attrs: { path: "assets/01JD0000000000000000000000/c.pdf", name: "c.pdf" },
        },
        { type: "image", attrs: { remote: "https://example.com/x.png" } },
      ],
    } as never;
    const md = pageToMarkdown(page, undefined, undefined, {
      frontMatter: false,
      assetHref: (src) =>
        src.endsWith("a b.png") ? "assets/a b.png" : src.replace(/^assets\/[^/]+\//, "assets/"),
    });
    expect(md).toContain("![](<assets/a b.png>)");
    expect(md).toContain("[c.pdf](assets/c.pdf)");
    expect(md).not.toContain("01JD0000");
  });
});

describe("왕복: 열 묶음 (DATA-04)", () => {
  const col = (width: number, ...content: MdNode[]) => ({
    type: "column",
    attrs: { width },
    content,
  });
  const cols = (...columns: MdNode[]) => ({ type: "columns", content: columns });
  const shape = (node: Json) => nodesOf(node, "column").map((c) => [c.attrs?.width, textOf(c)]);

  it.each([2, 3, 4])("%d단: 열 수와 너비, 글 순서가 그대로 돌아온다", async (count) => {
    const columns = Array.from({ length: count }, (_, i) => col(i + 1, p(t(`열${i + 1}`))));
    const md = doc(cols(...columns));
    const back = (await markdownToDoc(md)) as Json;
    expect(nodesOf(back, "columns")).toHaveLength(1);
    expect(shape(back)).toEqual(Array.from({ length: count }, (_, i) => [i + 1, `열${i + 1}`]));
  });

  it("열 안의 제목·목록·중첩 열이 그대로 돌아온다", async () => {
    const md = doc(
      cols(
        col(
          1,
          { type: "heading", attrs: { level: 2 }, content: [t("안건")] },
          {
            type: "bulletList",
            content: [li(p(t("하나"))), li(p(t("둘")))],
          },
        ),
        col(1, p(t("오른쪽")), cols(col(1, p(t("안쪽 왼"))), col(1, p(t("안쪽 오른"))))),
      ),
    );
    const back = (await markdownToDoc(md)) as Json;
    const [outer] = nodesOf(back, "columns");
    const [left, right] = outer!.content ?? [];
    expect(left?.content?.map((n) => n.type)).toEqual(["heading", "bulletList"]);
    expect(textOf(left!.content![0]!)).toBe("안건");
    expect(nodesOf(left!, "listItem").map(textOf)).toEqual(["하나", "둘"]);
    expect(nodesOf(right!, "columns")).toHaveLength(1);
    expect(shape(back)).toEqual([
      [1, "안건하나둘"],
      [1, "오른쪽안쪽 왼안쪽 오른"],
      [1, "안쪽 왼"],
      [1, "안쪽 오른"],
    ]);
  });

  it("빈 열은 빈 문단 하나를 가진 열로 돌아온다", async () => {
    const md = doc(cols(col(1, p(t("가"))), col(1)));
    const back = (await markdownToDoc(md)) as Json;
    const [, empty] = nodesOf(back, "column");
    expect(empty?.content?.map((n) => n.type)).toEqual(["paragraph"]);
    expect(textOf(empty!)).toBe("");
    expect(shape(back)).toEqual([
      [1, "가"],
      [1, ""],
    ]);
  });
});

describe("왕복: 토글 제목·수식·날짜 칩 (DATA-04 · DATA-08)", () => {
  it("토글 제목은 단계(H1–H3)와 열림 상태가 그대로 돌아온다", async () => {
    const md = doc(
      {
        type: "toggleHeading",
        attrs: { open: false },
        content: [
          { type: "heading", attrs: { level: 3 }, content: [t("세 번째")] },
          p(t("본문 셋")),
        ],
      },
      {
        type: "toggleHeading",
        attrs: { open: true },
        content: [
          { type: "heading", attrs: { level: 1 }, content: [t("첫째")] },
          p(t("본문 하나")),
        ],
      },
    );
    const back = (await markdownToDoc(md)) as Json;
    const boxes = nodesOf(back, "toggleHeading");
    expect(
      boxes.map((b) => [
        b.attrs?.open,
        b.content?.[0]?.type,
        b.content?.[0]?.attrs?.level,
        textOf(b.content![0]!),
      ]),
    ).toEqual([
      [false, "heading", 3, "세 번째"],
      [true, "heading", 1, "첫째"],
    ]);
    expect(textOf(boxes[0]!)).toContain("본문 셋");
    expect(nodesOf(back, "details")).toHaveLength(0);
  });

  it("인라인·블록 수식은 LaTeX 역슬래시를 살려 수식 노드로 돌아온다", async () => {
    const md = doc(
      p(t("식 "), { type: "inlineMath", attrs: { latex: "\\{x\\} + y_1" } }, t(" 끝")),
      { type: "blockMath", attrs: { latex: "a \\\\ b\n\\sum_{i} x_i" } },
    );
    const back = (await markdownToDoc(md)) as Json;
    expect(nodesOf(back, "inlineMath")[0]?.attrs).toEqual({ latex: "\\{x\\} + y_1" });
    expect(nodesOf(back, "blockMath")[0]?.attrs).toEqual({ latex: "a \\\\ b\n\\sum_{i} x_i" });
  });

  it("통화 표기 $5 and $10은 수식이 아니다", async () => {
    const back = (await markdownToDoc("가격은 $5 and $10 이에요")) as Json;
    expect(nodesOf(back, "inlineMath")).toHaveLength(0);
    expect(textOf(back)).toContain("$5 and $10");
  });

  it("날짜 칩은 @YYYY-MM-DD로 돌아오고, 없는 날짜는 글자로 남는다", async () => {
    const md = doc(
      p(t("마감 "), { type: "dateChip", attrs: { date: "2026-12-01" } }, t(" 또는 @2026-02-31")),
    );
    const [chip] = nodesOf((await markdownToDoc(md)) as Json, "dateChip");
    expect(chip?.attrs?.date).toBe("2026-12-01");
    const back = (await markdownToDoc("기한 @2026-02-31")) as Json;
    expect(nodesOf(back, "dateChip")).toHaveLength(0);
    expect(textOf(back)).toContain("@2026-02-31");
  });
});
