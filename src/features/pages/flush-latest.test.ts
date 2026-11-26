import { createMemoryStorage, createPage, type Page } from "@/lib/storage";
import { describe, expect, it, vi } from "vitest";
import { createPagesStore } from "./store";

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const page = (): Page => ({
  ...createPage({ title: "A" }),
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
  content: doc("본문"),
});

describe("편집 내용은 flushAll 때 빠짐없이 저장된다 (DATA-01)", () => {
  it("800ms 디바운스 중이어도 flushAll은 마지막 키 입력까지 쓴다", async () => {
    const a = page();
    const storage = createMemoryStorage({ pages: [a] });
    const write = vi.spyOn(storage, "writePage");
    const store = createPagesStore(storage);
    await store.getState().load();
    await store.getState().ensureBody(a.id);

    // 에디터 onUpdate → update 가 키 입력마다 동기로 호출된다
    store.getState().update(a.id, { content: doc("첫 글자") });
    store.getState().update(a.id, { content: doc("마지막 키 입력") });

    expect(await store.getState().flushAll()).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]![0]).toMatchObject({ id: a.id, content: doc("마지막 키 입력") });
    expect(store.getState().saveState).toBe("saved");
  });
});
