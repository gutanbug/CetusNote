import { createPage, type FieldDef, type Page } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { parseMarkdownFile } from "@/features/import/markdown";
import { buildWorkspaceExport, relativeHref, sanitizeFileName, type ExportFile } from "./workspace";

const NOW = "2026-11-19T09:00:00.000Z";
let seq = 0;
/** 고정 id·시각을 가진 페이지 */
function pg(init: Partial<Page> & { title: string }): Page {
  seq++;
  return {
    ...createPage({ content: { type: "doc", content: [] }, ...init }),
    id: `01JD00000000000000000000${String(seq).padStart(2, "0")}`,
    createdAt: NOW,
    updatedAt: NOW,
    trashedAt: null,
    template: null,
    ...init,
  } as Page;
}
const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...nodes: unknown[]) => ({ type: "doc" as const, content: nodes });
const mention = (id: string, label = "") => ({
  type: "pageMention",
  attrs: { id, label },
});
const mentionPara = (...parts: unknown[]) => ({ type: "paragraph", content: parts });
const txt = (text: string) => ({ type: "text", text });

function build(pages: Page[], order: Record<string, string[]> = {}) {
  return buildWorkspaceExport({ pages, order, workspaceName: "내 노트", date: "2026-11-21" });
}
const paths = (files: ExportFile[]) => files.map((f) => f.path);
const textOf = (files: ExportFile[], path: string) => {
  const f = files.find((x) => x.path === path);
  if (!f || !("text" in f)) throw new Error(`no text file ${path}: ${paths(files)}`);
  return f.text;
};

describe("sanitizeFileName", () => {
  it("금지 글자·제어 문자를 공백으로 바꾸고 줄인다", () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a b c d e f g h i j");
    expect(sanitizeFileName("x\u0007\u0000y")).toBe("x y");
    expect(sanitizeFileName("  많은   공백  ")).toBe("많은 공백");
  });
  it("앞의 점을 떼고, 빈 이름은 제목 없음으로", () => {
    expect(sanitizeFileName("..secret")).toBe("secret");
    expect(sanitizeFileName("...")).toBe("제목 없음");
    expect(sanitizeFileName("   ")).toBe("제목 없음");
  });
  it("100자(글자 단위)로 자른다", () => {
    expect([...sanitizeFileName("가".repeat(150))]).toHaveLength(100);
    expect([...sanitizeFileName("😀".repeat(150))]).toHaveLength(100);
  });
});

describe("relativeHref", () => {
  it("같은 폴더·하위·상위 경로", () => {
    expect(relativeHref("a.md", "b.md")).toBe("b.md");
    expect(relativeHref("회의/주간.md", "회의/다음.md")).toBe("%EB%8B%A4%EC%9D%8C.md");
    expect(relativeHref("a/b/c.md", "assets/P/x.png")).toBe("../../assets/P/x.png");
    expect(relativeHref("a.md", "assets/P/x.png")).toBe("assets/P/x.png");
  });
  it("괄호는 링크를 깨므로 퍼센트 인코딩한다", () => {
    expect(relativeHref("a.md", "b (2).md")).toBe("b%20%282%29.md");
  });
});

