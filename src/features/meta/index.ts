import { getStorage } from "@/lib/storage/default";
import { useStore } from "zustand";
import { createMetaStore, type MetaState } from "./store";

export { createMetaStore, type MetaState, type MetaStore, type RemovedNote } from "./store";

export const metaStore = createMetaStore(getStorage());

export function useMeta<T>(select: (s: MetaState) => T): T {
  return useStore(metaStore, select);
}
