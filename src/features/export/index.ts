import type { Page, Storage } from "@/lib/storage";
import { getStorage } from "@/lib/storage/default";
import { pageAssets } from "./assets";
import { collectionRecords, collectionToCsv } from "./csv";
import { markdownFileName, pageToMarkdown } from "./markdown";
import { capUtf8Bytes } from "@/lib/utf8-cap";
import { frontMatterPref } from "./prefs";

export { collectionRecords, collectionToCsv } from "./csv";
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

/**
 * 컬렉션을 CSV 파일로 내보낸다 (DATA-13). 레코드는 전부 내보내고(필터·정렬 무시), 저장 대화상자에서 위치를 고른다.
 * 취소하면 null, 저장하면 파일 이름과 레코드 수.
 */
export async function exportCollectionCsv(
  collection: Page,
  all: Readonly<Record<string, Page>>,
  { storage = getStorage() }: { storage?: Storage } = {},
): Promise<{ name: string; records: number } | null> {
  const records = collectionRecords(collection.id, all);
  const name = await storage.exportCsv(
    `${sanitizeCsvName(collection.title)}.csv`,
    collectionToCsv(collection, records),
  );
  return name ? { name, records: records.length } : null;
}

/** 파일 이름에 못 쓰는 글자를 빼고 상한 안으로 줄인다 */
function sanitizeCsvName(title: string): string {
  const base = capUtf8Bytes(
    title
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+/, ""),
    200,
  ).trim();
  return base || "컬렉션";
}
