import { createMemoryStorage, createPage } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { createPagesStore } from "./store";

const info = { name: "노트", path: "/memory/노트" };
const A = "01JD0000000000000000000000";
const B = "01JD0000000000000000000001";
const OLD = "2026-11-01T00:00:00.000Z";
const NOW = "2026-11-22T00:00:00.000Z";
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

async function setup() {
  const a = { ...createPage({ title: "가" }), id: A, updatedAt: OLD };
  const b = { ...createPage({ title: "나" }), id: B, updatedAt: OLD };
  const storage = createMemoryStorage({ info, pages: [a, b] });
  const store = createPagesStore(storage, { delay: 10_000, now: () => NOW });
  await store.getState().load();
  return { store };
}

describe("구조 스냅샷 (SYS-10)", () => {
  it("본문만 고치면 structure 참조가 그대로이고, 고친 페이지의 본문·시각은 pages에 있다", async () => {
    const { store } = await setup();
    const before = store.getState().structure;
    const beforeA = before[A];

    store.getState().update(A, { content: doc("안녕") as never });

    expect(store.getState().structure).toBe(before);
    expect(store.getState().structure[A]).toBe(beforeA);
    expect(store.getState().pages[A]!.content).toEqual(doc("안녕"));
    expect(store.getState().pages[A]!.updatedAt).toBe(NOW);
    expect("content" in store.getState().structure[A]!).toBe(false);
  });

  it("제목·부모 같은 구조 필드를 바꾸면 그 페이지의 구조 스냅샷만 새로 만든다", async () => {
    const { store } = await setup();
    const before = store.getState().structure;

    store.getState().update(A, { title: "바뀜" });

    expect(store.getState().structure).not.toBe(before);
    expect(store.getState().structure[A]!.title).toBe("바뀜");
    expect(store.getState().structure[B]).toBe(before[B]);
  });

  it("구조 필드가 그대로 같은 patch는 structure를 바꾸지 않는다", async () => {
    const { store } = await setup();
    const before = store.getState().structure;
    store.getState().update(A, { title: "가" });
    expect(store.getState().structure).toBe(before);
  });

  it("본문 편집 뒤 구조 편집을 하면 두 값 모두 최신이다", async () => {
    const { store } = await setup();
    store.getState().update(A, { content: doc("본문") as never });
    store.getState().update(A, { title: "새 제목" });
    expect(store.getState().structure[A]!.title).toBe("새 제목");
    expect(store.getState().pages[A]!.content).toEqual(doc("본문"));
  });

  it("휴지통으로 옮기면 구조가 바뀌고, 영구 삭제 전에는 구조에 남는다", async () => {
    const { store } = await setup();
    store.getState().trash(A);
    expect(store.getState().structure[A]!.trashedAt).toBe(NOW);
  });

  it("patchMany는 바뀐 id의 구조만 갱신한다", async () => {
    const { store } = await setup();
    const before = store.getState().structure;
    store
      .getState()
      .patchMany({ [A]: { props: { ...store.getState().pages[A]!.props, tags: ["x"] } } });
    expect(store.getState().structure[A]!.props.tags).toEqual(["x"]);
    expect(store.getState().structure[B]).toBe(before[B]);
  });
});
