import { getStorage } from "@/lib/storage/default";
import { useStore } from "zustand";
import { createPagesStore, type PagesState } from "./store";

export { assetOwner, assetRefs, replaceAssetRefs } from "./assets";
export {
  inheritedBodyWidth,
  layoutWithWidth,
  resolveBodyWidth,
  type ResolvedWidth,
  type WidthNode,
} from "./body-width";
export { findBacklinks, type Backlink, type BacklinkSnippet } from "./backlinks";
export { planDrop, type DropPlan } from "./drop";
export { createSaveQueue, type SaveQueue, type SaveState } from "./save-queue";
export { createPagesStore, type PageMeta, type PagesState, type PagesStore } from "./store";
export { onKeptExternal } from "./kept-external";

/** 앱 전체의 페이지 상태 */
export const pagesStore = createPagesStore(getStorage());

export function usePages<T>(select: (s: PagesState) => T): T {
  return useStore(pagesStore, select);
}

const NO_PAGES: PagesState["pages"] = Object.freeze({});

/**
 * 열려 있는 동안만 전체 페이지 맵을 구독한다 (SYS-11). 닫혀 있으면 늘 같은 빈 맵을 돌려줘
 * 본문을 칠 때마다 늘 그려 둔 대화상자·보기가 다시 그려지지 않는다.
 */
export function usePagesWhile(active: boolean): PagesState["pages"] {
  return useStore(pagesStore, (s) => (active ? s.pages : NO_PAGES));
}
