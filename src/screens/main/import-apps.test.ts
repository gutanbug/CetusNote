// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage, type AppImportPick, type Page } from "@/lib/storage";
import { createPagesStore } from "@/features/pages/store";
import { parseAppExport } from "@/features/import/apps/pipeline";

/** 테스트마다 새 페이지 저장소(메모리)를 쓴다 */
const h = vi.hoisted(() => ({
  store: null as unknown as ReturnType<typeof import("@/features/pages/store").createPagesStore>,
  toasts: [] as string[],
}));

vi.mock("@/features/pages", () => ({
  get pagesStore() {
    return h.store;
  },
  usePages: () => ({}),
}));
vi.mock("./actions", () => ({
  ancestors: () => [],
  openPage: () => {},
  createDocument: (parentId: string | null) => h.store.getState().create({ title: "", parentId }),
}));
vi.mock("@/features/session", () => ({
  sessionStore: { getState: () => ({ expand: () => {} }) },
}));
vi.mock("@/features/meta", () => ({
  metaStore: { getState: () => ({ meta: null, setTagColor: () => {} }) },
}));
vi.mock("@/components/ui/toast", () => ({
  toast: (message: string) => {
    h.toasts.push(message);
  },
}));

const info = { name: "가져오기", path: "/memory/가져오기" };
/** PNG 시그니처만 있는 최소 바이트 (종류 판별용) */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pick(texts: [string, string][], paths: string[] = []): AppImportPick {
  return {
    texts: texts.map(([path, text]) => ({ path, text })),
    paths: [...texts.map(([p]) => p), ...paths],
    skipped: [],
  };
}

describe("다른 앱 가져오기 — 페이지 만들기 (DATA-11)", () => {
  beforeEach(() => {
    h.toasts.length = 0;
    const storage = createMemoryStorage({ info, pages: [] });
    h.store = createPagesStore(storage, { delay: 10_000 });
  });

  it("Obsidian: 묶음 폴더 아래에 문서를 만들고, 링크·그림·콜아웃을 살린다", async () => {
    const { writeImport } = await import("./import-apps");
    const source = pick(
      [
        ["프로젝트.md", "# 프로젝트\n[[할 일]] 본문\n![[img/a.png]]"],
        ["할 일.md", "# 할 일\n> [!tip] 팁\n> 내용"],
      ],
      ["img/a.png"],
    );
    const outcome = parseAppExport("obsidian", source);
    const storage = createMemoryStorage({
      info,
      pages: [],
      pickAppSource: () => source,
      appImportBytes: { "img/a.png": PNG },
    });
    const made = await writeImport("obsidian", outcome, source, null, storage);

    const pages = Object.values(h.store.getState().pages) as Page[];
    const container = pages.find((p) => p.title === "Obsidian에서 가져옴")!;
    expect(container.kind).toBe("folder");
    expect(container.parentId).toBeNull();
    const project = pages.find((p) => p.title === "프로젝트")!;
    const todo = pages.find((p) => p.title === "할 일")!;
    expect(project.parentId).toBe(container.id);
    expect(todo.parentId).toBe(container.id);
    expect(made).toHaveLength(2);

    const projectJson = JSON.stringify(project.content);
    expect(projectJson).toContain(`"id":"${todo.id}"`);
    expect(projectJson).toContain("assets/");
    expect(JSON.stringify(todo.content)).toContain('"type":"callout"');
    expect(h.toasts.join(" ")).toContain("2개");
  });

  it("Notion: CSV 데이터베이스는 컬렉션이 되고, 레코드에 칸 값이 들어간다", async () => {
    const { writeImport } = await import("./import-apps");
    const csv = 'Name,완료,태그\n첫 줄,Yes,"독서, 메모"\n둘째,No,메모';
    const source = pick([
      ["할 일 3f2a9c1e4b5d4e6f8a7b9c0d1e2f3a4b_all.csv", csv],
      ["할 일 3f2a9c1e4b5d4e6f8a7b9c0d1e2f3a4b/첫 줄.md", "# 첫 줄\n본문"],
    ]);
    const outcome = parseAppExport("notion", source);
    const storage = createMemoryStorage({ info, pages: [] });
    await writeImport("notion", outcome, source, null, storage);

    const pages = Object.values(h.store.getState().pages) as Page[];
    const coll = pages.find((p) => p.kind === "collection")!;
    expect(coll.title).toBe("할 일");
    expect(coll.collection!.fields.map((f) => f.type)).toEqual(["checkbox", "multi"]);
    const first = pages.find((p) => p.title === "첫 줄")!;
    expect(first.parentId).toBe(coll.id);
    const done = coll.collection!.fields.find((f) => f.name === "완료")!;
    expect(first.props.values[done.id]).toBe(true);
    const second = pages.find((p) => p.title === "둘째")!;
    expect(second.props.values[done.id]).toBeUndefined();
  });
});
