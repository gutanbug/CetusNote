import type { JSONContent } from "@tiptap/core";
import { htmlToDoc, markdownToDoc, type ImageResolver } from "@/components/editor/markdown-import";
import { toast } from "@/components/ui/toast";
import {
  appLabel,
  parseAppExport,
  type ImportAppId,
  type ParseOutcome,
} from "@/features/import/apps/pipeline";
import { remapMentions } from "@/features/import/apps/mentions";
import { decodeSafe, type ImportNode } from "@/features/import/apps/tree";
import { ENEX_READ_ERROR, convertEnexFile } from "@/features/import/apps/enex";
import { importSummary, type ImportFailure } from "@/features/import/summary";
import { metaStore } from "@/features/meta";
import { pagesStore } from "@/features/pages";
import { sessionStore } from "@/features/session";
import { nextTagColor } from "./tag-colors";
import { SOFT_COLORS } from "@/components/ui/tag-chip";
import { BUILTIN_NAMES, newFieldId, withValue } from "@/features/collection/model";
import { cellValue, type Column } from "@/features/import/apps/csv";
import { FIELDS_MAX } from "@/lib/storage/schema";
import {
  StorageError,
  type AppImportPick,
  type FieldDef,
  type FieldId,
  type Page,
  type Storage,
} from "@/lib/storage";
import { getStorage } from "@/lib/storage/default";
import { ancestors, createDocument, openPage } from "./actions";
import { askImportDestination } from "./import-destination";
import { msg } from "@/lib/i18n";

/**
 * 다른 앱에서 가져오기(DATA-11): 앱과 zip·폴더를 고른 뒤 목록을 만들고, DATA-08과 같은 「어디에 넣을까요?」에서
 * 목적지를 정한다. 목적지 아래에 「<앱>에서 가져옴」 묶음을 만들고 그 안에 문서를 넣는다. 취소하면 아무것도 가져오지 않는다.
 */
export async function importFromApp(
  app: ImportAppId,
  kind: "zip" | "folder" | "enex",
  storage: Storage = getStorage(),
): Promise<Page[]> {
  let pick: AppImportPick | null;
  let outcome: ParseOutcome;
  try {
    if (kind === "enex") {
      // Evernote: 노트북 파일(.enex)을 여러 개 고른다. 원본 목록 대신 파일 글을 그대로 변환한다
      const enex = await storage.pickEnexFiles();
      if (!enex) return [];
      // 파일을 한 개씩 읽고 바로 변환한다. 다른 파일의 글은 들고 있지 않는다 (DATA-15)
      const blobs = new Map<string, Uint8Array>();
      const nodes: Array<ReturnType<typeof convertEnexFile>["nodes"][number]> = [];
      const skipped = [...enex.skipped];
      let read = 0;
      for (const file of enex.files) {
        let text: string;
        try {
          text = await storage.readEnexFile(file.id);
        } catch {
          skipped.push(msg().settings.importApp.skippedRead(file.name));
          continue;
        }
        const part = convertEnexFile({ name: file.name, text }, file.id, blobs);
        nodes.push(...part.nodes);
        skipped.push(...part.skipped);
        if (part.read) read++;
      }
      outcome = {
        nodes,
        skipped,
        blobs,
        error: read || !enex.files.length ? null : ENEX_READ_ERROR,
      };
      pick = { texts: [], paths: [], skipped: [] };
    } else {
      pick = await storage.pickAppSource(kind);
      if (!pick) return [];
      outcome = parseAppExport(app, pick);
    }
  } catch (error) {
    toast(error instanceof StorageError ? error.message : msg().settings.importApp.readAllFail);
    return [];
  }
  if (outcome.error) {
    toast(outcome.error);
    return [];
  }
  if (!outcome.nodes.length) {
    toast(msg().settings.importApp.noDocs);
    return [];
  }
  const documents = outcome.nodes.filter((n) => n.kind === "page").length;
  const choice = await askImportDestination(documents);
  if (!choice) return [];
  return writeImport(app, outcome, pick, choice.parentId, storage);
}

