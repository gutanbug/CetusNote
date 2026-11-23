import {
  StorageError,
  type RecentWorkspace,
  type Storage,
  type WorkspaceInfo,
} from "@/lib/storage";
import { createStore } from "zustand/vanilla";

/**
 * 워크스페이스 열기 흐름 (DATA-03).
 * loading → (열린 폴더가 있으면) ready / (없으면) setup → 폴더를 고르면 ready
 */
export type WorkspacePhase = "loading" | "setup" | "ready";

export type WorkspaceState = {
  phase: WorkspacePhase;
  workspace: WorkspaceInfo | null;
  /** 첫 실행 화면에 보여 줄 기본 위치(표시용, 홈 폴더는 ~로 줄임) */
  defaultLabel: string | null;
  /** 지난번 폴더가 없어졌을 때 그 경로(표시용) */
  missingPath: string | null;
  busy: "default" | "pick" | "restore" | null;
  error: string | null;
  init(): Promise<void>;
  openDefault(): Promise<void>;
  pick(): Promise<void>;
  /** 최근 워크스페이스 (SHELL-15) */
  recent: RecentWorkspace[];
  loadRecent(): Promise<void>;
  /** 최근 목록의 워크스페이스로 바꾼다. 실패하면 오류를 던진다(부르는 쪽이 알린다) */
  switchTo(path: string): Promise<void>;
  /** 최근 목록에서 뺀다 (SHELL-16) — 화면 목록에서 먼저 빼고, 실패하면 다시 읽고 오류를 던진다 */
  forget(path: string): Promise<void>;
  /** 새 워크스페이스 — 위치를 고르고 만들어 연다. 취소하면 false. 실패하면 오류를 던진다 */
  create(name: string): Promise<boolean>;
  /** 백업을 새 폴더에 풀고 그 폴더를 연다 (DATA-05). 실패하면 오류를 던진다(부르는 쪽이 알린다) */
  restore(): Promise<boolean>;
};

/** 홈 폴더를 ~로 줄인다 (표시용). macOS·Linux·Windows */
export function shortenHome(path: string): string {
  return path.replace(/^\/(?:Users|home)\/[^/]+/, "~").replace(/^[A-Za-z]:\\Users\\[^\\]+/, "~");
}

/** 저장 오류 → 화면 문구(해요체) */
export function workspaceErrorMessage(e: unknown): string {
  const code = e instanceof StorageError ? e.code : "io";
  switch (code) {
    case "permission_denied":
      return "이 폴더에는 쓸 수 없어요. 다른 폴더를 골라 주세요.";
    case "disk_full":
      return "디스크 공간이 부족해요. 공간을 확보한 뒤 다시 시도해 주세요.";
    case "not_found":
      return "폴더를 찾을 수 없어요. 다른 폴더를 골라 주세요.";
    case "already_exists":
      return "그 위치에 같은 이름의 폴더가 이미 있어요. 다른 이름이나 위치를 골라 주세요.";
    case "invalid_path":
      return "폴더 이름으로 쓸 수 없는 이름이에요. / \\ : 와 맨 앞 점(.)은 빼 주세요.";
    default:
      return "폴더를 열지 못했어요. 다시 시도해 주세요.";
  }
}

export function createWorkspaceStore(storage: Storage) {
  return createStore<WorkspaceState>()((set, get) => {
    const open = async (busy: "default" | "pick", run: () => Promise<WorkspaceInfo | null>) => {
      if (get().busy) return;
      set({ busy, error: null });
      try {
        const workspace = await run();
        // 대화상자를 취소하면 그대로 첫 실행 화면에 머문다
        set(
          workspace ? { workspace, phase: "ready", missingPath: null, busy: null } : { busy: null },
        );
      } catch (e) {
        set({ busy: null, error: workspaceErrorMessage(e) });
      }
    };

    return {
      phase: "loading",
      workspace: null,
      defaultLabel: null,
      missingPath: null,
      busy: null,
      error: null,
      async init() {
        try {
          const status = await storage.workspaceStatus();
          set({
            phase: status.workspace ? "ready" : "setup",
            workspace: status.workspace,
            defaultLabel: status.defaultPath && shortenHome(status.defaultPath),
            missingPath: status.missingPath && shortenHome(status.missingPath),
          });
        } catch (e) {
          // 지난 폴더를 다시 열다 실패해도(권한 등) 첫 실행 화면에서 다른 폴더를 고를 수 있게 한다
          set({ phase: "setup", error: workspaceErrorMessage(e) });
        }
      },
      recent: [],
      async loadRecent() {
        try {
          set({ recent: await storage.recentWorkspaces() });
        } catch {
          set({ recent: [] });
        }
      },
      async forget(path) {
        set({ recent: get().recent.filter((w) => w.path !== path) });
        try {
          await storage.forgetWorkspace(path);
        } catch (e) {
          await get().loadRecent();
          throw e;
        }
      },
      async switchTo(path) {
        if (get().busy || get().workspace?.path === path) return;
        set({ busy: "pick" });
        try {
          const workspace = await storage.switchWorkspace(path);
          set({ workspace, phase: "ready", missingPath: null, busy: null });
        } catch (e) {
          set({ busy: null });
          throw e;
        }
      },
      async create(name) {
        if (get().busy) return false;
        set({ busy: "pick" });
        try {
          const workspace = await storage.createWorkspace(name);
          set(
            workspace
              ? { workspace, phase: "ready", missingPath: null, busy: null }
              : { busy: null },
          );
          return !!workspace;
        } catch (e) {
          set({ busy: null });
          throw e;
        }
      },
      openDefault: () => open("default", () => storage.openDefaultWorkspace()),
      pick: () => open("pick", () => storage.pickWorkspace()),
      async restore() {
        if (get().busy) return false;
        set({ busy: "restore" });
        try {
          const workspace = await storage.restoreBackup();
          set(
            workspace
              ? { workspace, phase: "ready", missingPath: null, busy: null }
              : { busy: null },
          );
          return !!workspace;
        } catch (e) {
          set({ busy: null });
          throw e;
        }
      },
    };
  });
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;
