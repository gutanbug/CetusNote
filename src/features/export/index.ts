import type { Page, Storage } from "@/lib/storage";
import { getStorage } from "@/lib/storage/default";
import { markdownFileName, pageToMarkdown } from "./markdown";
import { frontMatterPref } from "./prefs";

export { docToMarkdown, markdownFileName, pageToMarkdown, type MdNode } from "./markdown";

/**
 * 페이지를 Markdown 파일로 내보낸다 (DATA-04). 저장 대화상자에서 위치를 고른다.
 * 취소하면 null, 저장하면 파일 이름.
 */
export function exportPageMarkdown(
  page: Page,
  {
    storage = getStorage(),
    titleOf,
    path,
    frontMatter = frontMatterPref(),
  }: {
    storage?: Storage;
    titleOf?: (id: string) => string | undefined;
    path?: string[];
    /** front matter(id·tags·날짜) 포함 여부. 기본은 기억한 값 (DATA-04) */
    frontMatter?: boolean;
  } = {},
) {
  return storage.exportMarkdown(
    markdownFileName(page),
    pageToMarkdown(page, titleOf, path, { frontMatter }),
  );
}
