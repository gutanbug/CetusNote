import { describe, expect, it } from "vitest";
import { convertNotion } from "./notion";
import { placeNodes, resolveStem, safeSegments, stripNotionId } from "./tree";

const ID = "3f2a9c1e4b5d4e6f8a7b9c0d1e2f3a4b";

describe("Notion 내보내기 가져오기 (DATA-11)", () => {
  it("이름의 id 꼬리를 떼고, X.md + X/ 폴더는 X의 하위가 된다", () => {
    const { nodes, skipped } = convertNotion([
      { path: `할 일 ${ID}.md`, text: "# 할 일\n\n본문" },
      { path: `할 일 ${ID}/하위 ${ID}.md`, text: "# 하위\n" },
      { path: `메모 ${ID}.md`, text: "글" },
    ]);
    expect(skipped).toEqual([]);
    const parent = nodes.find((n) => n.title === "할 일")!;
    expect(parent.parentKey).toBeNull();
    const child = nodes.find((n) => n.title === "하위")!;
    expect(child.parentKey).toBe(parent.key);
    expect(nodes.some((n) => n.kind === "folder")).toBe(false);
  });

  it("H1 다음 Tags 줄은 태그가 되고, 다른 속성 줄은 본문에 남는다", () => {
    const text = "# 책\nTags: 독서, 메모\n작성: 차현민\n\n본문";
    const { nodes } = convertNotion([{ path: "책.md", text }]);
    expect(nodes[0]!.tags).toEqual(["독서", "메모"]);
    expect(nodes[0]!.markdown).toContain("작성: 차현민");
    expect(nodes[0]!.markdown).not.toContain("Tags:");
    expect(nodes[0]!.title).toBe("책");
  });

  it("상대 .md 링크는 URL 디코딩 후 노트 링크가 되고, 못 찾으면 글자만 남긴다", () => {
    const text = `# 목차\n\n[다른 글](%EB%8B%A4%EB%A5%B8%20%EA%B8%80%20${ID}.md) 그리고 [없는 글](없음.md) 그리고 [웹](https://a.b)`;
    const { nodes } = convertNotion([
      { path: `다른 글 ${ID}.md`, text: "# 다른 글" },
      { path: "목차.md", text },
    ]);
    const md = nodes.find((n) => n.title === "목차")!.markdown;
    const target = nodes.find((n) => n.title === "다른 글")!;
    expect(md).toContain(`<a data-page-mention="${target.key}">다른 글</a>`);
    expect(md).toContain("없는 글");
    expect(md).not.toContain("없음.md");
    expect(md).toContain("[웹](https://a.b)");
  });

  it("상대 그림은 자산 경로로 모으고, <aside>는 콜아웃이 된다", () => {
    const text = "# 그림\n![사진](img/a%20b.png)\n\n<aside>\n💡 알아 둘 점\n둘째 줄\n</aside>";
    const { nodes } = convertNotion([{ path: "그림.md", text }]);
    const note = nodes[0]!;
    expect(note.assetPaths).toEqual(["img/a b.png"]);
    expect(note.markdown).toContain("![사진](<img/a b.png>)");
    expect(note.markdown).toContain('data-type="callout" data-emoji="💡" data-color="gray"');
    expect(note.markdown).toContain("<p>알아 둘 점</p>");
    expect(note.markdown).toContain("<p>둘째 줄</p>");
  });

  it("CSV(데이터베이스)는 건너뛴 목록에 남긴다", () => {
    const { nodes, skipped } = convertNotion([
      { path: `표 ${ID}_all.csv`, text: "a,b" },
      { path: "글.md", text: "x" },
    ]);
    expect(skipped).toEqual([`표 ${ID}_all.csv`]);
    expect(nodes).toHaveLength(1);
  });
});

describe("다른 앱 가져오기 공통 도구 (DATA-11)", () => {
  it("안전하지 않은 경로(.., 절대, 역슬래시, 드라이브 문자)는 null", () => {
    expect(safeSegments("../a.md")).toBeNull();
    expect(safeSegments("/etc/a.md")).toBeNull();
    expect(safeSegments("a\\..\\b.md")).toBeNull();
    expect(safeSegments("C:/a.md")).toBeNull();
    expect(safeSegments("a/./b.md")).toEqual(["a", "b.md"]);
  });

  it("stripNotionId는 32자리 id와 UUID 꼬리만 뺀다", () => {
    expect(stripNotionId(`글 ${ID}`)).toBe("글");
    expect(stripNotionId("글 3f2a9c1e-4b5d-4e6f-8a7b-9c0d1e2f3a4b")).toBe("글");
    expect(stripNotionId("2026 계획")).toBe("2026 계획");
  });

  it("resolveStem은 같은 폴더 → 짧은 경로 순으로 고른다", () => {
    const stems = ["a/목표", "목표", "x/목표"];
    expect(resolveStem("목표", stems, "x")).toBe("x/목표");
    expect(resolveStem("목표", stems)).toBe("목표");
    expect(resolveStem("a/목표", stems)).toBe("a/목표");
    expect(resolveStem("없음", stems)).toBeNull();
  });

  it("placeNodes는 폴더 노드를 만들고 부모를 잇는다", () => {
    const placed = placeNodes(["a/b/c"]);
    expect(placed.map((n) => n.kind).sort()).toEqual(["folder", "folder", "page"]);
    expect(placed.find((n) => n.key === "p:a/b/c")!.parentKey).toBe("d:a/b");
    expect(placed.find((n) => n.key === "d:a")!.parentKey).toBeNull();
  });
});
