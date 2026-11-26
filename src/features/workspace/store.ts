import {
  StorageError,
  type RecentWorkspace,
  type Storage,
  type WorkspaceInfo,
} from "@/lib/storage";
import { createStore } from "zustand/vanilla";
import { advanceWorkspaceGeneration } from "./generation";

/** 워크스페이스를 바꾸기 전에 남은 저장을 끝내지 못했을 때 (DATA-03). 폴더는 바꾸지 않았다 */
export class UnsavedChangesError extends Error {
  constructor() {
    super("저장하지 못한 변경이 있어서 폴더를 바꾸지 않았어요");
    this.name = "UnsavedChangesError";
  }
}

export type WorkspaceStoreOptions = {
  /** 워크스페이스를 바꾸기 전에 호출한다. false면 바꾸지 않고 UnsavedChangesError로 알린다 (DATA-03) */
  beforeChange?: () => Promise<boolean>;
};

/**
 * 워크스페이스 열기 흐름 (DATA-03).
 * loading → (열린 폴더가 있으면) ready / (없으면) setup → 폴더를 고르면 ready
 */
export type WorkspacePhase = "loading" | "setup" | "ready";

/** 저장하지 못해 폴더를 바꾸지 못했을 때 대화상자가 고를 선택지 (DATA-03, 앱 닫기와 같은 흐름) */
export type UnsavedSwitch = {
  /** 다시 저장을 시도하고, 저장이 되면 바꾼다 */
  retry(): Promise<void>;
  /** 저장하지 않고 바꾼다. 대기 중인 변경은 버린다 */
  discard(): Promise<void>;
  /** 폴더를 바꾸지 않고 닫는다 */
  cancel(): void;
};

export type WorkspaceState = {
  phase: WorkspacePhase;
  /** 저장하지 못한 변경 때문에 멈춘 폴더 바꾸기. null이면 대화상자를 띄우지 않는다 */
  unsaved: UnsavedSwitch | null;
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
  if (e instanceof UnsavedChangesError) {
    return "저장하지 못한 변경이 있어서 폴더를 바꾸지 않았어요. 잠시 뒤 다시 시도해 주세요.";
  }
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
    case "locked":
      return "다른 Cetus Note 창이 이 폴더를 쓰고 있어요. 그 창을 닫은 뒤 다시 열어 주세요.";
    case "invalid_path":
      return "폴더 이름으로 쓸 수 없는 이름이에요. / \\ : 와 맨 앞 점(.)은 빼 주세요.";
    default:
      return "폴더를 열지 못했어요. 다시 시도해 주세요.";
  }
}

/**
 * 목록의 워크스페이스로 바꾸다 실패했을 때 (SYS-09/SHELL-15). 폴더가 사라졌으면 이름을 대고 고칠 길을 알려 준다.
 */
export function switchErrorMessage(name: string, e: unknown): string {
  if (e instanceof StorageError && e.code === "not_found") {
    return `“${name}” 폴더를 찾을 수 없어요. 목록에서 빼거나 다른 폴더를 열어 주세요.`;
  }
  return workspaceErrorMessage(e);
}

export function createWorkspaceStore(
  storage: Storage,
  { beforeChange }: WorkspaceStoreOptions = {},
) {
  return createStore<WorkspaceState>()((set, get) => {
    /** `change`가 저장을 끝내지 못해 바꾸지 않았을 때 돌려주는 값 */
    const UNSAVED = Symbol("unsaved");

    /**
     * 폴더를 바꾸는 공통 흐름 (DATA-03). 바꾸기 전에 남은 저장을 끝낸다.
     * 끝내지 못하면 바꾸지 않고 `unsaved`로 대화상자를 띄운다(다시 시도 · 저장하지 않고 진행 · 취소).
     * 실패하면 던진다. 부르는 쪽이 오류 문구를 정한다.
     */
    const change = async (
      busy: NonNullable<WorkspaceState["busy"]>,
      run: () => Promise<WorkspaceInfo | null>,
      skipSave = false,
    ): Promise<WorkspaceInfo | null | typeof UNSAVED> => {
      set({ busy, error: null, unsaved: null });
      try {
        if (!skipSave && beforeChange && !(await beforeChange())) {
          set({ busy: null, unsaved: unsavedChoices(busy, run) });
          return UNSAVED;
        }
        const workspace = await run();
        // 대화상자를 취소하면 그대로 머문다
        if (workspace) advanceWorkspaceGeneration();
        set(
          workspace ? { workspace, phase: "ready", missingPath: null, busy: null } : { busy: null },
        );
        return workspace;
      } catch (e) {
        set({ busy: null });
        throw e;
      }
    };

    /** 대화상자 선택지: 다시 시도는 저장 검사를 다시 하고, 저장하지 않고 진행은 검사를 건너뛴다 */
    const unsavedChoices = (
      busy: NonNullable<WorkspaceState["busy"]>,
      run: () => Promise<WorkspaceInfo | null>,
    ): UnsavedSwitch => {
      const again = (skipSave: boolean) => async () => {
        try {
          await change(busy, run, skipSave);
        } catch (e) {
          set({ error: workspaceErrorMessage(e) });
        }
      };
      return {
        retry: again(false),
        discard: again(true),
        cancel: () => set({ unsaved: null }),
      };
    };

    const open = async (busy: "default" | "pick", run: () => Promise<WorkspaceInfo | null>) => {
      if (get().busy) return;
      try {
        await change(busy, run);
      } catch (e) {
        set({ busy: null, error: workspaceErrorMessage(e) });
      }
    };

    return {
      phase: "loading",
      workspace: null,
      unsaved: null,
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
        // 저장하지 못하면 대화상자(unsaved)가 이어서 묻는다. 여기서는 던지지 않는다
        await change("pick", () => storage.switchWorkspace(path));
      },
      async create(name) {
        if (get().busy) return false;
        const workspace = await change("pick", () => storage.createWorkspace(name));
        return workspace !== UNSAVED && !!workspace;
      },
      openDefault: () => open("default", () => storage.openDefaultWorkspace()),
      pick: () => open("pick", () => storage.pickWorkspace()),
      async restore() {
        if (get().busy) return false;
        const workspace = await change("restore", () => storage.restoreBackup());
        return workspace !== UNSAVED && !!workspace;
      },
    };
  });
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;
