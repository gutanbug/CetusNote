import type { AttachmentPickKind, AttachmentSource } from "@/components/editor/attachment";
import type { ImageSource } from "@/components/editor/image";
import {
  attachmentErrorMessage,
  attachmentSrc,
  importAttachmentFile,
  openAttachment,
  pickAttachmentFile,
  revealAttachment,
  saveAttachmentAs,
  toPick,
} from "@/features/attachments";
import { attachmentKind, type AttachmentKind } from "@/lib/attachments/limits";
import type { BreadcrumbSource } from "@/components/editor/breadcrumb-block";
import type { SubpageRef, SubpageSource } from "@/components/editor/subpage-block";
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
import { pagesStore, usePages, type PageMeta } from "@/features/pages";
import { searchIndex } from "@/features/search";
import { useSession } from "@/features/session";
import type { Page } from "@/lib/storage";
import { openLink } from "@/lib/storage/open-link";
import * as React from "react";
import { crumbsOf, displayTitle, openPageLink } from "./actions";
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

/** 파일 첨부 (EDIT-31~33) — 고르기·끌어 놓기 저장·열기·Finder·다른 이름으로 저장. 실패 안내는 여기서 띄운다 */
export function usePageAttachments(pageId: string): AttachmentSource {
  return React.useMemo<AttachmentSource>(() => {
    const failed = (e: unknown, kind?: AttachmentKind) => {
      toast.error(attachmentErrorMessage(e, kind));
      return null;
    };
    // 고르기 종류 → 안내에 쓸 첨부 종류 (영상·소리는 종류가 둘이라 video 문구)
    const kindOf = (k: AttachmentPickKind): AttachmentKind =>
      k === "pdf" ? "pdf" : k === "media" ? "video" : "file";
    return {
      resolve: (path) => attachmentSrc(path),
      pick: (kind) =>
        pickAttachmentFile(pageId, kind).then(
          (info) => (info ? toPick(info) : null),
          (e: unknown) => failed(e, kindOf(kind)),
        ),
      importFile: (file) =>
        importAttachmentFile(pageId, file).then(toPick, (e: unknown) =>
          failed(e, attachmentKind(file.name, file.type)),
        ),
      open: (path) => void openAttachment(path).catch((e: unknown) => failed(e)),
      reveal: (path) => void revealAttachment(path).catch((e: unknown) => failed(e)),
      saveAs: (path) => void saveAttachmentAs(path).catch((e: unknown) => failed(e)),
    };
  }, [pageId]);
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

/**
 * 하위 페이지 블록 (EDIT-29) — 제목·아이콘·지워짐·휴지통을 구조(structure)에서 읽는다.
 * 구조가 바뀌면(이름·휴지통·이동) 새 값으로 다시 그린다.
 */
export function usePageSubpages(): SubpageSource {
  const all = usePages((s) => s.structure);
  return React.useMemo<SubpageSource>(
    () => ({
      resolvePage: (id) => subpageRefOf(all, id),
      onOpen: (id, o) =>
        o.newTab && resolveMention(all, id) ? openInNewTab(id) : openPageLink(id),
    }),
    [all],
  );
}

/** 하위 페이지 블록이 보는 상태 (EDIT-29). 휴지통(조상 포함)·폴더는 열 수 없어 trashed로 본다 */
export function subpageRefOf(all: Record<string, PageMeta>, id: string): SubpageRef {
  const p = all[id];
  if (!p) return { title: "", exists: false, trashed: false };
  return {
    title: displayTitle(p),
    icon: p.icon,
    exists: true,
    trashed: resolveMention(all, id) === null,
  };
}

/** 경로 표시 블록 (EDIT-30) — 이 노트 페이지의 경로. 이름이 바뀌면 다시 그린다 */
export function usePageBreadcrumb(pageId: string): BreadcrumbSource {
  const all = usePages((s) => s.structure);
  return React.useMemo<BreadcrumbSource>(
    () => ({
      currentPageId: pageId,
      resolvePath: (id) => crumbsOf(id, all),
      onOpen: (id) => openPageLink(id),
    }),
    [all, pageId],
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
