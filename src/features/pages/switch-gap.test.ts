import { createMemoryStorage, createPage, type Page } from "@/lib/storage";
import { describe, expect, it, vi } from "vitest";
import { createPagesStore } from "./store";

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const page = (title: string, text: string): Page => ({
  ...createPage({ title }),
  content: doc(text),
});

describe("폴더를 바꾸는 사이의 편집 (DATA-03)", () => {
  it("세대가 바뀐 뒤 새 목록을 읽기 전의 편집은 새 폴더에 쓰지 않는다", async () => {
    const a = page("A", "옛 폴더 본문");
    const storage = createMemoryStorage({ pages: [a] });
    const write = vi.spyOn(storage, "writePage");
    let gen = 1;
    const store = createPagesStore(storage, { generation: () => gen, delay: 0 });
    await store.getState().load();
    await store.getState().ensureBody(a.id);

    // 폴더를 바꿨다(세대 증가). 새 목록을 읽기 전에 옛 에디터가 편집을 보낸다
    gen = 2;
    store.getState().update(a.id, { content: doc("옛 에디터의 늦은 편집") });
    expect(await store.getState().flushAll()).toBe(true);
    expect(write).not.toHaveBeenCalled();

    // 새 목록을 읽은 뒤의 편집은 정상으로 저장된다
    await store.getState().load();
    const b = store.getState().create({ title: "새 폴더 페이지" });
    expect(await store.getState().flushAll()).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]![0].id).toBe(b.id);
  });
});
