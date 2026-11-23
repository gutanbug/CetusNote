import { markdownToDoc } from "@/components/editor/markdown-import";
import { toast } from "@/components/ui/toast";
import { parseMarkdownFile } from "@/features/import/markdown";
import { metaStore } from "@/features/meta";
import { pagesStore } from "@/features/pages";
import { sessionStore } from "@/features/session";
import type { Page, Storage } from "@/lib/storage";
import { getStorage } from "@/lib/storage/default";
import { ancestors, createDocument, openPage } from "./actions";
import { askImportDestination } from "./import-destination";
import { nextTagColor } from "./tag-colors";

type MarkdownPick = NonNullable<Awaited<ReturnType<Storage["pickMarkdown"]>>>;

/**
 * Markdown 가져오기 (DATA-08) — .md 파일을 고르고, 어디에 넣을지 정한 뒤 파일마다 새 문서를 만든다.
 * 목적지는 맨 위(워크스페이스 최상위) 또는 고른 폴더·문서 아래. 취소하면 아무것도 가져오지 않는다.
 * 제목·아이콘·태그는 front matter와 맨 앞 H1에서, 본문은 붙여넣기와 같은 변환으로.
 * 상대 경로 이미지는 그 파일 폴더 안에 있으면 이 페이지 assets로 복사한다. 첫 문서를 연다.
 */
export async function importMarkdown(storage: Storage = getStorage()): Promise<Page[]> {
  let pick;
  try {
    pick = await storage.pickMarkdown();
  } catch {
    toast("Markdown 파일을 읽지 못했어요");
    return [];
  }
  if (!pick) return [];
  let parentId: string | null = null;
  if (pick.files.length) {
    const choice = await askImportDestination(pick.files.length);
    if (!choice) return [];
    parentId = choice.parentId;
  }
  return importPicked(pick, parentId, storage);
}

/** 고른 파일들을 parentId 아래에 문서로 만든다 (파일 순서대로) */
export async function importPicked(
  pick: MarkdownPick,
  parentId: string | null,
  storage: Storage,
): Promise<Page[]> {
  const made: Page[] = [];
  const failed = [...pick.skipped];
  const meta = metaStore.getState();
  let known = Object.keys(meta.meta?.tags ?? {}).length;
  for (const file of pick.files) {
    const head = parseMarkdownFile(file.name, file.text);
    // 새 문서 기본 모양(본문 폭·글꼴)을 따르고, 내용을 채운 뒤에 연다
    const page = createDocument(parentId);
    try {
      const content = await markdownToDoc(
        head.body,
        file.dir ? (src) => storage.importMarkdownImage(page.id, file.dir, src) : undefined,
      );
      const latest = pagesStore.getState().pages[page.id]!;
      pagesStore.getState().update(page.id, {
        title: head.title,
        icon: head.icon,
        props: { ...latest.props, tags: head.tags },
        content: content as Page["content"],
      });
      for (const tag of head.tags)
        if (!meta.meta?.tags[tag]) meta.setTagColor(tag, nextTagColor(known++));
      made.push(page);
    } catch {
      void pagesStore.getState().purge(page.id);
      failed.push(file.name);
    }
  }
  // 가져온 문서가 보이도록 목적지 폴더·문서를 펼친다
  if (made.length && parentId)
    sessionStore.getState().expand(parentId, ...ancestors(parentId).map((p) => p.id));
  if (made[0]) openPage(made[0].id);
  if (made.length)
    toast(
      made.length === 1
        ? `“${titleOf(made[0]!)}” 문서를 가져왔어요`
        : `문서 ${made.length}개를 가져왔어요`,
      failed.length ? { description: `가져오지 못한 파일: ${failed.join(", ")}` } : undefined,
    );
  else if (failed.length)
    toast("Markdown 파일을 가져오지 못했어요", { description: failed.join(", ") });
  return made;
}

const titleOf = (p: Page) => pagesStore.getState().pages[p.id]?.title || "제목 없음";
