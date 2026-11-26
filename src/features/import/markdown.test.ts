import { describe, expect, it } from "vitest";
import { parseMarkdownFile } from "./markdown";

describe("문서 가져오기 — 머리 읽기 (DATA-08)", () => {
  it("이 앱이 내보낸 모양을 되돌린다", () => {
    const text = [
      "---",
      'title: "회의 *정리*"',
      'tags: ["업무", "회의"]',
      'status: "진행 중"',
      "created: 2026-11-20T00:00:00.000Z",
      "---",
      "",
      "# 🐳 회의 \\*정리\\*",
      "",
      "본문 첫 줄",
      "",
    ].join("\n");
    expect(parseMarkdownFile("파일", text)).toEqual({
      id: null,
      title: "회의 *정리*",
      icon: "🐳",
      tags: ["업무", "회의"],
      body: "본문 첫 줄\n",
    });
  });

  it("지금 내보내기 모양(front matter 없음, `# 아이콘 제목` 한 번)을 되돌린다 (DATA-04/10)", () => {
    const r = parseMarkdownFile("파일", "# 🐳 회의 \\*정리\\*\n\n본문 첫 줄\n");
    expect(r).toEqual({
      title: "회의 *정리*",
      icon: "🐳",
      tags: [],
      id: null,
      body: "본문 첫 줄\n",
    });
  });

  it("front matter 없이 맨 앞 H1이 제목", () => {
    const r = parseMarkdownFile("notes", "# Rust 소유권\n\n## 빌림\n내용");
    expect(r.title).toBe("Rust 소유권");
    expect(r.icon).toBeNull();
    expect(r.body).toBe("## 빌림\n내용");
  });

  it("H1이 없으면 파일 이름, 본문은 그대로", () => {
    const r = parseMarkdownFile("주간 리뷰", "- 할 일\n- 한 일");
    expect(r.title).toBe("주간 리뷰");
    expect(r.body).toBe("- 할 일\n- 한 일");
  });

  it("front matter 제목과 다른 H1은 본문에 남긴다", () => {
    const r = parseMarkdownFile("x", "---\ntitle: 일지\n---\n# 오늘\n글");
    expect(r.title).toBe("일지");
    expect(r.body).toBe("# 오늘\n글");
  });

  it("H1이 맨 앞이 아니면 제목으로 쓰지 않는다", () => {
    const r = parseMarkdownFile("메모", "머리말\n\n# 제목");
    expect(r.title).toBe("메모");
    expect(r.body).toBe("머리말\n\n# 제목");
  });

  it("BOM · CRLF · 따옴표 없는 태그 목록", () => {
    const r = parseMarkdownFile("x", "\uFEFF---\r\ntags: [a, b, a]\r\n---\r\n# 제목\r\n글");
    expect(r.tags).toEqual(["a", "b"]);
    expect(r.title).toBe("제목");
    expect(r.body).toBe("글");
  });

  it("흐름 목록의 따옴표 안 쉼표는 나누지 않는다", () => {
    const r = parseMarkdownFile("x", '---\ntags: [a, "b, c", \'d\', ""]\n---\n글');
    expect(r.tags).toEqual(["a", "b, c", "d"]);
  });

  it("`- 항목` 블록 목록을 읽는다", () => {
    const r = parseMarkdownFile(
      "x",
      '---\ntags:\n  - 업무\n  - "회의, 주간"\nstatus: 진행\n---\n글',
    );
    expect(r.tags).toEqual(["업무", "회의, 주간"]);
    expect(r.body).toBe("글");
  });

  it("대괄호 없는 한 값은 태그 하나 (쉼표로 나누지 않는다)", () => {
    const r = parseMarkdownFile("x", "---\ntags: a, b\n---\n글");
    expect(r.tags).toEqual(["a, b"]);
  });

  it("닫히지 않은 front matter는 본문으로", () => {
    const r = parseMarkdownFile("x", "---\n글");
    expect(r.title).toBe("x");
    expect(r.body).toBe("---\n글");
  });
});
