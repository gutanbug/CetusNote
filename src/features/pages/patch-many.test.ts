import { createMemoryStorage, createPage } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { createPagesStore } from "./store";

const info = { name: "노트", path: "/memory/노트" };
const A = "01JD0000000000000000000000";
const B = "01JD0000000000000000000001";
const OLD = "2026-11-01T00:00:00.000Z";
const NEW = "2026-11-22T00:00:00.000Z";

describe("patchMany (태그 관리 SHELL-18)", () => {
  it("여러 페이지를 한 번에 고치고, updatedAt은 patch에 적은 값을 그대로 쓴다", async () => {
    const a = {
      ...createPage({ title: "가" }),
      id: A,
      updatedAt: OLD,
      props: { ...createPage({}).props, tags: ["x"] },
    };
    const b = { ...createPage({ title: "나" }), id: B, updatedAt: OLD };
    const storage = createMemoryStorage({ info, pages: [a, b] });
    const store = createPagesStore(storage, { delay: 10_000 });
    await store.getState().load();

    store.getState().patchMany({
      [A]: { props: { ...a.props, tags: ["y"] }, updatedAt: NEW },
      "01JD0000000000000000000009": { title: "없는 페이지" },
    });

    expect(store.getState().pages[A]!.props.tags).toEqual(["y"]);
    expect(store.getState().pages[A]!.updatedAt).toBe(NEW);
    expect(store.getState().pages[B]).toEqual(b);
    expect(store.getState().pages["01JD0000000000000000000009"]).toBeUndefined();
  });

  it("updatedAt을 patch에 주지 않으면 그대로 둔다 (자동으로 바꾸지 않는다)", async () => {
    const a = { ...createPage({ title: "가" }), id: A, updatedAt: OLD };
    const storage = createMemoryStorage({ info, pages: [a] });
    const store = createPagesStore(storage, { delay: 10_000 });
    await store.getState().load();
    store.getState().patchMany({ [A]: { title: "바뀜" } });
    expect(store.getState().pages[A]!.title).toBe("바뀜");
    expect(store.getState().pages[A]!.updatedAt).toBe(OLD);
  });
});
