import { msg } from "@/lib/i18n";
import type { Page } from "@/lib/storage";

/**
 * 화면에 보이는 이름 — 제목이 비면 종류별 이름(트리·탭·브레드크럼·검색·멘션이 모두 이것을 쓴다).
 * 순수 함수라 모델 파일에서도 바로 import한다.
 */
export function displayTitle(p: Pick<Page, "title" | "kind">): string {
  return (
    p.title ||
    (p.kind === "folder"
      ? msg().features.pages.untitledFolder
      : p.kind === "collection"
        ? msg().features.pages.untitledCollection
        : msg().features.untitled)
  );
}
