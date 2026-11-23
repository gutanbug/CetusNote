import { invoke } from "@tauri-apps/api/core";
import { normalizePage, normalizeWorkspace, SchemaError } from "./schema";
import {
  StorageError,
  type ExternalChanges,
  type LoadError,
  type LoadResult,
  type DocumentPick,
  type PdfText,
  type WorkspaceExportReport,
  type Page,
  type PageVersion,
  type Storage,
  type StorageErrorCode,
  type RecentWorkspace,
  type WorkspaceInfo,
  type WorkspaceStatus,
} from "./types";

/** Rust 커맨드 호출. Rust의 StorageError({ code, message })를 StorageError로 바꾼다. */
async function call<T>(
  command: string,
  args?: Record<string, unknown>,
  options?: { headers: Record<string, string> },
): Promise<T> {
  try {
    return await invoke<T>(command, args, options);
  } catch (e) {
    if (typeof e === "object" && e && "code" in e && "message" in e)
      throw new StorageError(e.code as StorageErrorCode, String(e.message));
    throw new StorageError("io", String(e));
  }
}

/** 실제 앱의 저장소 — src-tauri/src/commands.rs */
export function createTauriStorage(): Storage {
  return {
    workspaceStatus: () => call<WorkspaceStatus>("workspace_current"),
    pickWorkspace: () => call<WorkspaceInfo | null>("workspace_pick"),
    openDefaultWorkspace: () => call<WorkspaceInfo>("workspace_use_default"),
    recentWorkspaces: () => call<RecentWorkspace[]>("workspace_recent"),
    switchWorkspace: (path) => call<WorkspaceInfo>("workspace_switch", { path }),
    forgetWorkspace: (path) => call<void>("workspace_forget", { path }),
    createWorkspace: (name) => call<WorkspaceInfo | null>("workspace_create", { name }),
    async readWorkspace() {
      const [raw, status] = await Promise.all([
        call<unknown>("workspace_read"),
        call<WorkspaceStatus>("workspace_current"),
      ]);
      return normalizeWorkspace(raw, status.workspace?.name);
    },
    writeWorkspace: (value) => call("workspace_write", { value }),
    loadPages: async () => normalizeLoaded(await call("pages_load_all")),
    readPages: async (ids) => normalizeLoaded(await call("pages_read", { ids })),
    scanChanges: () => call<ExternalChanges>("workspace_scan"),
    writePage: (page) => call("page_write", { page }),
    purgePage: (id) => call("page_purge", { id }),
    saveVersion: async (page) => call<PageVersion>("history_save", { page }),
    listVersions: (pageId) => call<PageVersion[]>("history_list", { id: pageId }),
    readVersion: async (pageId, versionId) =>
      normalizePage(await call<unknown>("history_read", { id: pageId, version: versionId })),
    deleteVersions: (pageId) => call("history_delete", { id: pageId }),
    readSettings: () => call<Record<string, unknown> | null>("settings_read"),
    writeSettings: (value) => call("settings_write", { value }),
    setAppIcon: (theme) => call("app_icon_set", { theme }),
    exportMarkdown: (fileName, text) => call<string | null>("export_markdown", { fileName, text }),
    exportWorkspaceMarkdown: (manifest) =>
      call<WorkspaceExportReport | null>("workspace_export_markdown", { manifest }),
    revealWorkspaceExport: () => call("workspace_export_reveal"),
    pickDocuments: () => call<DocumentPick | null>("document_pick"),
    readDocumentBytes: async (id) =>
      new Uint8Array(await call<ArrayBuffer>("document_bytes", { id })),
    readPdfText: (id) => call<PdfText>("document_pdf_text", { id }),
    importDocumentImage: (pageId, dir, src) => call<string>("document_image", { pageId, dir, src }),
    // 바이트는 JSON 배열이 아니라 그대로 보낸다(큰 이미지도 빠르게)
    writeAsset: (pageId, bytes) =>
      call<string>("asset_write", bytes as unknown as Record<string, unknown>, {
        headers: { "x-page-id": pageId },
      }),
    readAsset: async (path) => new Uint8Array(await call<ArrayBuffer>("asset_read", { path })),
    pickAsset: (pageId) => call<string | null>("asset_pick", { pageId }),
    fetchAsset: (pageId, url, o) =>
      call<string>("asset_fetch", { pageId, url, publicOnly: o?.publicOnly ?? false }),
    exportBackup: (fileName, createdAt) =>
      call<string | null>("backup_export", { fileName, createdAt }),
    autoBackup: (today, createdAt) => call<string | null>("backup_auto", { today, createdAt }),
    listBackups: () => call<string[]>("backup_list"),
    revealBackups: () => call("backup_reveal"),
    restoreBackup: () => call<WorkspaceInfo | null>("backup_restore"),
    renderPdfPage: (run, index, rect) => call<void>("pdf_page", { run, index, rect }),
    finishPdf: (run, count) => call<number>("pdf_finish", { run, count }),
    renderPdfPreviewPage: (index, width) => call<ArrayBuffer>("pdf_preview_page", { index, width }),
    savePdf: (fileName) => call<string | null>("pdf_save", { fileName }),
    printPdfDocument: (run) => call<void>("pdf_print_document", { run }),
    readPdfExportBytes: () => call<ArrayBuffer>("pdf_export_bytes"),
  };
}

/** Rust가 준 페이지를 앱 형식으로. 형식이 맞지 않는 파일은 errors로 옮긴다 */
function normalizeLoaded(raw: { pages: unknown[]; errors: LoadError[] }): LoadResult {
  const pages: Page[] = [];
  const errors = [...raw.errors];
  for (const p of raw.pages) {
    try {
      pages.push(normalizePage(p));
    } catch (e) {
      if (!(e instanceof SchemaError)) throw e;
      const id = typeof p === "object" && p && "id" in p ? String(p.id) : "?";
      errors.push({ file: `${id}.json`, message: e.message });
    }
  }
  return { pages, errors };
}
