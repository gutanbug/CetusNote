import { createMemoryStorage, createPage, type Page } from "@/lib/storage";
import { describe, expect, it, vi } from "vitest";
import { createPagesStore } from "./store";

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** 에디터가 열 때 채우는 노드 기본 속성(textAlign: null)을 붙인 같은 내용 */
const withDefaultAttrs = (text: string) => ({
  type: "doc" as const,
  content: [
    {
      type: "paragraph",
      attrs: { textAlign: null },
      content: [{ type: "text", text }],
    },
  ],
});

/** updatedAt을 과거로 고정해 갱신 여부를 밀리초 차이 없이 본다 */
const page = (title: string, text: string): Page => ({
  ...createPage({ title }),
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
  content: doc(text),
});

describe("열기만 하면 쓰지 않는다 (DATA-07, DATA-09)", () => {
  it("본문을 열고 에디터가 기본 속성을 채워도 저장·updatedAt 변경이 없다", async () => {
    const a = page("A", "본문 A");
    const storage = createMemoryStorage({ pages: [a] });
    const write = vi.spyOn(storage, "writePage");
    const store = createPagesStore(storage);
    await store.getState().load();
    await store.getState().ensureBody(a.id);
    const before = store.getState().pages[a.id]!;

    // 에디터 마운트 시 onChange(getJSON) — 내용은 같고 null 속성만 늘었다
    store.getState().update(a.id, { content: withDefaultAttrs("본문 A") });

    const after = store.getState().pages[a.id]!;
    expect(after).toBe(before);
    expect(after.updatedAt).toBe(a.updatedAt);
    expect(store.getState().saveState).toBe("saved");
    expect(write).not.toHaveBeenCalled();
  });

  it("실제로 바뀐 내용은 저장을 예약하고 updatedAt을 갱신한다", async () => {
    const a = page("A", "본문 A");
    const storage = createMemoryStorage({ pages: [a] });
    const store = createPagesStore(storage);
    await store.getState().load();
    await store.getState().ensureBody(a.id);

    store.getState().update(a.id, { content: doc("고친 본문") });

    const after = store.getState().pages[a.id]!;
    expect(after.updatedAt).not.toBe(a.updatedAt);
    expect(store.getState().saveState).toBe("saving");
  });
});
