import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { normalizePage, normalizeWorkspace, SchemaError } from "./schema";
import {
  StorageError,
  type ExternalChanges,
  type LoadError,
  type LoadResult,
  type AppImportPick,
  type EnexPick,
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
  type AttachmentInfo,
  type MarkdownExportResult,
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
  /** 지금 열린 워크스페이스의 토큰 (DATA-03). 워크스페이스를 열거나 확인할 때마다 갱신한다 */
  let token: number | null = null;
  const rememberInfo = (info: WorkspaceInfo | null): WorkspaceInfo | null => {
    if (info) token = info.token;
    return info;
  };
  const rememberStatus = (status: WorkspaceStatus): WorkspaceStatus => {
    token = status.workspace ? status.workspace.token : null;
    return status;
  };
  /**
   * 쓰기 커맨드 호출. 토큰은 호출하는 순간의 값을 싣는다. 그래서 폴더를 바꾸기 전에 보낸 쓰기는
   * 옛 토큰을 가지고 가고, Rust가 바뀐 뒤 도착한 것으로 거절한다.
   */
  const writeCall = async <T>(
    command: string,
    args: Record<string, unknown> = {},
    options?: { headers: Record<string, string> },
  ) => {
    if (token === null) throw new StorageError("no_workspace", "워크스페이스가 열려 있지 않아요");
    return call<T>(command, { ...args, wsToken: token }, options);
  };
  return {
    workspaceStatus: async () => rememberStatus(await call<WorkspaceStatus>("workspace_current")),
    pickWorkspace: async () => rememberInfo(await call<WorkspaceInfo | null>("workspace_pick")),
    openDefaultWorkspace: async () =>
      rememberInfo(await call<WorkspaceInfo>("workspace_use_default")) as WorkspaceInfo,
    recentWorkspaces: () => call<RecentWorkspace[]>("workspace_recent"),
    switchWorkspace: async (path) =>
      rememberInfo(await call<WorkspaceInfo>("workspace_switch", { path })) as WorkspaceInfo,
    forgetWorkspace: (path) => call<void>("workspace_forget", { path }),
    createWorkspace: async (name) =>
      rememberInfo(await call<WorkspaceInfo | null>("workspace_create", { name })),
    async readWorkspace() {
      const [raw, status] = await Promise.all([
        call<unknown>("workspace_read"),
        call<WorkspaceStatus>("workspace_current").then(rememberStatus),
      ]);
      return normalizeWorkspace(raw, status.workspace?.name);
    },
    writeWorkspace: (value) => writeCall("workspace_write", { value }),
    loadPages: async () => normalizeLoaded(await call("pages_load_all")),
    loadPageMeta: async () => normalizeLoaded(await call("pages_load_meta")),
    readPages: async (ids) => normalizeLoaded(await call("pages_read", { ids })),
    scanChanges: () => call<ExternalChanges>("workspace_scan"),
    writePage: (page) => writeCall<boolean>("page_write", { page }),
    purgePage: (id) => writeCall("page_purge", { id }),
    saveVersion: async (page) => writeCall<PageVersion>("history_save", { page }),
    listVersions: (pageId) => call<PageVersion[]>("history_list", { id: pageId }),
    readVersion: async (pageId, versionId) =>
      normalizePage(await call<unknown>("history_read", { id: pageId, version: versionId })),
    deleteVersions: (pageId) => writeCall("history_delete", { id: pageId }),
    readSettings: () => call<Record<string, unknown> | null>("settings_read"),
    writeSettings: (value) => call("settings_write", { value }),
    setAppIcon: (theme) => call("app_icon_set", { theme }),
    appExecutablePath: () => call<string>("app_executable_path"),
    exportCsv: (fileName, text) => call<string | null>("export_csv", { fileName, text }),
    exportMarkdown: (fileName, text, assets = []) =>
      call<MarkdownExportResult | null>("export_markdown", { fileName, text, assets }),
    exportWorkspaceMarkdown: (manifest) =>
      call<WorkspaceExportReport | null>("workspace_export_markdown", { manifest }),
    revealWorkspaceExport: () => call("workspace_export_reveal"),
    pickDocuments: () => call<DocumentPick | null>("document_pick"),
    readDocumentBytes: async (id) =>
      new Uint8Array(await call<ArrayBuffer>("document_bytes", { id })),
    readPdfText: (id) => call<PdfText>("document_pdf_text", { id }),
    pickAppSource: (kind) => call<AppImportPick | null>("app_import_pick", { kind }),
    pickEnexFiles: () => call<EnexPick | null>("app_import_enex_pick"),
    readAppImportBytes: async (path) =>
      new Uint8Array(await call<ArrayBuffer>("app_import_bytes", { path })),
    importDocumentImage: (pageId, dir, src) => call<string>("document_image", { pageId, dir, src }),
    // 바이트는 JSON 배열이 아니라 그대로 보낸다(큰 이미지도 빠르게)
    writeAsset: (pageId, bytes) => {
      if (token === null)
        return Promise.reject(new StorageError("no_workspace", "워크스페이스가 열려 있지 않아요"));
      return call<string>("asset_write", bytes as unknown as Record<string, unknown>, {
        headers: { "x-page-id": pageId, "x-workspace-token": String(token) },
      });
    },
    readAsset: async (path) => new Uint8Array(await call<ArrayBuffer>("asset_read", { path })),
    pickAsset: (pageId) => call<string | null>("asset_pick", { pageId }),
    pickFile: (pageId, o) =>
      writeCall<AttachmentInfo | null>("asset_pick_file", { pageId, kind: o?.kind ?? null }),
    importFile: (pageId, path, o) =>
      writeCall<AttachmentInfo>("asset_import_file", { pageId, path, kind: o?.kind ?? null }),
    // 바이트는 그대로 보내고, 이름·종류는 헤더로 싣는다(이름은 비ASCII라 퍼센트 인코딩)
    importAttachmentBytes: (pageId, file, o) => {
      if (token === null)
        return Promise.reject(new StorageError("no_workspace", "워크스페이스가 열려 있지 않아요"));
      return call<AttachmentInfo>(
        "asset_import_bytes",
        file.bytes as unknown as Record<string, unknown>,
        {
          headers: {
            "x-page-id": pageId,
            "x-workspace-token": String(token),
            "x-file-name": encodeURIComponent(file.name),
            "x-kind": o?.kind ?? "",
          },
        },
      );
    },
    revealAsset: (path) => call<void>("asset_reveal", { path }),
    openAsset: (path) => call<void>("asset_open", { path }),
    saveAssetAs: (path) => call<string | null>("asset_save_as", { path }),
    // Rust가 절대 경로를 돌려주고, 웹뷰 주소로 바꾼다(워크스페이스 assets만 열려 있다)
    resolveAssetSrc: async (path) => convertFileSrc(await call<string>("asset_src_path", { path })),
    fetchAsset: (pageId, url, o) =>
      call<string>("asset_fetch", { pageId, url, publicOnly: o?.publicOnly ?? false }),
    exportBackup: (fileName, createdAt) =>
      call<string | null>("backup_export", { fileName, createdAt }),
    autoBackup: (today, createdAt) => call<string | null>("backup_auto", { today, createdAt }),
    listBackups: () => call<string[]>("backup_list"),
    revealBackups: () => call("backup_reveal"),
    restoreBackup: async () => rememberInfo(await call<WorkspaceInfo | null>("backup_restore")),
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
