import { getStorage } from "@/lib/storage/default";
import { useStore } from "zustand";
import { createPagesStore, type PagesState } from "./store";

export { assetOwner, assetRefs, replaceAssetRefs } from "./assets";
export { findBacklinks, type Backlink, type BacklinkSnippet } from "./backlinks";
export { planDrop, type DropPlan } from "./drop";
export { createSaveQueue, type SaveQueue, type SaveState } from "./save-queue";
export { createPagesStore, type PagesState, type PagesStore } from "./store";

/** 앱 전체의 페이지 상태 */
export const pagesStore = createPagesStore(getStorage());

export function usePages<T>(select: (s: PagesState) => T): T {
  return useStore(pagesStore, select);
}
