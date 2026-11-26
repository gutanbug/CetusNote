import { describe, expect, it } from "vitest";
import type { Page } from "@/lib/storage";
import { createSaveQueue } from "./save-queue";

/** 저장 순서 회귀 (DATA-02): 실패 뒤 재시도·닫기 저장이 옛 내용을 새 내용 뒤에 쓰지 않는다 */
const page = (content: string) =>
  ({ id: "01JD0000000000000000000149", content }) as unknown as Page;
const tick = () => new Promise((r) => setTimeout(r, 5));

describe("저장 큐 쓰기 순서", () => {
  it("실패한 옛 내용이 나중에 재시도돼도 그 뒤 새 내용을 덮지 않는다", async () => {
    const written: string[] = [];
    let failNext = true;
    const q = createSaveQueue({
      delay: 0,
      generation: () => 0,
      write: async (p) => {
        if (failNext) {
          failNext = false;
          throw new Error("disk busy");
        }
        written.push((p as unknown as { content: string }).content);
      },
    });
    q.schedule(page("CHK2-1795"));
    expect(await q.flush()).toBe(false);
    // 옛 내용이 재시도 대기 중에 더 새 내용이 들어왔다
    q.schedule(page("CHK2-17956648440977"));
    await tick();
    expect(await q.flush()).toBe(true);
    // 재시도 타이머가 남아 있어도 최신 내용만 쓰고, 옛 내용은 다시 쓰지 않는다
    await q.retry();
    await tick();
    expect(written[written.length - 1]).toBe("CHK2-17956648440977");
    expect(written).not.toContain("CHK2-1795");
  });
});
