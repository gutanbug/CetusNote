import { pagesStore } from "@/features/pages";
import { connectSearchIndex } from "./connect";
import { createSearchIndex } from "./search-index";

export { connectSearchIndex } from "./connect";
export { createSearchIndex, normalize, type SearchIndex, type SearchResult } from "./search-index";

/** 앱 전체의 검색 인덱스. 페이지 스토어를 따라 늘 최신이다 */
export const searchIndex = createSearchIndex();
connectSearchIndex(pagesStore, searchIndex);
