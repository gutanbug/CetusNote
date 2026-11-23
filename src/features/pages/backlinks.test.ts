import { createPage, type Page } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { findBacklinks } from "./backlinks";

const p = (...content: unknown[]) => ({ type: "paragraph", content });
const t = (text: string, href?: string) => ({
  type: "text",
  text,
  ...(href ? { marks: [{ type: "link", attrs: { href } }] } : {}),
});
const m = (id: string, label: string) => ({ type: "pageMention", attrs: { id, label } });

function page(
  title: string,
  blocks: unknown[],
  updatedAt: string,
  extra: Partial<Page> = {},
): Page {
  return {
    ...createPage({ title }),
    content: { type: "doc", content: blocks } as Page["content"],
    updatedAt,
    ...extra,
  };
}

describe("백링크 (PAGE-09)", () => {
  it("멘션·페이지 링크를 찾고, 문맥에 지금 제목을 쓰고 언급 자리를 표시한다", () => {
    const target = page("주간 회의", [], "2026-11-01");
    const a = page(
      "회고",
      [
        p(t("지난 "), m(target.id, "옛 제목"), t(" 결론을 따른다")),
        p(t("다시 "), m(target.id, "x")),
      ],
      "2026-11-10",
    );
    const b = page(
      "메모",
      [
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [p(t("링크", `cetusnote://page/${target.id}`))] }],
        },
      ],
      "2026-11-12",
    );
    const other = page("다른", [p(t("상관없음"))], "2026-11-13");
    const all = Object.fromEntries([target, a, b, other].map((x) => [x.id, x]));
    const links = findBacklinks(all, target.id);
    expect(links.map((l) => l.page.title)).toEqual(["메모", "회고"]);
    expect(links[1]!.count).toBe(2);
    const s = links[1]!.snippets[0]!;
    expect(s.text).toBe("지난 @주간 회의 결론을 따른다");
    expect(s.text.slice(...s.highlight)).toBe("@주간 회의");
    expect(links[0]!.snippets[0]!.text.slice(...links[0]!.snippets[0]!.highlight)).toBe("링크");
  });

  it("휴지통 페이지·자기 자신은 빼고, 긴 블록은 언급 앞뒤만 남긴다", () => {
    const target = page("대상", [p(m("self", "자기"))], "2026-11-01");
    const long = "가".repeat(200);
    const a = page("긴 글", [p(t(long), m(target.id, "대상"), t(long))], "2026-11-02");
    const trashed = page("버림", [p(m(target.id, "대상"))], "2026-11-03", {
      trashedAt: "2026-11-04",
    });
    const all = Object.fromEntries([target, a, trashed].map((x) => [x.id, x]));
    const [only, ...rest] = findBacklinks(all, target.id);
    expect(rest).toHaveLength(0);
    const s = only!.snippets[0]!;
    expect(s.text.startsWith("…") && s.text.endsWith("…")).toBe(true);
    expect(s.text.length).toBeLessThanOrEqual(122);
    expect(s.text.slice(...s.highlight)).toBe("@대상");
  });
});