/** 항목 목록을 페이지로 만든다. 1) 모양만 만들기 2) 내용 채우기 3) 페이지 멘션 연결 4) 요약 */
export async function writeImport(
  app: ImportAppId,
  outcome: ParseOutcome,
  pick: AppImportPick,
  parentId: string | null,
  storage: Storage,
): Promise<Page[]> {
  const paths = new Set(pick.paths);
  const failed: ImportFailure[] = outcome.skipped.map((name) => ({
    name,
    reason: msg().settings.importApp.readFail,
  }));
  const byKey = new Map(outcome.nodes.map((n) => [n.key, n]));
  const ids = new Map<string, string>();
  const shells: { node: ImportNode; page: Page }[] = [];

  // 묶음(컨테이너): 컬렉션 아래가 아니면 폴더(폴더는 문서 아래에도 둔다, SHELL-14). 컬렉션 아래면 문서
  const parent = parentId ? pagesStore.getState().pages[parentId] : undefined;
  const containerTitle = msg().settings.importApp.containerTitle(appLabel(app));
  const container =
    parent?.kind === "collection"
      ? createDocument(parentId)
      : pagesStore.getState().create({ kind: "folder", title: containerTitle, parentId });
  if (container.kind !== "folder")
    pagesStore.getState().update(container.id, { title: containerTitle });
  const containerId = container.id;

  // 1) 모양 만들기: 부모를 먼저 만든다
  const made = new Map<string, string>();
  /** 가져온 컬렉션: 속성 id와 열(레코드 값을 채울 때 쓴다) */
  const collections = new Map<string, { ids: FieldId[]; columns: Column[] }>();
  const ensure = (node: ImportNode): string => {
    const done = made.get(node.key);
    if (done) return done;
    const parentPage = node.parentKey ? byKey.get(node.parentKey) : undefined;
    const parentPageId = parentPage ? ensure(parentPage) : containerId;
    // 폴더·컬렉션은 컬렉션 아래가 아니면 둔다(맨 위·폴더·문서 아래). 컬렉션 아래는 문서(레코드)만
    const parentAccepts =
      parentPageId === containerId ? container.kind === "folder" : !isCollectionPage(parentPageId);
    const asFolder = node.kind === "folder" && parentAccepts;
    const asCollection = node.kind === "collection" && parentAccepts;
    const page = asFolder
      ? pagesStore.getState().create({ kind: "folder", title: node.title, parentId: parentPageId })
      : asCollection
        ? pagesStore
            .getState()
            .create({ kind: "collection", title: node.title, parentId: parentPageId })
        : createDocument(parentPageId);
    if (asCollection) collections.set(node.key, defineFields(page, node));
    if (!asFolder) pagesStore.getState().update(page.id, { title: node.title });
    made.set(node.key, page.id);
    ids.set(node.key, page.id);
    if (node.kind === "page") shells.push({ node, page: pagesStore.getState().pages[page.id]! });
    return page.id;
  };
  for (const node of outcome.nodes) ensure(node);

  // 2) 내용 채우기 (문서마다 쉬는 시간을 둬서 화면이 멈추지 않게 한다)
  const meta = metaStore.getState();
  let known = Object.keys(meta.meta?.tags ?? {}).length;
  let count = 0;
  const created: Page[] = [];
  for (const { node, page } of shells) {
    if (++count % 20 === 0) await new Promise((r) => setTimeout(r, 0));
    try {
      // 문서 폴더(끝에 / 포함): 그림의 상대 경로 기준
      const stem = node.key.slice(2);
      const dir = stem.includes("/") ? stem.slice(0, stem.lastIndexOf("/") + 1) : "";
      const resolve = imageResolver(page.id, dir, paths, storage, outcome.blobs);
      let doc: JSONContent;
      let title: string | null = null;
      if (node.format === "html") {
        const converted = await htmlToDoc(node.markdown, resolve);
        doc = converted.doc;
        title = converted.title;
      } else {
        doc = await markdownToDoc(node.markdown, resolve);
      }
      doc = await writeBlobAttachments(doc, outcome.blobs, page.id, storage);
      doc = remapMentions(doc, ids);
      const latest = pagesStore.getState().pages[page.id]!;
      pagesStore.getState().update(page.id, {
        title: title ?? node.title,
        props: valuesOf(node, { ...latest.props, tags: node.tags }, collections),
        content: doc as Page["content"],
      });
      if (node.createdAt || node.updatedAt)
        pagesStore
          .getState()
          .restoreTimes(page.id, { createdAt: node.createdAt, updatedAt: node.updatedAt });
      for (const tag of node.tags)
        if (!meta.meta?.tags[tag]) meta.setTagColor(tag, nextTagColor(known++));
      created.push(pagesStore.getState().pages[page.id]!);
    } catch (error) {
      // 내용을 못 채운 문서는 휴지통을 거쳐 지운다(purge는 휴지통에 든 문서만 지운다)
      pagesStore.getState().trash(page.id);
      void pagesStore.getState().purge(page.id);
      failed.push({
        name: node.title,
        reason: error instanceof StorageError ? error.message : msg().settings.importApp.readFail,
      });
    }
  }

  // 펼치기·열기 · 요약
  sessionStore
    .getState()
    .expand(...(parentId ? [parentId, ...ancestors(parentId).map((p) => p.id)] : []), containerId);
  if (created[0]) openPage(created[0].id);
  const summary = importSummary(
    created.map((p) => pagesStore.getState().pages[p.id]?.title || msg().settings.common.untitled),
    failed,
  );
  if (summary)
    toast(summary.message, summary.description ? { description: summary.description } : undefined);
  return created;
}

