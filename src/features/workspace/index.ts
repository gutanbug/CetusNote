import { getStorage } from "@/lib/storage/default";
import { useStore } from "zustand";
import { createWorkspaceStore, type WorkspaceState } from "./store";
import { metaStore } from "@/features/meta";
import { pagesStore } from "@/features/pages";
import { sessionStore } from "@/features/session";
import { createWorkspaceWriteGuard } from "@/features/app/write-guard";

export {
  createWorkspaceStore,
  shortenHome,
  switchErrorMessage,
  UnsavedChangesError,
  workspaceErrorMessage,
  type WorkspacePhase,
  type WorkspaceState,
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
});

export function useWorkspace<T>(select: (s: WorkspaceState) => T): T {
  return useStore(workspaceStore, select);
}
