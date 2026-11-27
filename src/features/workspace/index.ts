import { getStorage } from "@/lib/storage/default";
import { useStore } from "zustand";
import { createWorkspaceStore, type WorkspaceState } from "./store";
import { metaStore } from "@/features/meta";
import { pagesStore } from "@/features/pages";
import { sessionStore } from "@/features/session";
import { remindersStore } from "@/features/reminders";
import { createWorkspaceWriteGuard } from "@/features/app/write-guard";

export {
  createWorkspaceStore,
  shortenHome,
  switchErrorMessage,
  UnsavedChangesError,
  workspaceErrorMessage,
  type WorkspacePhase,
  type WorkspaceState,
  type UnsavedSwitch,
  type WorkspaceStore,
} from "./store";
export { advanceWorkspaceGeneration, currentWorkspaceGeneration } from "./generation";

/** 앱 전체의 워크스페이스 상태. 바꾸기 전에 남은 저장을 끝낸다 (DATA-03) */
export const workspaceStore = createWorkspaceStore(getStorage(), {
  beforeChange: createWorkspaceWriteGuard({
    pages: pagesStore,
    session: sessionStore,
    meta: metaStore,
  }),
  // 알림 쓰기를 옛 워크스페이스에 마친 뒤 비운다 (SYS-16). 실패해도 전환은 계속한다
  beforeSwitch: () =>
    remindersStore
      .getState()
      .reset()
      .catch(() => undefined),
});

export function useWorkspace<T>(select: (s: WorkspaceState) => T): T {
  return useStore(workspaceStore, select);
}