describe("폴더 모양", () => {
  it("글 문서는 <제목>.md, 자식이 있으면 같은 이름의 폴더를 함께 만든다", () => {
    const parent = pg({ title: "프로젝트" });
    const child = pg({ title: "할 일", parentId: parent.id });
    const solo = pg({ title: "메모" });
    const out = build([parent, child, solo]);
    expect(paths(out.manifest.files).sort()).toEqual([
      "메모.md",
      "프로젝트.md",
      "프로젝트/할 일.md",
    ]);
    expect(out.documents).toBe(3);
    expect(out.manifest.rootName).toBe("내 노트 Markdown 2026-11-21");
  });

  it("폴더는 디렉터리만 되고 자식이 그 안에 들어간다", () => {
    const folder = pg({ title: "업무", kind: "folder" });
    const note = pg({ title: "보고", parentId: folder.id });
    const out = build([folder, note]);
    expect(paths(out.manifest.files)).toEqual(["업무/보고.md"]);
  });

  it("컬렉션은 디렉터리 + index.md, 레코드는 그 안의 .md", () => {
    const coll = pg({ title: "읽을거리", kind: "collection" });
    const rec = pg({ title: "책 A", parentId: coll.id });
    const out = build([coll, rec]);
    expect(paths(out.manifest.files).sort()).toEqual(["읽을거리/index.md", "읽을거리/책 A.md"]);
    expect(out.documents).toBe(1);
  });

  it("order(workspace.json)대로 형제 순서를 맞추고, 목록에 없으면 만든 순서 뒤에 둔다", () => {
    const a = { ...pg({ title: "가" }), createdAt: "2026-01-01T00:00:00Z" };
    const b = { ...pg({ title: "나" }), createdAt: "2026-01-02T00:00:00Z" };
    const c = { ...pg({ title: "다" }), createdAt: "2025-01-01T00:00:00Z" };
    const out = build([a, b, c], { root: [b.id] });
    const order = out.manifest.files.map((f) => f.path);
    expect(order[0]).toBe("나.md");
    expect(order.slice(1).sort()).toEqual(["가.md", "다.md"]);
  });
});

describe("이름 정리와 겹침", () => {
  it("빈 제목은 제목 없음, 금지 글자는 빼고, 같은 이름은 (2)·(3)", () => {
    const pages = [
      pg({ title: "" }),
      pg({ title: "a/b" }),
      pg({ title: "a b" }),
      pg({ title: "A B" }), // 대소문자만 다르면 macOS에서 같은 파일
    ];
    const names = paths(build(pages).manifest.files).sort();
    // 입력 순서와 상관없이 같은 이름 집합이어야 한다(대소문자 무시)
    expect(names.map((n) => n.toLowerCase()).sort()).toEqual(
      ["a b (2).md", "a b (3).md", "a b.md", "제목 없음.md"].map((n) => n.toLowerCase()).sort(),
    );
  });

  it("폴더·글·자식 있는 글이 같은 이름이면 서로 다른 이름이 된다", () => {
    const folder = pg({ title: "X", kind: "folder" });
    const plain = pg({ title: "X" });
    const withKid = pg({ title: "X" });
    const kid = pg({ title: "k", parentId: withKid.id });
    const out = paths(build([folder, plain, withKid, kid]).manifest.files).sort();
    // 글 두 개의 md 이름과 자식 폴더 이름이 모두 달라야 한다(대소문자 무시)
    const bases = out.map((p) => p.split("/")[0]!.replace(/\.md$/, "").toLowerCase());
    expect(out).toHaveLength(3);
    expect(new Set(bases.filter((b) => b.startsWith("x"))).size).toBe(2);
    expect(out.some((p) => p.endsWith("/k.md"))).toBe(true);
  });

  it("컬렉션의 레코드 이름 index는 index.md와 겹치지 않는다", () => {
    const coll = pg({ title: "C", kind: "collection" });
    const rec = pg({ title: "index", parentId: coll.id });
    expect(paths(build([coll, rec]).manifest.files).sort()).toEqual([
      "C/index (2).md",
      "C/index.md",
    ]);
  });
});

describe("휴지통·템플릿 건너뛰기", () => {
  it("휴지통 페이지와 템플릿, 그 아래 자식은 빼고 개수를 센다", () => {
    const live = pg({ title: "살아 있음" });
    const trashed = { ...pg({ title: "버림" }), trashedAt: NOW };
    const kid = pg({ title: "버린 자식", parentId: trashed.id });
    const tpl = {
      ...pg({ title: "템플릿" }),
      template: { category: "work", description: "", pageTitle: "", builtin: null },
    };
    const out = build([live, trashed, kid, tpl]);
    expect(paths(out.manifest.files)).toEqual(["살아 있음.md"]);
    expect(out.skipped).toEqual({ trashed: 2, templates: 1 });
  });
});

