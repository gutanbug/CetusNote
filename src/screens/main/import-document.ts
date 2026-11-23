import { htmlToDoc, markdownToDoc, type ImageResolver } from "@/components/editor/markdown-import";
import { toast } from "@/components/ui/toast";
import { docxToHtml } from "@/features/import/docx";
import { readPdfTextWithPdfJs } from "@/features/pdf-js";
import { parseMarkdownFile } from "@/features/import/markdown";
import { importSummary, type ImportFailure } from "@/features/import/summary";
import { dataUrlBytes, pdfPagesToHtml, plainTextToHtml } from "@/features/import/text";
import { metaStore } from "@/features/meta";
import { pagesStore } from "@/features/pages";
import { sessionStore } from "@/features/session";
import {
  StorageError,
  type DocumentFile,
  type DocumentPick,
  type Page,
  type Storage,
} from "@/lib/storage";
import { currentPlatform } from "@/lib/platform-labels";
import { getStorage } from "@/lib/storage/default";
import { ancestors, createDocument, openPage } from "./actions";
import { askImportDestination } from "./import-destination";
import { nextTagColor } from "./tag-colors";
import type { JSONContent } from "@tiptap/core";

/**
 * 문서 가져오기 (DATA-08) — md·txt·html·docx·pdf 파일을 고르고, 어디에 넣을지 정한 뒤 파일마다 새 문서를 만든다.
 * 목적지는 맨 위(워크스페이스 최상위) 또는 고른 폴더·문서 아래. 취소하면 아무것도 가져오지 않는다.
 * 형식마다 글을 HTML·문서로 바꾸는 방법이 다르다(convertDocument). 상대 경로·안의 그림은 이 페이지 assets로 옮긴다.
 */
export async function importDocuments(storage: Storage = getStorage()): Promise<Page[]> {
  let pick;
  try {
    pick = await storage.pickDocuments();
  } catch {
    toast("문서를 읽지 못했어요");
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

type Converted = { title: string; icon: string | null; tags: string[]; content: JSONContent };

/** 파일 한 개 → 문서 내용. 읽지 못하면 throw (호출하는 쪽이 건너뛴다) */
export async function convertDocument(
  file: DocumentFile,
  resolve: ImageResolver,
  storage: Storage,
): Promise<Converted> {
  const text = file.text ?? "";
  switch (file.ext) {
    case "md":
    case "markdown": {
      const head = parseMarkdownFile(file.name, text);
      return {
        title: head.title,
        icon: head.icon,
        tags: head.tags,
        content: await markdownToDoc(head.body, resolve),
      };
    }
    case "txt":
      return fromHtml(plainTextToHtml(text), file.name, resolve);
    case "html":
    case "htm":
      return fromHtml(text, file.name, resolve);
    case "docx":
      return fromHtml(
        await docxToHtml(await storage.readDocumentBytes(file.id)),
        file.name,
        resolve,
      );
    case "pdf": {
      // macOS는 PDFKit, Windows·Linux는 pdf.js로 글자를 뽑는다 (SYS-08)
      const pdf =
        currentPlatform() === "mac"
          ? await storage.readPdfText(file.id)
          : await readPdfTextWithPdfJs(await storage.readDocumentBytes(file.id));
      return fromHtml(pdfPagesToHtml(pdf.pages), pdf.title ?? file.name, resolve);
    }
    default:
      throw new StorageError("unsupported", "지원하지 않는 형식이에요");
  }
}

/** HTML 글 → 문서. 제목은 HTML 제목(없으면 fallback) */
async function fromHtml(
  html: string,
  fallback: string,
  resolve: ImageResolver,
): Promise<Converted> {
  const { title, doc } = await htmlToDoc(html, resolve);
  return { title: title ?? fallback, icon: null, tags: [], content: doc };
}

/** 그림 한 개 옮기기: data URL은 바이트로 쓰고, 상대 경로는 고른 파일 폴더에서 읽는다 */
function imageResolver(file: DocumentFile, pageId: string, storage: Storage): ImageResolver {
  return (src) => {
    if (src.startsWith("data:")) return storage.writeAsset(pageId, dataUrlBytes(src));
    if (!file.dir) throw new StorageError("not_found", "폴더를 알 수 없어요");
    return storage.importDocumentImage(pageId, file.dir, src);
  };
}

/** 고른 파일들을 parentId 아래에 문서로 만든다 (파일 순서대로) */
export async function importPicked(
  pick: DocumentPick,
  parentId: string | null,
  storage: Storage,
): Promise<Page[]> {
  const made: Page[] = [];
  const failed: ImportFailure[] = pick.skipped.map((name) => ({ name, reason: "읽지 못했어요" }));
  const meta = metaStore.getState();
  let known = Object.keys(meta.meta?.tags ?? {}).length;
  for (const file of pick.files) {
    // 새 문서 기본 모양(본문 폭·글꼴)을 따르고, 내용을 채운 뒤에 연다
    const page = createDocument(parentId);
    try {
      const converted = await convertDocument(file, imageResolver(file, page.id, storage), storage);
      const latest = pagesStore.getState().pages[page.id]!;
      pagesStore.getState().update(page.id, {
        title: converted.title,
        icon: converted.icon,
        props: { ...latest.props, tags: converted.tags },
        content: converted.content as Page["content"],
      });
      for (const tag of converted.tags)
        if (!meta.meta?.tags[tag]) meta.setTagColor(tag, nextTagColor(known++));
      made.push(page);
    } catch (error) {
      // 만들다 만 문서는 휴지통을 거쳐 지운다(purge는 휴지통에 든 문서만 지운다)
      pagesStore.getState().trash(page.id);
      void pagesStore.getState().purge(page.id);
      failed.push({
        name: file.name,
        reason: error instanceof StorageError ? error.message : "읽지 못했어요",
      });
    }
  }
  // 가져온 문서가 보이도록 목적지 폴더·문서를 펼친다
  if (made.length && parentId)
    sessionStore.getState().expand(parentId, ...ancestors(parentId).map((p) => p.id));
  if (made[0]) openPage(made[0].id);
  const summary = importSummary(
    made.map((p) => pagesStore.getState().pages[p.id]?.title || "제목 없음"),
    failed,
  );
  if (summary)
    toast(summary.message, summary.description ? { description: summary.description } : undefined);
  return made;
}
