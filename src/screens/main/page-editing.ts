import type { ImageSource } from "@/components/editor/image";
import { PAGE_LINK_PREFIX, type MentionSource } from "@/components/editor/page-mention";
import type { PageTag } from "@/components/page/properties";
import { toast } from "@/components/ui/toast";
import {
  assetErrorMessage,
  assetUrl,
  fetchImage,
  pickImage,
  saveImageFile,
} from "@/features/assets";
import { metaStore, useMeta } from "@/features/meta";
import { pagesStore, usePages } from "@/features/pages";
import { searchIndex } from "@/features/search";
import { useSession } from "@/features/session";
import type { Page } from "@/lib/storage";
import { openLink } from "@/lib/storage/open-link";
import * as React from "react";
import { openPageLink } from "./actions";
import { resolveMention, searchMentions } from "./mention-model";
import { nextTagColor, tagColor } from "./tag-colors";
import { openInNewTab } from "./tabs";

/**
 * 페이지 본문 편집에 드는 연결 — 페이지 화면(PageView)과 레코드 상세(COLL-05)가 함께 쓴다.
 */

/** 이미지 (EDIT-14) — 에디터는 경로만 알고, 읽기·저장·고르기는 이 함수들로 */
export function usePageImages(pageId: string): ImageSource {
  return React.useMemo<ImageSource>(
    () => ({
      load: (src) => assetUrl(src),
      upload: (file) =>
        saveImageFile(pageId, file).catch((e: unknown) => {
          toast.error(assetErrorMessage(e));
          throw e;
        }),
      // 붙여 넣은 웹 이미지 — 실패하면 에디터가 링크로 남기고 한 번 알린다
      // 웹 글 속 주소라 내부망(루프백·사설)은 거절한다
      fetch: (url) => fetchImage(pageId, url, undefined, { publicOnly: true }),
      pick: () =>
        pickImage(pageId).catch((e: unknown) => {
          toast.error(assetErrorMessage(e));
          return null;
        }),
    }),
    [pageId],
  );
}

/** 페이지 멘션 (EDIT-13) — 에디터는 이 함수들로 찾고 제목을 읽고 연다 */
export function usePageMentions(pageId: string): MentionSource {
  const all = usePages((s) => s.pages);
  const recent = useSession((s) => s.recent);
  return React.useMemo<MentionSource>(
    () => ({
      search: (q) =>
        searchMentions(all, q, {
          exceptId: pageId,
          recent,
          rankTitles: (query) =>
            searchIndex
              .search(query)
              .filter((r) => r.matchIn === "title")
              .map((r) => r.id),
        }),
      resolve: (id) => resolveMention(all, id),
      onOpen: (id, o) =>
        o?.newTab && resolveMention(all, id) ? openInNewTab(id) : openPageLink(id),
    }),
    [all, pageId, recent],
  );
}

/** 본문 링크 열기: 페이지 링크는 앱 안에서, 나머지는 브라우저로 */
export function openEditorLink(href: string) {
  if (href.startsWith(PAGE_LINK_PREFIX)) openPageLink(href.slice(PAGE_LINK_PREFIX.length));
  else void openLink(href);
}

/** 태그 (SHELL-07) — 워크스페이스의 모든 태그, 이 페이지 태그(색 포함), 붙이기 */
export function usePageTags(page: Page) {
  const all = usePages((s) => s.structure);
  const tagColors = useMeta((s) => s.meta?.tags);
  // 워크스페이스의 모든 태그: workspace.json의 색 목록 + 페이지에 붙은 이름(색 없이 남은 것 포함)
  const allTags = React.useMemo(() => {
    const out: Record<string, string> = { ...tagColors };
    for (const p of Object.values(all)) for (const t of p.props.tags) out[t] ??= "gray";
    return out;
  }, [all, tagColors]);
  const tags: PageTag[] = page.props.tags.map((name) => ({
    id: name,
    name,
    color: tagColor(tagColors?.[name]),
  }));
  return { allTags, tags };
}

/** 페이지에 태그 붙이기 — 처음 쓰는 태그면 다음 색을 정해 둔다 */
export function addTag(pageId: string, name: string) {
  const page = pagesStore.getState().pages[pageId];
  if (!page || page.props.tags.includes(name)) return;
  const colors = metaStore.getState().meta?.tags;
  if (!colors?.[name])
    metaStore.getState().setTagColor(name, nextTagColor(Object.keys(colors ?? {}).length));
  pagesStore
    .getState()
    .update(pageId, { props: { ...page.props, tags: [...page.props.tags, name] } });
}

export function removeTag(pageId: string, name: string) {
  const page = pagesStore.getState().pages[pageId];
  if (!page) return;
  pagesStore
    .getState()
    .update(pageId, { props: { ...page.props, tags: page.props.tags.filter((t) => t !== name) } });
}
