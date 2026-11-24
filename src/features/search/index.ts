import { pagesStore } from "@/features/pages";
import { summaryIndex } from "@/features/pages/summary";
import { connectSearchIndex } from "./connect";
import { createSearchIndex } from "./search-index";

export { connectSearchIndex } from "./connect";
export { createSearchIndex, normalize, type SearchIndex, type SearchResult } from "./search-index";

/** 앱 전체의 검색 인덱스. 페이지 스토어를 따라 늘 최신이다 */
export const searchIndex = createSearchIndex();
// 본문 한 번 읽기로 검색 색인과 본문 요약(백링크·할 일·그림)을 함께 채운다 (SYS-10)
connectSearchIndex(pagesStore, searchIndex, { summaries: summaryIndex });
