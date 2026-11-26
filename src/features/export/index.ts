import type { Page, Storage } from "@/lib/storage";
import { getStorage } from "@/lib/storage/default";
import { pageAssets } from "./assets";
import { markdownFileName, pageToMarkdown } from "./markdown";
import { frontMatterPref } from "./prefs";

export { docToMarkdown, markdownFileName, pageToMarkdown, type MdNode } from "./markdown";

/**
 * 페이지를 Markdown 파일로 내보낸다 (DATA-04). 저장 대화상자에서 위치를 고른다.
 * 취소하면 null, 저장하면 파일 이름과 건너뛴 이미지 수. 이미지는 저장 위치 옆 `assets/`에 복사한다.
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
  // 페이지가 쓰는 이미지·첨부는 저장 위치 옆 assets/ 로 복사하고, 링크를 assets/<이름>으로 맞춘다
  const assets = pageAssets(page);
  const hrefs = new Map(assets.map((a) => [a.src, `assets/${a.name}`]));
  return storage.exportMarkdown(
    markdownFileName(page),
    pageToMarkdown(page, titleOf, path, {
      frontMatter,
      assetHref: (src) => hrefs.get(src) ?? src,
    }),
    assets,
  );
}
