import { getStorage } from "@/lib/storage/default";
import { useStore } from "zustand";
import { createSessionStore, type SessionState } from "./store";

export {
  createSessionStore,
  DEFAULT_APPEARANCE,
  DEFAULT_EDITOR,
  type EditorPrefs,
  type AccentPref,
  type Appearance,
  type FontScale,
  type SessionState,
  type SessionStore,
  type StartScreen,
  type Tab,
  type ThemePref,
} from "./store";
export { readSplit, type SplitState } from "./split-state";
export {
  blockStartFor,
  clampSelection,
  isDefaultPosition,
  markJump,
  pickRestore,
  wasJumpedTo,
  ratioOf,
  scrollTopFor,
  type PagePosition,
  type PageSpot,
} from "./page-position";

/** 앱 전체의 화면 상태 */
export const sessionStore = createSessionStore(getStorage());

export function useSession<T>(select: (s: SessionState) => T): T {
  return useStore(sessionStore, select);
}
