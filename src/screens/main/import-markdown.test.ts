import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Storage } from "@/lib/storage";
import { toast } from "@/components/ui/toast";
import { pagesStore } from "@/features/pages";
import { importMarkdown } from "./import-markdown";
import {
  answerImportDestination,
  cancelImportDestination,
  useImportDestination,
} from "./import-destination";

vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));
// 변환기는 DOM이 필요하다 — 이 테스트는 목적지 흐름만 본다
vi.mock("@/components/editor/markdown-import", () => ({
  markdownToDoc: vi.fn(async () => ({ type: "doc", content: [] })),
}));

/** pickMarkdown만 바꿔 끼우는 가짜 저장소 */
const storageWith = (pickMarkdown: () => Promise<unknown>) =>
  ({ pickMarkdown, importMarkdownImage: vi.fn() }) as unknown as Storage;

const twoFiles = async () => ({
  files: [
    { name: "a.md", text: "# 첫째\n\n본문 하나", dir: undefined },
    { name: "b.md", text: "# 둘째\n\n본문 둘", dir: undefined },
  ],
  skipped: [],
});

describe("Markdown 가져오기 시작 (DATA-08)", () => {
  beforeEach(() => {
    vi.mocked(toast).mockClear();
    cancelImportDestination();
  });

  it("파일 선택창을 취소하면 아무것도 보여주지 않는다", async () => {
    const made = await importMarkdown(storageWith(async () => null));
    expect(made).toEqual([]);
    expect(toast).not.toHaveBeenCalled();
  });

  it("선택 명령 호출이 실패하면 읽지 못했다고 알린다", async () => {
    const made = await importMarkdown(
      storageWith(async () => {
        throw new Error("command markdown_pick not allowed");
      }),
    );
    expect(made).toEqual([]);
    expect(toast).toHaveBeenCalledWith("Markdown 파일을 읽지 못했어요");
  });

  it("고른 파일이 모두 못 읽히면 목적지를 묻지 않고 건너뛴 파일 이름을 보여준다", async () => {
    const made = await importMarkdown(
      storageWith(async () => ({ files: [], skipped: ["큰파일"] })),
    );
    expect(made).toEqual([]);
    expect(useImportDestination.getState().pending).toBeNull();
    expect(toast).toHaveBeenCalledWith("Markdown 파일을 가져오지 못했어요", {
      description: "큰파일",
    });
  });
});

describe("Markdown 가져오기 목적지 (DATA-08)", () => {
  beforeEach(() => {
    vi.mocked(toast).mockClear();
    cancelImportDestination();
  });

  it("목적지를 취소하면 아무것도 가져오지 않는다", async () => {
    const before = Object.keys(pagesStore.getState().pages).length;
    const run = importMarkdown(storageWith(twoFiles));
    await vi.waitFor(() => expect(useImportDestination.getState().pending?.count).toBe(2));
    cancelImportDestination();
    expect(await run).toEqual([]);
    expect(Object.keys(pagesStore.getState().pages).length).toBe(before);
  });

  it("고른 폴더 아래에 파일 순서대로 만든다", async () => {
    const folder = pagesStore.getState().create({ kind: "folder", title: "받은 노트" });
    const run = importMarkdown(storageWith(twoFiles));
    await vi.waitFor(() => expect(useImportDestination.getState().pending).not.toBeNull());
    answerImportDestination(folder.id);
    const made = await run;
    expect(made.map((p) => p.parentId)).toEqual([folder.id, folder.id]);
    expect(made.map((p) => pagesStore.getState().pages[p.id]!.title)).toEqual(["첫째", "둘째"]);
  });

  it("맨 위를 고르면 워크스페이스 최상위에 만든다", async () => {
    const run = importMarkdown(storageWith(twoFiles));
    await vi.waitFor(() => expect(useImportDestination.getState().pending).not.toBeNull());
    answerImportDestination(null);
    const made = await run;
    expect(made).toHaveLength(2);
    expect(made.every((p) => p.parentId === null)).toBe(true);
  });
});
