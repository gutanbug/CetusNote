import { createMemoryStorage, createPage, type Page } from "@/lib/storage";
import { advanceWorkspaceGeneration } from "@/features/workspace/generation";
import { describe, expect, it, vi } from "vitest";
import { isBodyLoaded, UNLOADED_BODY } from "./body";
import { findBacklinks } from "./backlinks";
import { createPagesStore } from "./store";

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const page = (title: string, text: string): Page => ({
  ...createPage({ title }),
  content: doc(text),
});

/** 테스트에서 readPages를 손으로 풀어 준다 */
function gatedReads(storage: ReturnType<typeof createMemoryStorage>) {
  const real = storage.readPages.bind(storage);
  let open!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  const spy = vi.spyOn(storage, "readPages").mockImplementation(async (ids) => {
    await gate;
    return real(ids);
  });
  return { spy, open };
}

describe("본문 지연 로딩 (SYS-10, ADR-022)", () => {
  it("불러오면 구조만 있고 본문은 열 때 읽는다", async () => {
    const a = page("A", "본문 A");
    const storage = createMemoryStorage({ pages: [a] });
    const reads = vi.spyOn(storage, "readPages");
    const store = createPagesStore(storage);
    await store.getState().load();

    const loaded = store.getState().pages[a.id]!;
    expect(loaded.title).toBe("A");
    expect(isBodyLoaded(loaded)).toBe(false);
    expect(loaded.content).toBe(UNLOADED_BODY);
    expect(reads).not.toHaveBeenCalled();

    expect(await store.getState().ensureBody(a.id)).toBe(true);
    expect(isBodyLoaded(store.getState().pages[a.id]!)).toBe(true);
    expect(store.getState().pages[a.id]!.content).toEqual(doc("본문 A"));
    expect(reads).toHaveBeenCalledTimes(1);

    // 이미 읽은 본문은 다시 읽지 않는다
    expect(await store.getState().ensureBody(a.id)).toBe(true);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it("같은 페이지를 두 번 열어도 파일은 한 번만 읽는다 (열기 경쟁)", async () => {
    const a = page("A", "본문");
    const storage = createMemoryStorage({ pages: [a] });
    const store = createPagesStore(storage);
    await store.getState().load();
    const { spy, open } = gatedReads(storage);
    const first = store.getState().ensureBody(a.id);
    const second = store.getState().ensureBody(a.id);
    open();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("본문을 읽는 중에 이름을 고치면 본문은 디스크 것을 살리고 바뀐 이름은 한 번 저장한다", async () => {
    const a = page("원래", "디스크 본문");
    const storage = createMemoryStorage({ pages: [a] });
    const store = createPagesStore(storage, { delay: 5 });
    await store.getState().load();
    const writes = vi.spyOn(storage, "writePage");
    const { open } = gatedReads(storage);

    const opening = store.getState().ensureBody(a.id);
    store.getState().update(a.id, { title: "바뀐 이름" });
    open();
    expect(await opening).toBe(true);
    const now = store.getState().pages[a.id]!;
    expect(now.title).toBe("바뀐 이름");
    expect(now.content).toEqual(doc("디스크 본문"));

    expect(await store.getState().flushAll()).toBe(true);
    // 빈 본문이 아니라 실제 본문과 바뀐 이름으로 쓴다
    expect(writes).toHaveBeenCalled();
    for (const [written] of writes.mock.calls) {
      expect(written.content).toEqual(doc("디스크 본문"));
      expect(written.title).toBe("바뀐 이름");
    }
  });

  it("본문이 없는 채로 이름만 고쳐도 저장 전에 본문을 읽는다 (빈 본문으로 덮지 않는다)", async () => {
    const a = page("A", "중요한 본문");
    const storage = createMemoryStorage({ pages: [a] });
    const store = createPagesStore(storage, { delay: 5 });
    await store.getState().load();
    const writes = vi.spyOn(storage, "writePage");

    store.getState().update(a.id, { icon: "📌" });
    expect(await store.getState().flushAll()).toBe(true);

    expect(writes).toHaveBeenCalledTimes(1);
    expect(writes.mock.calls[0]![0].content).toEqual(doc("중요한 본문"));
    expect(writes.mock.calls[0]![0].icon).toBe("📌");
  });

  it("바깥에서 바뀐 본문을 열지 않은 페이지에도 반영하고 본문을 채운다", async () => {
    const a = page("A", "예전");
    const storage = createMemoryStorage({ pages: [a] });
    const store = createPagesStore(storage);
    await store.getState().load();
    const incoming = {
      ...a,
      content: doc("바깥에서 고친 본문"),
      updatedAt: "2030-01-01T00:00:00.000Z",
    };

    const result = store.getState().applyExternal({ pages: [incoming], removed: [] });
    expect(result.applied).toEqual([a.id]);
    expect(result.conflicts).toEqual([]);
    expect(store.getState().pages[a.id]!.content).toEqual(doc("바깥에서 고친 본문"));
    expect(isBodyLoaded(store.getState().pages[a.id]!)).toBe(true);
  });

  it("구조만 고친 뒤 들어온 바깥 변경은 덮지 않고 충돌로 알린다", async () => {
    const a = page("A", "본문");
    const storage = createMemoryStorage({ pages: [a] });
    const store = createPagesStore(storage, { delay: 1000 });
    await store.getState().load();
    const { open } = gatedReads(storage);
    store.getState().update(a.id, { title: "내가 고친 이름" });

    const incoming = { ...a, content: doc("바깥"), updatedAt: "2030-01-01T00:00:00.000Z" };
    const result = store.getState().applyExternal({ pages: [incoming], removed: [] });
    expect(result.conflicts).toEqual([a.id]);
    expect(result.applied).toEqual([]);
    open();
    expect(store.getState().pages[a.id]!.title).toBe("내가 고친 이름");
  });

  it("워크스페이스가 바뀌면 이전 폴더에서 읽은 본문은 버린다 (SYS-09)", async () => {
    const a = page("A", "이전 폴더 본문");
    const storage = createMemoryStorage({ pages: [a] });
    const store = createPagesStore(storage);
    await store.getState().load();
    const { open } = gatedReads(storage);
    const opening = store.getState().ensureBody(a.id);
    advanceWorkspaceGeneration();
    open();
    expect(await opening).toBe(false);
    expect(isBodyLoaded(store.getState().pages[a.id]!)).toBe(false);
  });

  it("모든 본문을 읽으면 백링크가 본문을 보고 찾는다", async () => {
    const target = page("대상", "");
    const from = page("출처", "");
    const storage = createMemoryStorage({ pages: [target, from] });
    // 출처 본문에 대상 멘션을 넣는다
    const linked = {
      ...from,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "참고: ",
              },
              {
                type: "pageMention",
                attrs: { id: target.id, label: "대상" },
              },
            ],
          },
        ],
      },
    };
    await storage.writePage(linked);
    const store = createPagesStore(storage);
    await store.getState().load();

    expect(findBacklinks(store.getState().pages, target.id)).toEqual([]);
    await store.getState().ensureAllBodies();
    expect(store.getState().pages[from.id]!.content).toEqual(linked.content);
    const links = findBacklinks(store.getState().pages, target.id);
    expect(links.map((b) => b.page.id)).toEqual([from.id]);
  });

  it("본문을 열지 않은 휴지통 페이지도 영구 삭제할 수 있다", async () => {
    const a = { ...page("지울 것", "본문"), trashedAt: "2030-01-01T00:00:00.000Z" };
    const storage = createMemoryStorage({ pages: [a] });
    const store = createPagesStore(storage);
    await store.getState().load();
    await store.getState().purge(a.id);
    expect(store.getState().pages[a.id]).toBeUndefined();
  });
});
