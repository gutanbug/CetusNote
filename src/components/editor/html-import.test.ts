// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { htmlToDoc } from "./markdown-import";

/** 문서 JSON을 펼쳐 노드 종류·글자·표시 표지를 본다 */
function flat(node: {
  type?: string;
  text?: string;
  marks?: { type: string; attrs?: unknown }[];
  attrs?: Record<string, unknown>;
  content?: unknown[];
}): string[] {
  const own = [
    ...(node.type ? [node.type] : []),
    ...(node.text ? [node.text] : []),
    ...(node.marks ?? []).map((m) => `${m.type}${m.attrs ? JSON.stringify(m.attrs) : ""}`),
    ...Object.values(node.attrs ?? {}).filter((v): v is string => typeof v === "string"),
  ];
  return [...own, ...((node.content ?? []) as (typeof node)[]).flatMap(flat)];
}

describe("HTML 가져오기 (DATA-08)", () => {
  it("<title>을 제목으로 쓴다", async () => {
    const r = await htmlToDoc(
      "<html><head><title>  보고서 </title></head><body><h1>본문 제목</h1><p>글</p></body></html>",
    );
    expect(r.title).toBe("보고서");
    expect(flat(r.doc as never)).toContain("본문 제목");
  });

  it("<title>이 없으면 첫 <h1>을 제목으로 쓰고 본문에서 뺀다", async () => {
    const r = await htmlToDoc("<h1>첫 제목</h1><h2>소제목</h2><ul><li>항목</li></ul>");
    expect(r.title).toBe("첫 제목");
    const parts = flat(r.doc as never);
    expect(parts).not.toContain("첫 제목");
    expect(parts).toEqual(expect.arrayContaining(["heading", "소제목", "bulletList", "항목"]));
  });

  it("제목이 없으면 null", async () => {
    expect((await htmlToDoc("<p>그냥 글</p>")).title).toBeNull();
  });

  it("스크립트·스타일·이벤트 속성·위험한 링크를 버린다", async () => {
    const r = await htmlToDoc(
      '<script>alert(1)</script><style>p{}</style><p onclick="x()" style="color:red">글 <a href="javascript:alert(2)">나쁜 링크</a> <a href="https://example.com/a">좋은 링크</a></p><noscript>막힘</noscript>',
    );
    const text = JSON.stringify(r.doc);
    expect(text).not.toContain("alert");
    expect(text).not.toContain("javascript:");
    expect(text).not.toContain("onclick");
    expect(text).toContain("https://example.com/a");
    expect(text).toContain("나쁜 링크");
  });

  it("상대 경로 그림은 resolveImage가 준 assets 경로로 바꾼다", async () => {
    const resolve = vi.fn(async (src: string) => `assets/p1/${src.replace("/", "-")}`);
    const r = await htmlToDoc('<p><img src="img/a.png" alt="설명"></p>', resolve);
    expect(resolve).toHaveBeenCalledWith("img/a.png");
    expect(JSON.stringify(r.doc)).toContain("assets/p1/img-a.png");
  });

  it("옮기지 못한 그림은 그림 대신 캡션(없으면 경로) 글로 남긴다", async () => {
    const r = await htmlToDoc('<p>앞</p><p><img src="img/none.png"></p>', async () => {
      throw new Error("missing");
    });
    const text = JSON.stringify(r.doc);
    expect(text).not.toContain('"type":"image"');
    expect(text).toContain("img/none.png");
    expect(text).toContain("앞");
  });
});
