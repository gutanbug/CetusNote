import { StorageError, createMemoryStorage } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { createWorkspaceStore, switchErrorMessage, workspaceErrorMessage } from "./store";

const A = { name: "A", path: "/memory/A" };
const B = { name: "B", path: "/memory/B" };

describe("다른 창이 쓰는 폴더 (DATA-03)", () => {
  it("잠긴 폴더로 바꾸면 현재 워크스페이스를 그대로 두고 해요체 안내를 준다", async () => {
    const storage = createMemoryStorage({
      info: A,
      pickResult: B,
      failSwitch: (path) =>
        path === A.path
          ? new StorageError("locked", "이 워크스페이스는 다른 CetusNote 창에서 열려 있어요.")
          : undefined,
    });
    const store = createWorkspaceStore(storage);
    await store.getState().init();
    await store.getState().pick(); // B로 옮겨 둔다
    await expect(store.getState().switchTo(A.path)).rejects.toMatchObject({ code: "locked" });
    expect(store.getState().workspace?.path).toBe(B.path);
    expect(store.getState().phase).toBe("ready");
    expect(store.getState().busy).toBeNull();
    expect(switchErrorMessage(A.name, new StorageError("locked", "x"))).toBe(
      "다른 Cetus Note 창이 이 폴더를 쓰고 있어요. 그 창을 닫은 뒤 다시 열어 주세요.",
    );
  });

  it("locked 오류 문구는 열기·전환 공통으로 같은 문구를 쓴다", () => {
    expect(workspaceErrorMessage(new StorageError("locked", "x"))).toBe(
      "다른 Cetus Note 창이 이 폴더를 쓰고 있어요. 그 창을 닫은 뒤 다시 열어 주세요.",
    );
  });
});
