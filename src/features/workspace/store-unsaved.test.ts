import { createMemoryStorage } from "@/lib/storage";
import { describe, expect, it, vi } from "vitest";
import { createWorkspaceStore } from "./store";

const A = { name: "A", path: "/memory/A" };
const B = { name: "B", path: "/memory/B" };

/** 저장이 되는지 바꿀 수 있는 워크스페이스 상태 (beforeChange 흉내) */
function setup() {
  const storage = createMemoryStorage({ info: A, pickResult: B });
  const flag = { ok: true, calls: 0 };
  const store = createWorkspaceStore(storage, {
    beforeChange: async () => {
      flag.calls++;
      return flag.ok;
    },
  });
  return { storage, store, flag };
}

describe("저장하지 못한 변경이 있을 때 워크스페이스 바꾸기 (DATA-03)", () => {
  it("저장하지 못하면 폴더를 바꾸지 않고 대화상자 선택지를 준다", async () => {
    const { storage, store, flag } = setup();
    await store.getState().init();
    await store.getState().pick(); // B로 옮겨 둔다
    flag.ok = false;
    const spy = vi.spyOn(storage, "switchWorkspace");
    await store.getState().switchTo(A.path);
    expect(spy).not.toHaveBeenCalled();
    expect(store.getState().workspace?.path).toBe(B.path);
    expect(store.getState().unsaved).not.toBeNull();
    expect(store.getState().busy).toBeNull();
  });

  it("다시 시도: 저장이 되면 바꾸고 대화상자를 닫는다", async () => {
    const { store, flag } = setup();
    await store.getState().init();
    await store.getState().pick();
    flag.ok = false;
    await store.getState().switchTo(A.path);
    flag.ok = true;
    await store.getState().unsaved?.retry();
    expect(store.getState().workspace?.path).toBe(A.path);
    expect(store.getState().unsaved).toBeNull();
  });

  it("다시 시도가 또 실패하면 폴더는 그대로이고 대화상자가 남는다", async () => {
    const { store, flag } = setup();
    await store.getState().init();
    await store.getState().pick();
    flag.ok = false;
    await store.getState().switchTo(A.path);
    const before = flag.calls;
    await store.getState().unsaved?.retry();
    expect(flag.calls).toBe(before + 1);
    expect(store.getState().workspace?.path).toBe(B.path);
    expect(store.getState().unsaved).not.toBeNull();
  });

  it("저장하지 않고 진행: 저장 검사 없이 바꾸고 대화상자를 닫는다", async () => {
    const { store, flag } = setup();
    await store.getState().init();
    await store.getState().pick();
    flag.ok = false;
    await store.getState().switchTo(A.path);
    const before = flag.calls;
    await store.getState().unsaved?.discard();
    expect(flag.calls).toBe(before); // 저장 검사를 다시 하지 않는다
    expect(store.getState().workspace?.path).toBe(A.path);
    expect(store.getState().unsaved).toBeNull();
  });

  it("취소: 폴더는 그대로 두고 대화상자만 닫는다", async () => {
    const { storage, store, flag } = setup();
    await store.getState().init();
    await store.getState().pick();
    flag.ok = false;
    const spy = vi.spyOn(storage, "switchWorkspace");
    await store.getState().switchTo(A.path);
    store.getState().unsaved?.cancel();
    expect(store.getState().unsaved).toBeNull();
    expect(store.getState().workspace?.path).toBe(B.path);
    expect(spy).not.toHaveBeenCalled();
  });
});
