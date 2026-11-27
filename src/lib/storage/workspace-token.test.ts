import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { createTauriStorage } from "./tauri";
import { StorageError } from "./types";

const page = { id: "01JD0000000000000000000000", title: "t" } as never;
/** 마지막으로 보낸 커맨드의 인자 객체 (옵션 인자 유무와 무관하게 비교한다) */
const lastArgs = (cmd?: string) => {
  const calls = invoke.mock.calls.filter((c) => !cmd || c[0] === cmd);
  return calls[calls.length - 1]?.[1];
};

describe("워크스페이스 토큰 (DATA-03)", () => {
  beforeEach(() => invoke.mockReset());

  it("쓰기는 열린 워크스페이스의 토큰을 실어 보낸다", async () => {
    const s = createTauriStorage();
    invoke.mockResolvedValueOnce({ name: "a", path: "/a", token: 1 });
    await s.switchWorkspace("/a");
    invoke.mockResolvedValue(undefined);
    await s.writePage(page);
    expect(lastArgs("page_write")).toEqual({ page, wsToken: 1 });
  });

  it("폴더를 바꾸면 새 워크스페이스의 토큰을 쓴다", async () => {
    const s = createTauriStorage();
    invoke.mockResolvedValueOnce({ name: "a", path: "/a", token: 1 });
    await s.switchWorkspace("/a");
    invoke.mockResolvedValueOnce({ name: "b", path: "/b", token: 2 });
    await s.switchWorkspace("/b");
    invoke.mockResolvedValue(undefined);
    await s.purgePage("01JD0000000000000000000000");
    expect(lastArgs("page_purge")).toEqual({ id: "01JD0000000000000000000000", wsToken: 2 });
  });

  it("바꾸기 전에 보낸 쓰기는 옛 토큰을 그대로 가진다", async () => {
    const s = createTauriStorage();
    invoke.mockResolvedValueOnce({ name: "a", path: "/a", token: 1 });
    await s.switchWorkspace("/a");
    invoke.mockReturnValueOnce(new Promise(() => {})); // 진행 중인 쓰기
    void s.writePage(page);
    invoke.mockResolvedValueOnce({ name: "b", path: "/b", token: 2 });
    await s.switchWorkspace("/b");
    expect(lastArgs("page_write")).toEqual({
      page,
      wsToken: 1,
    });
  });

  it("stale_workspace 오류는 StorageError 코드로 그대로 전달된다", async () => {
    const s = createTauriStorage();
    invoke.mockResolvedValueOnce({ name: "a", path: "/a", token: 1 });
    await s.switchWorkspace("/a");
    invoke.mockRejectedValueOnce({ code: "stale_workspace", message: "x" });
    const err = await s.writePage(page).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StorageError);
    expect((err as StorageError).code).toBe("stale_workspace");
  });

  it("메인 창은 토큰이 없으면 묻지 않고 no_workspace로 거절한다 (전환 중 늦은 쓰기 막기)", async () => {
    const s = createTauriStorage();
    const err = await s.writePage(page).catch((e: unknown) => e);
    expect((err as StorageError).code).toBe("no_workspace");
    expect(invoke.mock.calls.map((c) => c[0])).toEqual([]);
  });

  it("휴지통·버전·메타 쓰기도 토큰을 싣는다", async () => {
    const s = createTauriStorage();
    invoke.mockResolvedValueOnce({ name: "a", path: "/a", token: 7 });
    await s.switchWorkspace("/a");
    invoke.mockResolvedValue(undefined);
    await s.writeWorkspace({} as never);
    await s.deleteVersions("p");
    await s.saveVersion(page);
    for (const cmd of ["workspace_write", "history_delete", "history_save"]) {
      expect(lastArgs(cmd)).toHaveProperty("wsToken", 7);
    }
  });

  it("토큰을 모르는 창(빠른 입력)은 쓰기 전에 현재 워크스페이스를 물어본다", async () => {
    // 빠른 입력 창은 워크스페이스를 열지 않아 토큰이 null이다 — 이때 쓰기가 실패하면 안 된다
    vi.stubGlobal("window", { location: { hash: "#/quick" } });
    const s = createTauriStorage();
    invoke.mockImplementation(async (cmd: string) =>
      cmd === "workspace_current" ? { workspace: { name: "a", path: "/a", token: 9 } } : undefined,
    );
    await s.appendQuickNote({ id: "n", text: "t", createdAt: "" } as never);
    vi.unstubAllGlobals();
    const cmds = invoke.mock.calls.map((c) => c[0]);
    expect(cmds).toEqual(["workspace_current", "quick_note_append"]);
    expect(lastArgs("quick_note_append")).toHaveProperty("wsToken", 9);
  });
});