/** ENEX 첨부(`enex/<md5>` 경로)를 그 페이지 assets로 옮기고 경로를 바꾼다 */
async function writeBlobAttachments(
  node: JSONContent,
  blobs: Map<string, Uint8Array> | undefined,
  pageId: string,
  storage: Storage,
): Promise<JSONContent> {
  if (!blobs) return node;
  const path = node.attrs?.path;
  if (node.type === "attachment" && typeof path === "string" && blobs.has(path)) {
    const assetPath = await storage.writeAsset(pageId, blobs.get(path)!);
    node.attrs = { ...node.attrs, path: assetPath };
  }
  for (const child of node.content ?? []) await writeBlobAttachments(child, blobs, pageId, storage);
  return node;
}

/** 가져온 묶음에서 이 페이지가 폴더인지 */
function isCollectionPage(id: string): boolean {
  return pagesStore.getState().pages[id]?.kind === "collection";
}

/**
 * 그림 한 개 옮기기. src가 목록의 경로와 같으면 그대로, 아니면 문서 폴더 기준으로 찾는다.
 * 목록에 없으면 not_found(그림은 글 자리에 경로 글로 남는다).
 */
function imageResolver(
  pageId: string,
  dir: string,
  paths: Set<string>,
  storage: Storage,
  blobs?: Map<string, Uint8Array>,
): ImageResolver {
  return async (src) => {
    const rel = decodeSafe(src).replace(/^\.\//, "");
    // ENEX 리소스(메모리에 있는 바이트)가 먼저
    const blob = blobs?.get(rel);
    if (blob) return storage.writeAsset(pageId, blob);
    const path = paths.has(rel) ? rel : `${dir}${rel}`;
    if (!paths.has(path))
      throw new StorageError("not_found", msg().settings.importApp.imageMissing);
    return storage.writeAsset(pageId, await storage.readAppImportBytes(path));
  };
}

/** 컬렉션에 가져온 속성을 붙인다(기본 속성 뒤에). 이름이 겹치면 " 2"를 붙인다 */
function defineFields(page: Page, node: ImportNode): { ids: FieldId[]; columns: Column[] } {
  const base = page.collection;
  const columns = (node.columns ?? []).slice(0, FIELDS_MAX);
  if (!base || !columns.length) return { ids: [], columns: [] };
  const taken = new Set<string>(base.fields.map((f) => f.id));
  const names = new Set<string>(Object.values(BUILTIN_NAMES));
  const ids: FieldId[] = [];
  const defs: FieldDef[] = [];
  for (const col of columns) {
    const id = newFieldId(taken);
    taken.add(id);
    ids.push(id);
    let name = col.name;
    for (let n = 2; names.has(name); n++) name = `${col.name} ${n}`;
    names.add(name);
    defs.push({
      id,
      name,
      type: col.type,
      options: col.options.map((o, k) => ({
        name: o,
        color: SOFT_COLORS[k % SOFT_COLORS.length]!,
      })),
    });
  }
  pagesStore.getState().update(page.id, {
    collection: {
      ...base,
      fields: [...base.fields, ...defs],
      properties: [...base.properties, ...ids.map((key) => ({ key, hidden: false, card: false }))],
    },
  });
  return { ids, columns };
}

/** 레코드의 CSV 칸을 속성 값으로 넣는다. 컬렉션 밖이거나 칸이 없으면 그대로 */
function valuesOf(
  node: ImportNode,
  props: Page["props"],
  collections: Map<string, { ids: FieldId[]; columns: Column[] }>,
): Page["props"] {
  const info = node.parentKey ? collections.get(node.parentKey) : undefined;
  if (!info || !node.cells) return props;
  let out = props;
  info.columns.forEach((col, i) => {
    out = withValue(out, info.ids[i]!, cellValue(col, node.cells![i]));
  });
  return out;
}
