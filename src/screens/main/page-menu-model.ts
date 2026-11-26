import type { Page } from "@/lib/storage";

/** 페이지 메뉴에서 종류별로 보일 묶음 (PAGE-05 · DATA-13). 메뉴 JSX와 테스트가 같은 규칙을 쓴다 */
export function pageMenuSections(kind: Page["kind"]) {
  return {
    /** 본문 도구(복제·서식·내보내기 등)는 문서에만 */
    doc: kind === "page",
    /** CSV 내보내기는 컬렉션에만 */
    csv: kind === "collection",
  };
}