describe("front matter와 본문", () => {
  it("front matter 없이 H1 제목 한 번 + 본문 (DATA-10, 사용자 결정 2026-11-23)", () => {
    const p = pg({
      title: "주간 회의",
      content: doc(para("본문")),
      props: {
        tags: ["회의"],
        status: "진행 중",
        assignee: "차민석",
        due: "2026-11-24",
        values: {},
      },
    });
    const text = textOf(build([p]).manifest.files, "주간 회의.md");
    expect(text).toBe("# 주간 회의\n\n본문\n");
  });

  it("본문 맨 앞이 같은 제목의 H1이면 제목을 두 번 쓰지 않는다", () => {
    const p = pg({
      title: "주간 회의",
      content: doc(
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "주간 회의" }] },
        para("본문"),
      ),
    });
    const text = textOf(build([p]).manifest.files, "주간 회의.md");
    expect(text).toBe("# 주간 회의\n\n본문\n");
  });
});

describe("멘션 링크", () => {
  it("내보낸 대상은 상대 경로 링크, 없는 대상은 제목 글", () => {
    const target = pg({ title: "다른 문서" });
    const src = pg({
      title: "출발",
      props: { tags: [], status: null, assignee: null, due: null, values: {} },
      content: doc(
        mentionPara(
          txt("가는 곳: "),
          mention(target.id, "옛 제목"),
          txt(" / "),
          mention("01JZZZZZZZZZZZZZZZZZZZZZZZ", "없는 글"),
        ),
      ),
    });
    const files = build([src, target]).manifest.files;
    const text = textOf(files, "출발.md");
    expect(text).toContain("[다른 문서](%EB%8B%A4%EB%A5%B8%20%EB%AC%B8%EC%84%9C.md)");
    expect(text).toContain("가는 곳: [다른 문서]");
    expect(text).toContain(" / 없는 글");
    expect(text).not.toContain("cetusnote://");
  });

  it("멘션 제목은 지금 제목을 쓴다", () => {
    const target = pg({ title: "새 제목" });
    const src = pg({ title: "출발", content: doc(mentionPara(mention(target.id, "옛 제목"))) });
    expect(textOf(build([src, target]).manifest.files, "출발.md")).toContain("[새 제목]");
  });

  it("휴지통 대상 멘션은 글로만 남는다", () => {
    const target = { ...pg({ title: "버림" }), trashedAt: NOW };
    const src = pg({ title: "출발", content: doc(mentionPara(mention(target.id, "버림"))) });
    const text = textOf(build([src, target]).manifest.files, "출발.md");
    expect(text).toContain("\n버림\n");
    expect(text).not.toContain("[버림]");
  });

  it("컬렉션 멘션은 index.md로 간다", () => {
    const coll = pg({ title: "책장", kind: "collection" });
    const src = pg({ title: "메모", content: doc(mentionPara(mention(coll.id))) });
    expect(textOf(build([src, coll]).manifest.files, "메모.md")).toContain(
      "[책장](%EC%B1%85%EC%9E%A5/index.md)",
    );
  });
});

describe("이미지 자산", () => {
  const A = "01JD0000000000000000000AAA";
  const img = (src: string) => ({ type: "image", attrs: { src }, content: [txt("설명")] });

  it("본문 이미지는 assets/ 아래로 복사하고 상대 경로로 고친다", () => {
    const p = pg({ title: "사진첩", content: doc(img(`assets/${A}/img-1.png`)) });
    const child = pg({ title: "하위", parentId: p.id, content: doc(img(`assets/${A}/img-1.png`)) });
    const out = build([p, child]);
    const files = out.manifest.files;
    expect(textOf(files, "사진첩.md")).toContain(`![설명](assets/${A}/img-1.png)`);
    expect(textOf(files, "사진첩/하위.md")).toContain(`![설명](../assets/${A}/img-1.png)`);
    expect(files).toContainEqual({ path: `assets/${A}/img-1.png`, asset: `assets/${A}/img-1.png` });
    // 같은 이미지는 한 번만
    expect(out.assets).toBe(1);
  });

  it("원격 주소와 형식이 다른 로컬 경로", () => {
    const p = pg({
      title: "섞임",
      content: doc(
        img("https://example.com/a.png"),
        img("../../etc/passwd"),
        img("assets/bad/nested/x.png"),
      ),
    });
    const files = build([p]).manifest.files;
    const text = textOf(files, "섞임.md");
    expect(text).toContain("![설명](https://example.com/a.png)");
    expect(text).not.toContain("passwd");
    // 형식이 맞지 않는 워크스페이스 경로는 복사하지 않고 글만 남긴다
    expect(text).toContain("설명");
    expect(files.some((f) => "asset" in f)).toBe(false);
  });
});

