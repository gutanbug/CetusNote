import { createMemoryStorage, StorageError } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import {
  createWorkspaceStore,
  shortenHome,
  switchErrorMessage,
  workspaceErrorMessage,
} from "./store";

describe("워크스페이스 열기 (DATA-03)", () => {
  it("열린 폴더가 있으면 바로 ready", async () => {
    const store = createWorkspaceStore(createMemoryStorage());
    await store.getState().init();
    expect(store.getState().phase).toBe("ready");
    expect(store.getState().workspace?.name).toBe("CetusNote");
  });

  it("첫 실행이면 setup, 기본 위치로 만들면 ready", async () => {
    const store = createWorkspaceStore(createMemoryStorage({ info: null }));
    await store.getState().init();
    expect(store.getState()).toMatchObject({
      phase: "setup",
      defaultLabel: "/memory/Documents/CetusNote",
    });
    await store.getState().openDefault();
    expect(store.getState()).toMatchObject({ phase: "ready", busy: null, error: null });
  });

  it("지난 폴더가 없어졌으면 그 경로를 ~로 줄여 알린다", async () => {
    const store = createWorkspaceStore(
      createMemoryStorage({ info: null, missingPath: "/Users/me/Dropbox/노트" }),
    );
    await store.getState().init();
    expect(store.getState()).toMatchObject({ phase: "setup", missingPath: "~/Dropbox/노트" });
  });

  it("대화상자를 취소하면 setup에 머문다", async () => {
    const store = createWorkspaceStore(createMemoryStorage({ info: null, pickResult: null }));
    await store.getState().init();
    await store.getState().pick();
    expect(store.getState()).toMatchObject({ phase: "setup", busy: null, error: null });
  });

  it("실패하면 오류 문구를 보여 주고 다시 시도할 수 있다", async () => {
    const storage = createMemoryStorage({ info: null });
    let fail = true;
    storage.pickWorkspace = async () => {
      if (fail) throw new StorageError("permission_denied", "denied");
      return { name: "노트", path: "/x/노트", token: 1 };
    };
    const store = createWorkspaceStore(storage);
    await store.getState().init();
    await store.getState().pick();
    expect(store.getState().error).toBe("이 폴더에는 쓸 수 없어요. 다른 폴더를 골라 주세요.");
    fail = false;
    await store.getState().pick();
    expect(store.getState()).toMatchObject({ phase: "ready", error: null });
  });

  it("진행 중에는 두 번 누르지 않는다", async () => {
    const storage = createMemoryStorage({ info: null });
    let calls = 0;
    storage.openDefaultWorkspace = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return { name: "CetusNote", path: "/x", token: 1 };
    };
    const store = createWorkspaceStore(storage);
    await Promise.all([store.getState().openDefault(), store.getState().openDefault()]);
    expect(calls).toBe(1);
  });
});

describe("워크스페이스 만들기·전환 (SHELL-15)", () => {
  it("만들면 열리고 최근 목록 맨 앞에 온다. 최근 목록으로 돌아간다", async () => {
    const storage = createMemoryStorage();
    const store = createWorkspaceStore(storage);
    await store.getState().init();
    expect(await store.getState().create("업무 노트")).toBe(true);
    expect(store.getState().workspace).toEqual({
      name: "업무 노트",
      path: "/memory/Documents/업무 노트",
      token: expect.any(Number),
    });
    await store.getState().loadRecent();
    expect(store.getState().recent.map((w) => [w.name, w.current])).toEqual([
      ["업무 노트", true],
      ["CetusNote", false],
    ]);
    await store.getState().switchTo("/memory/CetusNote");
    expect(store.getState().workspace?.path).toBe("/memory/CetusNote");
  });

  it("같은 이름·쓸 수 없는 이름·목록 밖 경로는 오류, 취소는 false", async () => {
    const storage = createMemoryStorage();
    const store = createWorkspaceStore(storage);
    await store.getState().create("업무");
    await expect(store.getState().create("업무")).rejects.toMatchObject({ code: "already_exists" });
    await expect(store.getState().create("a/b")).rejects.toMatchObject({ code: "invalid_path" });
    await expect(store.getState().switchTo("/elsewhere")).rejects.toMatchObject({
      code: "invalid_path",
    });
    expect(store.getState().busy).toBeNull();
    storage.createWorkspace = async () => null;
    expect(await store.getState().create("취소")).toBe(false);
  });
});

describe("표시용 도우미", () => {
  it("홈 폴더를 ~로 줄인다", () => {
    expect(shortenHome("/Users/me/Documents/CetusNote")).toBe("~/Documents/CetusNote");
    expect(shortenHome("/home/me/notes")).toBe("~/notes");
    expect(shortenHome("C:\\Users\\me\\Documents")).toBe("~\\Documents");
    expect(shortenHome("/Volumes/USB/notes")).toBe("/Volumes/USB/notes");
  });
  it("모르는 오류는 일반 문구", () => {
    expect(workspaceErrorMessage(new Error("x"))).toBe("폴더를 열지 못했어요. 다시 시도해 주세요.");
  });
  it("목록의 폴더가 사라졌으면 이름을 대고 목록에서 빼거나 다른 폴더를 열라고 한다", () => {
    expect(switchErrorMessage("notes", new StorageError("not_found", "x"))).toBe(
      "“notes” 폴더를 찾을 수 없어요. 목록에서 빼거나 다른 폴더를 열어 주세요.",
    );
    expect(switchErrorMessage("notes", new Error("x"))).toBe(
      "폴더를 열지 못했어요. 다시 시도해 주세요.",
    );
  });
});

describe("최근 목록에서 빼기 (SHELL-16)", () => {
  it("다른 워크스페이스는 목록에서 빠지고, 지금 열린 것은 빠지지 않는다", async () => {
    const storage = createMemoryStorage();
    const store = createWorkspaceStore(storage);
    await store.getState().init();
    const first = store.getState().workspace!.path;
    await store.getState().create("업무 노트");
    const second = store.getState().workspace!.path;
    await store.getState().switchTo(first);
    await store.getState().loadRecent();
    expect(store.getState().recent.map((w) => w.path)).toContain(second);

    await store.getState().forget(second);
    expect(store.getState().recent.map((w) => w.path)).not.toContain(second);
    await store.getState().loadRecent();
    expect(store.getState().recent.map((w) => w.path)).toEqual([first]);

    await expect(store.getState().forget(first)).rejects.toBeInstanceOf(StorageError);
    expect(store.getState().recent.map((w) => w.path)).toEqual([first]);
  });
});
