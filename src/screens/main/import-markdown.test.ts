import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Storage } from "@/lib/storage";
import { toast } from "@/components/ui/toast";
import { importMarkdown } from "./import-markdown";

vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

/** pickMarkdown만 바꿔 끼우는 가짜 저장소 — 가져오기 시작 단계만 본다 */
const storageWith = (pickMarkdown: () => Promise<unknown>) =>
  ({ pickMarkdown, importMarkdownImage: vi.fn() }) as unknown as Storage;

describe("Markdown 가져오기 시작 (DATA-08)", () => {
  beforeEach(() => {
    vi.mocked(toast).mockClear();
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

  it("고른 파일이 모두 못 읽히면 가져오지 못했다고 알리고 건너뛴 파일 이름을 보여준다", async () => {
    const made = await importMarkdown(
      storageWith(async () => ({ files: [], skipped: ["큰파일"] })),
    );
    expect(made).toEqual([]);
    expect(toast).toHaveBeenCalledWith("Markdown 파일을 가져오지 못했어요", {
      description: "큰파일",
    });
  });
});
