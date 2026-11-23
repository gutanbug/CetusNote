import type { PagesStore } from "@/features/pages";
import type { SearchIndex } from "./search-index";

/**
 * 페이지 스토어 → 검색 인덱스 (ADR-003). 지금 페이지로 한 번 만들고, 그 뒤로는 바뀐 페이지만 고친다.
 * 페이지 객체는 고칠 때마다 새로 만들어지므로(불변) 참조가 달라진 것만 다시 색인한다.
 * 반환값을 부르면 연결을 끊는다.
 */
export function connectSearchIndex(store: PagesStore, index: SearchIndex): () => void {
  let prev = store.getState().pages;
  index.build(Object.values(prev));
  return store.subscribe((state) => {
    const next = state.pages;
    if (next === prev) return;
    for (const [id, page] of Object.entries(next)) if (prev[id] !== page) index.upsert(page);
    for (const id of Object.keys(prev)) if (!(id in next)) index.remove(id);
    prev = next;
  });
}
