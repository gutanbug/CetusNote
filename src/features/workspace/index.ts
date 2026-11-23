import { getStorage } from "@/lib/storage/default";
import { useStore } from "zustand";
import { createWorkspaceStore, type WorkspaceState } from "./store";

export {
  createWorkspaceStore,
  shortenHome,
  workspaceErrorMessage,
  type WorkspacePhase,
  type WorkspaceState,
  type WorkspaceStore,
} from "./store";

/** 앱 전체의 워크스페이스 상태 */
export const workspaceStore = createWorkspaceStore(getStorage());

export function useWorkspace<T>(select: (s: WorkspaceState) => T): T {
  return useStore(workspaceStore, select);
}