describe("컬렉션 표", () => {
  const field = (id: string, name: string, type: FieldDef["type"]): FieldDef => ({
    id: id as FieldDef["id"],
    name,
    type,
    options: [],
  });

  it("기본 열과 사용자 속성 열, 레코드 링크", () => {
    const coll = pg({
      title: "읽을거리",
      kind: "collection",
      content: doc(para("안내 문장")),
    });
    coll.collection = {
      ...coll.collection!,
      fields: [
        field("f1", "쪽수", "number"),
        field("f2", "읽었나", "checkbox"),
        field("f3", "메모 | 줄", "text"),
      ],
    };
    const rec = pg({
      title: "책 A",
      parentId: coll.id,
      props: {
        tags: ["독서", "소설"],
        status: "진행 중",
        assignee: "나",
        due: "2026-12-01",
        values: { f1: 320, f2: true, f3: "a|b\n줄" } as Page["props"]["values"],
      },
    });
    const text = textOf(build([coll, rec]).manifest.files, "읽을거리/index.md");
    expect(text).toContain("# 읽을거리");
    expect(text).toContain("안내 문장");
    expect(text).toContain("| 제목 | 상태 | 담당 | 마감 | 태그 | 쪽수 | 읽었나 | 메모 \\| 줄 |");
    expect(text).toContain("| --- | --- | --- | --- | --- | --- | --- | --- |");
    expect(text).toContain(
      "| [책 A](%EC%B1%85%20A.md) | 진행 중 | 나 | 2026-12-01 | 독서, 소설 | 320 | 예 | a\\|b 줄 |",
    );
  });
});

describe("내보내기 전체", () => {
  it("빈 워크스페이스는 문서 0개", () => {
    const out = build([]);
    expect(out.documents).toBe(0);
    expect(out.manifest.files).toEqual([]);
  });

  it("루트 폴더 이름은 워크스페이스 이름을 정리해서 쓴다", () => {
    const out = buildWorkspaceExport({
      pages: [pg({ title: "x" })],
      order: {},
      workspaceName: "내/노트:",
      date: "2026-11-21",
    });
    expect(out.manifest.rootName).toBe("내 노트 Markdown 2026-11-21");
    const blank = buildWorkspaceExport({
      pages: [],
      order: {},
      workspaceName: "",
      date: "2026-11-21",
    });
    expect(blank.manifest.rootName).toBe("CetusNote Markdown 2026-11-21");
  });
});

describe("가져오기와 왕복", () => {
  it("내보낸 글을 DATA-08 가져오기가 H1의 제목·아이콘으로 다시 읽는다 (태그는 front matter가 없어 남지 않는다)", () => {
    const p = pg({
      title: "회의: 11/21",
      icon: "📝",
      content: doc(para("본문 줄")),
      props: { tags: ["회의", "주간"], status: null, assignee: null, due: null, values: {} },
    });
    const text = textOf(build([p]).manifest.files, "회의 11 21.md");
    const back = parseMarkdownFile("회의 11 21", text);
    // 파일 이름만 정리하고, 머리글의 제목은 원래 글자 그대로
    expect(back.title).toBe("회의: 11/21");
    expect(back.tags).toEqual([]);
    expect(back.icon).toBe("📝");
    expect(back.body).toContain("본문 줄");
  });
});
