import { describe, expect, it } from "vitest";
import { collectHeadings, plainText, slugOf, tocDepths, type TocNode } from "./toc";

const h = (level: number, text: string): TocNode => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const doc = (...content: TocNode[]): TocNode => ({ type: "doc", content });

describe("tocDepths", () => {
  it("같은 수준은 형제, 깊어지면 한 단계 아래", () => {
    expect(tocDepths([1, 2, 2, 3, 1, 2])).toEqual([0, 1, 1, 2, 0, 1]);
  });

  it("건너뛴 수준(H1 → H3)도 바로 아래 단계로 붙인다", () => {
    expect(tocDepths([1, 3, 3, 2])).toEqual([0, 1, 1, 1]);
  });

  it("빈 목록은 빈 목록", () => {
    expect(tocDepths([])).toEqual([]);
  });
});

describe("slugOf", () => {
  it("소문자로 바꾸고 기호를 빼고 공백을 하이픈으로", () => {
    expect(slugOf("Hello, World!", new Map())).toBe("hello-world");
    expect(slugOf("Node.js 설치 가이드", new Map())).toBe("nodejs-설치-가이드");
  });

  it("같은 앵커가 여럿이면 -1, -2를 붙인다", () => {
    const used = new Map<string, number>();
    expect([slugOf("개요", used), slugOf("개요", used), slugOf("개요", used)]).toEqual([
      "개요",
      "개요-1",
      "개요-2",
    ]);
  });

  it("기호만 남으면 heading", () => {
    expect(slugOf("?!", new Map())).toBe("heading");
  });
});

describe("collectHeadings", () => {
  it("H1–H3만 문서 순서대로, 계층과 앵커를 붙인다", () => {
    const entries = collectHeadings(
      doc(
        h(1, "시작"),
        h(2, "배경"),
        h(3, "세부"),
        { type: "paragraph", content: [{ type: "text", text: "본문" }] },
        h(2, "결론"),
        h(4, "너무 깊은 제목"),
      ),
    );
    expect(entries.map((e) => [e.level, e.depth, e.text, e.slug])).toEqual([
      [1, 0, "시작", "시작"],
      [2, 1, "배경", "배경"],
      [3, 2, "세부", "세부"],
      [2, 1, "결론", "결론"],
    ]);
  });

  it("빈 제목은 뺀다", () => {
    expect(collectHeadings(doc(h(1, "  "), h(2, "있음"))).map((e) => e.text)).toEqual(["있음"]);
  });

  it("토글·콜아웃 안의 제목도 넣고, 글자 블록 안은 들어가지 않는다", () => {
    const nested: TocNode = {
      type: "callout",
      content: [{ type: "detailsContent", content: [h(2, "접힌 제목")] }],
    };
    expect(collectHeadings(doc(nested)).map((e) => e.text)).toEqual(["접힌 제목"]);
  });

  it("같은 제목이 여럿이면 앵커가 겹치지 않는다", () => {
    expect(collectHeadings(doc(h(2, "메모"), h(2, "메모"))).map((e) => e.slug)).toEqual([
      "메모",
      "메모-1",
    ]);
  });

  it("문서가 없거나 제목이 없으면 빈 목록", () => {
    expect(collectHeadings(undefined)).toEqual([]);
    expect(collectHeadings(doc({ type: "paragraph" }))).toEqual([]);
  });
});

describe("plainText", () => {
  it("마크가 붙은 글자도 한 줄로 잇는다", () => {
    expect(
      plainText({
        type: "heading",
        content: [
          { type: "text", text: "굵은 ", marks: [{ type: "bold" }] },
          { type: "text", text: "제목" },
        ],
      }),
    ).toBe("굵은 제목");
  });
});
