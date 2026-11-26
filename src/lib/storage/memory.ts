import { normalizePage, normalizeWorkspace } from "./schema";
import {
  attachmentKind,
  limitFor,
  oversizeMessage,
  type AttachmentKind,
} from "../attachments/limits";
import {
  StorageError,
  type AttachmentInfo,
  type AttachmentPickKind,
  type DocumentFile,
  type AppImportPick,
  type EnexPick,
  type DocumentPick,
  type Page,
  type Storage,
  type WorkspaceInfo,
  type WorkspaceMeta,
} from "./types";
import { isValidId, ulid } from "./ulid";

type MemoryOptions = {
  pages?: Page[];
  workspace?: Partial<WorkspaceMeta>;
  /** null이면 첫 실행 상태(워크스페이스 없음) */
  info?: Omit<WorkspaceInfo, "token"> | null;
  /** 지난 폴더가 없어진 상태 흉내 */
  missingPath?: string;
  /** 폴더 선택 대화상자 결과 흉내 */
  pickResult?: Omit<WorkspaceInfo, "token"> | null;
  /** 저장 실패 흉내 — 이 함수가 오류를 돌려주면 writePage가 실패한다 */
  failWrite?: (page: Page) => StorageError | undefined;
  /** 바깥 변경 흉내 — true를 돌려주면 writePage가 「바깥 내용을 버전 기록에 남겼다」고 알린다 (DATA-07) */
  keepsExternal?: (page: Page) => boolean;
  /** 이미지 선택 대화상자 결과 흉내 — 바이트를 주면 그 이미지를 넣은 것으로 */
  pickAsset?: () => Uint8Array | null;
  /** 문서 고르기 대화상자 결과 흉내 (없으면 브라우저 파일 선택) */
  pickDocuments?: () => DocumentPick | null;
  /** 다른 앱에서 가져오기 고르기 결과 흉내. 없으면 unsupported (브라우저에서는 zip·폴더를 읽지 못한다) */
  pickAppSource?: (kind: "zip" | "folder") => AppImportPick | null;
  pickEnexFiles?: () => EnexPick | null;
  /** 다른 앱 가져오기 항목 바이트 (경로 → 바이트) */
  appImportBytes?: Record<string, Uint8Array>;
  /** 가져올 상대 경로 이미지 (dir/src → 바이트). 없으면 not_found */
  importImages?: Record<string, Uint8Array>;
  /** fetchAsset이 부르는 fetch (테스트용) */
  fetchAsset?: (url: string) => Promise<Response>;
  /** 파일 첨부 고르기 결과 흉내. 없으면 브라우저 파일 선택 */
  pickAttachment?: (
    kind: AttachmentPickKind,
  ) => { name: string; bytes: Uint8Array; mime?: string } | null;
  /** importFile이 읽을 파일 (끌어 놓기 경로 → 이름·바이트). 없으면 not_found */
  importAttachments?: Record<string, { name: string; bytes: Uint8Array; mime?: string }>;
  /** 처음부터 있는 이미지 (경로 → 바이트) */
  assets?: Record<string, Uint8Array>;
  /** 백업 불러오기 결과 흉내 (기본: 취소) */
  restoreResult?: Omit<WorkspaceInfo, "token"> | null;
  /** 처음부터 있는 자동 백업 이름 */
  backups?: string[];
};

/** 내용 앞 바이트로 이미지 종류 판별 (src-tauri storage::sniff_image와 같은 규칙) */
export function sniffImage(b: Uint8Array): string | null {
  const at = (i: number, s: string) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (at(0, "\x89PNG\r\n\x1a\n")) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (at(0, "GIF87a") || at(0, "GIF89a")) return "gif";
  if (at(0, "RIFF") && at(8, "WEBP")) return "webp";
  if (at(4, "ftyp") && (at(8, "avif") || at(8, "avis"))) return "avif";
  return null;
}

const ASSET_MAX_BYTES = 25 * 1024 * 1024;
/** 페이지마다 남기는 버전 수 (src-tauri storage::history::HISTORY_KEEP과 같다) */
export const HISTORY_KEEP = 50;

/** UTC 밀리초 → 버전 이름 `YYYYMMDDTHHMMSSmmmZ` (Rust version_name과 같은 형식) */
export function versionName(ms: number): string {
  const d = new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}${p(d.getUTCMilliseconds(), 3)}Z`;
}

/** 본문의 글자 수: 모든 text 노드의 글자 합 (Rust char_count와 같은 규칙) */
export function contentChars(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((n, v) => n + contentChars(v), 0);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const own = typeof o.text === "string" ? [...o.text].length : 0;
    return own + Object.values(o).reduce<number>((n, v) => n + contentChars(v), 0);
  }
  return 0;
}
const ASSET_PATH = /^assets\/([0-9A-HJKMNP-TV-Z]{26})\/([A-Za-z0-9_-][A-Za-z0-9._-]{0,99})$/;

/**
 * 스토리·테스트용 메모리 저장소. Rust 커맨드와 같은 규칙을 따른다
 * (id 검사, 휴지통 밖 페이지 영구 삭제 거부, 워크스페이스 없으면 no_workspace).
 * 값은 복사해서 보관한다 — 호출한 쪽이 객체를 고쳐도 저장된 값은 바뀌지 않는다.
 */
export function createMemoryStorage(options: MemoryOptions = {}): Storage & {
  /** 테스트에서 저장된 내용을 확인할 때 */
  snapshot(): {
    pages: Page[];
    workspace: WorkspaceMeta | null;
    exports: { fileName: string; text: string }[];
  };
  /** 바깥(다른 앱)에서 파일을 바꾼 것처럼 (DATA-07 테스트·스토리) */
  external(change: { pages?: Page[]; removed?: string[]; workspace?: WorkspaceMeta }): void;
} {
  const clone = <T>(v: T): T => structuredClone(v);
  /** 워크스페이스를 열 때마다 새 토큰을 준다 (DATA-03). 메모리 구현도 Rust와 같은 규칙을 따른다 */
  let tokenSeq = 0;
  let info: WorkspaceInfo | null = null;
  {
    const first =
      options.info === undefined ? { name: "CetusNote", path: "/memory/CetusNote" } : options.info;
    if (first) info = { ...first, token: ++tokenSeq };
  }
  const pages = new Map((options.pages ?? []).map((p) => [p.id, clone(p)]));
  let workspace: WorkspaceMeta | null = options.workspace
    ? normalizeWorkspace(options.workspace)
    : null;
  let settings: Record<string, unknown> | null = null;
  const exports: { fileName: string; text: string }[] = [];
  /** 버전 기록: 페이지 id → 오래된 것부터 */
  const history = new Map<string, { id: string; savedAt: string; page: Page }[]>();
  /** 바깥 변경 — scanChanges가 돌려주고 비운다 */
  const outside = { changed: new Set<string>(), removed: new Set<string>(), meta: false };
  /** 자동 백업 이름(오래된 것이 앞) */
  const backups = [...(options.backups ?? [])].sort();
  const assets = new Map(Object.entries(options.assets ?? {}));
  /** 문서 가져오기로 고른 파일(번호 → 파일) — readDocumentBytes가 읽는다 */
  const picked = new Map<string, File>();
  let assetSeq = 0;
  /** 파일 첨부의 원래 이름·형식 (경로 → 값). 바이트는 assets 맵에 있다 */
  const attachmentMeta = new Map<string, { name: string; mime: string }>();
  const attachmentUrls = new Map<string, string>();
  const storeAttachment = (
    pageId: string,
    picked: { name: string; bytes: Uint8Array; mime?: string },
    kind: AttachmentPickKind,
  ) => storeAttachmentImpl(pageId, picked, kind, assets, attachmentMeta);

  /** 최근 워크스페이스(맨 앞이 최근). 메모리 구현은 열 때마다 앞에 둔다 */
  const recent: WorkspaceInfo[] = info ? [{ ...info }] : [];
  const open = (w: Omit<WorkspaceInfo, "token">): WorkspaceInfo => {
    info = { ...w, token: ++tokenSeq };
    const i = recent.findIndex((x) => x.path === w.path);
    if (i >= 0) recent.splice(i, 1);
    recent.unshift({ ...info });
    return { ...info };
  };

  const need = () => {
    if (!info) throw new StorageError("no_workspace", "워크스페이스가 열려 있지 않아요");
  };

  return {
    async workspaceStatus() {
      return {
        workspace: info && { ...info },
        missingPath: info ? null : (options.missingPath ?? null),
        defaultPath: "/memory/Documents/CetusNote",
      };
    },
    async openDefaultWorkspace() {
      return open({ name: "CetusNote", path: "/memory/Documents/CetusNote" });
    },
    async recentWorkspaces() {
      return recent.map((w) => ({ ...w, current: w.path === info?.path }));
    },
    async switchWorkspace(path) {
      const w = recent.find((x) => x.path === path);
      if (!w) throw new StorageError("invalid_path", "최근 목록에 없는 폴더예요");
      return open({ name: w.name, path: w.path });
    },
    async forgetWorkspace(path) {
      if (path === info?.path)
        throw new StorageError("invalid_path", "지금 열린 워크스페이스는 목록에서 뺄 수 없어요");
      const i = recent.findIndex((x) => x.path === path);
      if (i >= 0) recent.splice(i, 1);
    },
    async createWorkspace(name) {
      const trimmed = name.trim();
      if (!trimmed || /[/\\:]/.test(trimmed) || trimmed.startsWith("."))
        throw new StorageError("invalid_path", "폴더 이름으로 쓸 수 없는 이름이에요");
      const path = `/memory/Documents/${trimmed}`;
      if (recent.some((w) => w.path === path))
        throw new StorageError("already_exists", "같은 이름의 폴더가 이미 있어요");
      return open({ name: trimmed, path });
    },
    async pickWorkspace() {
      const picked =
        options.pickResult === undefined
          ? { name: "CetusNote", path: "/memory/CetusNote" }
          : options.pickResult;
      return picked && open({ ...picked });
    },
    async readWorkspace() {
      need();
      return normalizeWorkspace(workspace, info!.name);
    },
    async writeWorkspace(meta) {
      need();
      workspace = clone(meta);
    },
    async loadPageMeta() {
      need();
      return {
        pages: [...pages.values()].map((p) => {
          const meta = clone(p);
          delete (meta as Partial<Page>).content;
          return normalizePage(meta);
        }),
        errors: [],
      };
    },
    async loadPages() {
      need();
      return { pages: [...pages.values()].map((p) => normalizePage(clone(p))), errors: [] };
    },
    async writePage(page) {
      need();
      if (!isValidId(page.id)) throw new StorageError("invalid_id", `잘못된 페이지 id: ${page.id}`);
      const failure = options.failWrite?.(page);
      if (failure) throw failure;
      const kept = options.keepsExternal?.(page) ?? false;
      pages.set(page.id, clone(page));
      return kept;
    },
    async purgePage(id) {
      need();
      if (!isValidId(id)) throw new StorageError("invalid_id", `잘못된 페이지 id: ${id}`);
      const page = pages.get(id);
      if (!page) throw new StorageError("not_found", `페이지 없음: ${id}`);
      if (!page.trashedAt)
        throw new StorageError("not_trashed", "휴지통에 있는 페이지만 영구 삭제할 수 있어요");
      pages.delete(id);
      for (const path of assets.keys()) if (path.startsWith(`assets/${id}/`)) assets.delete(path);
      for (const path of attachmentMeta.keys())
        if (path.startsWith(`assets/${id}/`)) attachmentMeta.delete(path);
      history.delete(id);
    },
    async saveVersion(page) {
      need();
      if (!isValidId(page.id)) throw new StorageError("invalid_id", `잘못된 페이지 id: ${page.id}`);
      const list = history.get(page.id) ?? [];
      let ms = Date.now();
      // 같은 밀리초에 또 쓰면 한 밀리초씩 밀어 이름을 비운다
      while (list.some((v) => v.id === versionName(ms))) ms += 1;
      const copy = clone(page);
      const id = versionName(ms);
      const savedAt = new Date(ms).toISOString();
      list.push({ id, savedAt, page: copy });
      list.splice(0, Math.max(0, list.length - HISTORY_KEEP));
      history.set(page.id, list);
      const size = new TextEncoder().encode(JSON.stringify(copy, null, 2)).length + 1;
      return { id, savedAt, size, chars: contentChars(copy.content) };
    },
    async listVersions(pageId) {
      need();
      if (!isValidId(pageId)) throw new StorageError("invalid_id", `잘못된 페이지 id: ${pageId}`);
      return [...(history.get(pageId) ?? [])].reverse().map((v) => ({
        id: v.id,
        savedAt: v.savedAt,
        size: new TextEncoder().encode(JSON.stringify(v.page, null, 2)).length + 1,
        chars: contentChars(v.page.content),
      }));
    },
    async readVersion(pageId, versionId) {
      need();
      if (!isValidId(pageId)) throw new StorageError("invalid_id", `잘못된 페이지 id: ${pageId}`);
      if (!/^[0-9]{8}T[0-9]{9}Z$/.test(versionId))
        throw new StorageError("invalid_version", `잘못된 버전 이름: ${versionId}`);
      const found = (history.get(pageId) ?? []).find((v) => v.id === versionId);
      if (!found) throw new StorageError("not_found", `버전 없음: ${versionId}`);
      return normalizePage(clone(found.page));
    },
    async deleteVersions(pageId) {
      need();
      if (!isValidId(pageId)) throw new StorageError("invalid_id", `잘못된 페이지 id: ${pageId}`);
      history.delete(pageId);
    },
    async writeAsset(pageId, bytes) {
      need();
      if (!isValidId(pageId)) throw new StorageError("invalid_id", `잘못된 페이지 id: ${pageId}`);
      if (bytes.length > ASSET_MAX_BYTES)
        throw new StorageError("too_large", "이미지가 25MB보다 커요");
      const ext = sniffImage(bytes);
      if (!ext)
        throw new StorageError("unsupported_image", "PNG·JPEG·GIF·WebP·AVIF만 넣을 수 있어요");
      const path = `assets/${pageId}/img-${Date.now()}-${assetSeq++}.${ext}`;
      assets.set(path, bytes.slice());
      return path;
    },
    async readAsset(path) {
      need();
      if (!ASSET_PATH.test(path))
        throw new StorageError("invalid_asset", `잘못된 이미지 경로: ${path}`);
      const bytes = assets.get(path);
      if (!bytes) throw new StorageError("not_found", `이미지 없음: ${path}`);
      return bytes.slice();
    },
    async pickAsset(pageId) {
      const bytes = options.pickAsset ? options.pickAsset() : await pickFile();
      return bytes ? this.writeAsset(pageId, bytes) : null;
    },
    async pickFile(pageId, o) {
      need();
      const kind = o?.kind ?? "file";
      const picked = options.pickAttachment
        ? options.pickAttachment(kind)
        : await pickAttachmentFile(kind);
      return picked ? storeAttachment(pageId, picked, kind) : null;
    },
    async importAttachmentBytes(pageId, file, o) {
      need();
      return storeAttachment(pageId, file, o?.kind ?? "file");
    },
    async importFile(pageId, path, o) {
      need();
      const src = options.importAttachments?.[path];
      if (!src) throw new StorageError("not_found", `파일이 없어요: ${path}`);
      return storeAttachment(pageId, src, o?.kind ?? "file");
    },
    async revealAsset() {
      throw new StorageError("unsupported", "브라우저 미리보기에서는 Finder에서 보여 줄 수 없어요");
    },
    async openAsset() {
      throw new StorageError("unsupported", "브라우저 미리보기에서는 기본 앱으로 열 수 없어요");
    },
    async saveAssetAs(path) {
      need();
      const bytes = assets.get(path);
      const meta = attachmentMeta.get(path);
      if (!bytes || !meta) throw new StorageError("not_found", `파일 없음: ${path}`);
      if (typeof document === "undefined")
        throw new StorageError("unsupported", "저장 대화상자를 쓸 수 없어요");
      const url = URL.createObjectURL(new Blob([bytes.slice()], { type: meta.mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      return meta.name;
    },
    async resolveAssetSrc(path) {
      need();
      const bytes = assets.get(path);
      const meta = attachmentMeta.get(path);
      if (!bytes || !meta) throw new StorageError("not_found", `파일 없음: ${path}`);
      let url = attachmentUrls.get(path);
      if (!url) {
        url = URL.createObjectURL(new Blob([bytes.slice()], { type: meta.mime }));
        attachmentUrls.set(path, url);
      }
      return url;
    },
    async fetchAsset(pageId, url) {
      if (!/^https?:\/\//i.test(url))
        throw new StorageError("fetch_failed", "http·https 링크만 가져올 수 있어요");
      let bytes: Uint8Array;
      try {
        const res = options.fetchAsset ? await options.fetchAsset(url) : await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        bytes = new Uint8Array(await res.arrayBuffer());
      } catch (e) {
        throw new StorageError("fetch_failed", e instanceof Error ? e.message : String(e));
      }
      return this.writeAsset(pageId, bytes);
    },
    async readSettings() {
      return settings && clone(settings);
    },
    async writeSettings(next) {
      settings = clone(next);
    },
    async setAppIcon() {
      // 브라우저 미리보기에는 Dock·창 아이콘이 없다
    },
    async appExecutablePath() {
      // 브라우저 미리보기에는 실행 파일이 없다. 명령을 보여 주기만 하도록 예시 경로를 준다
      return "/Applications/CetusNote.app/Contents/MacOS/cetusnote";
    },
    async exportCsv(fileName, text) {
      exports.push({ fileName, text });
      return fileName;
    },
    async exportMarkdown(fileName, text) {
      exports.push({ fileName, text });
      return { name: fileName, skipped: 0 };
    },
    async exportWorkspaceMarkdown(manifest) {
      // 브라우저 미리보기: 대화상자 대신 목록을 JSON 파일로 내려받는다(글·이미지 경로 확인용)
      const written = manifest.files.filter((f) => "text" in f).length;
      if (typeof document !== "undefined") {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `${manifest.rootName}.manifest.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      return { folder: manifest.rootName, failed: [], written };
    },
    async revealWorkspaceExport() {},
    async exportBackup(fileName) {
      need();
      return fileName;
    },
    async autoBackup(today) {
      need();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(today))
        throw new StorageError("invalid_date", `잘못된 날짜: ${today}`);
      const name = `CetusNote-${today}.zip`;
      if (backups.includes(name)) return null;
      backups.push(name);
      backups.sort();
      backups.splice(0, Math.max(0, backups.length - 7));
      return name;
    },
    async listBackups() {
      return [...backups].reverse();
    },
    async revealBackups() {},
    async restoreBackup() {
      const picked = options.restoreResult ?? null;
      return picked && open(picked);
    },
    async pickDocuments() {
      if (options.pickDocuments) return options.pickDocuments();
      return pickDocumentFiles(picked);
    },
    async readDocumentBytes(id) {
      const file = picked.get(id);
      if (!file) throw new StorageError("not_found", "가져올 파일을 찾지 못했어요");
      return new Uint8Array(await file.arrayBuffer());
    },
    async pickAppSource(kind) {
      if (options.pickAppSource) return options.pickAppSource(kind);
      throw new StorageError(
        "unsupported",
        "데스크톱 앱에서만 다른 앱의 내보내기를 가져올 수 있어요",
      );
    },
    async pickEnexFiles() {
      if (options.pickEnexFiles) return options.pickEnexFiles();
      throw new StorageError(
        "unsupported",
        "데스크톱 앱에서만 Evernote 내보내기를 가져올 수 있어요",
      );
    },
    async readAppImportBytes(path) {
      const bytes = options.appImportBytes?.[path];
      if (!bytes) throw new StorageError("not_found", "가져올 파일을 찾지 못했어요");
      return bytes;
    },
    async readPdfText() {
      throw new StorageError("unsupported", "데스크톱 앱에서만 PDF를 가져올 수 있어요");
    },
    async importDocumentImage(pageId, dir, src) {
      const bytes = options.importImages?.[`${dir}/${src}`];
      if (!bytes) throw new StorageError("not_found", "이미지 파일이 없어요");
      return this.writeAsset(pageId, bytes);
    },
    async renderPdfPage() {
      // PDF는 데스크톱 앱(WKWebView 인쇄 엔진)에서만 만든다
      throw new StorageError("unsupported", "PDF는 데스크톱 앱에서만 만들 수 있어요");
    },
    async finishPdf() {
      throw new StorageError("unsupported", "PDF는 데스크톱 앱에서만 만들 수 있어요");
    },
    async renderPdfPreviewPage() {
      throw new StorageError("unsupported", "PDF는 데스크톱 앱에서만 만들 수 있어요");
    },
    async savePdf() {
      throw new StorageError("unsupported", "PDF는 데스크톱 앱에서만 저장할 수 있어요");
    },
    async printPdfDocument() {
      throw new StorageError("unsupported", "PDF는 데스크톱 앱에서만 만들 수 있어요");
    },
    async readPdfExportBytes() {
      throw new StorageError("unsupported", "PDF는 데스크톱 앱에서만 만들 수 있어요");
    },
    async scanChanges() {
      need();
      const out = {
        changed: [...outside.changed].sort(),
        removed: [...outside.removed].sort(),
        meta: outside.meta,
      };
      outside.changed.clear();
      outside.removed.clear();
      outside.meta = false;
      return out;
    },
    async readPages(ids) {
      need();
      return {
        pages: ids.flatMap((id) => {
          const p = pages.get(id);
          return p ? [normalizePage(clone(p))] : [];
        }),
        errors: [],
      };
    },
    external(change) {
      for (const p of change.pages ?? []) {
        pages.set(p.id, clone(p));
        outside.changed.add(p.id);
        outside.removed.delete(p.id);
      }
      for (const id of change.removed ?? []) {
        pages.delete(id);
        outside.removed.add(id);
        outside.changed.delete(id);
      }
      if (change.workspace) {
        workspace = clone(change.workspace);
        outside.meta = true;
      }
    },
    snapshot() {
      return {
        pages: [...pages.values()].map(clone),
        workspace: workspace && clone(workspace),
        exports: [...exports],
      };
    },
  };
}

/** 브라우저 미리보기: 파일 선택 창으로 이미지를 고른다. 취소하면 null(취소 이벤트가 없는 브라우저는 응답이 없다) */
/** 브라우저 미리보기: 문서 파일 여러 개 고르기. 폴더는 알 수 없어 상대 경로 이미지는 가져오지 못한다. 고른 파일은 picked에 번호로 둔다 */
function pickDocumentFiles(picked: Map<string, File>): Promise<DocumentPick | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".md,.markdown,.txt,.html,.htm,.docx,.pdf";
    input.hidden = true;
    document.body.append(input);
    input.addEventListener("change", () => {
      input.remove();
      const files = [...(input.files ?? [])];
      if (!files.length) return resolve(null);
      void Promise.all(
        files.map(async (f): Promise<DocumentFile | null> => {
          const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
          if (!DOCUMENT_EXTS.includes(ext)) return null;
          // 글을 못 읽은 파일은 건너뛴다 (나머지 파일의 가져오기를 막지 않는다)
          const text = TEXT_EXTS.includes(ext) ? await f.text().catch(() => undefined) : null;
          if (text === undefined) return null;
          const id = String(picked.size);
          picked.set(id, f);
          return { id, name: f.name.replace(/\.[^.]+$/, ""), ext, dir: "", text };
        }),
      ).then((list) => {
        const done = list.filter((f): f is DocumentFile => f !== null);
        const skipped = files
          .filter((_, i) => list[i] === null)
          .map((f) => f.name.replace(/\.[^.]+$/, ""));
        resolve({ files: done, skipped });
      });
    });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve(null);
    });
    input.click();
  });
}

const TEXT_EXTS = ["md", "markdown", "txt", "html", "htm"];
const DOCUMENT_EXTS = [...TEXT_EXTS, "docx", "pdf"];

/** 파일 첨부 저장 (Rust `attachments::import_at`과 같은 규칙: 종류·상한 검사, 안전한 이름) */
async function storeAttachmentImpl(
  pageId: string,
  picked: { name: string; bytes: Uint8Array; mime?: string },
  kind: AttachmentPickKind,
  assets: Map<string, Uint8Array>,
  meta: Map<string, { name: string; mime: string }>,
): Promise<AttachmentInfo> {
  if (!isValidId(pageId)) throw new StorageError("invalid_id", `잘못된 페이지 id: ${pageId}`);
  const mime = picked.mime || "application/octet-stream";
  const k: AttachmentKind = attachmentKind(picked.name, mime);
  if (kind === "pdf" && k !== "pdf")
    throw new StorageError("wrong_kind", "PDF 파일만 넣을 수 있어요");
  if (kind === "media" && k !== "video" && k !== "audio")
    throw new StorageError("wrong_kind", "영상·소리 파일만 넣을 수 있어요");
  if (picked.bytes.length > limitFor(k)) throw new StorageError("too_large", oversizeMessage(k));
  const safe =
    picked.name
      .replace(/[^A-Za-z0-9._-]/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 73) || "file";
  const path = `assets/${pageId}/${ulid()}-${safe}`;
  assets.set(path, picked.bytes.slice());
  meta.set(path, { name: picked.name, mime });
  return { path, name: picked.name, size: picked.bytes.length, mime, kind: k };
}

/** 파일 첨부용 브라우저 파일 선택 (이름·형식까지 돌려준다) */
function pickAttachmentFile(
  kind: AttachmentPickKind,
): Promise<{ name: string; bytes: Uint8Array; mime: string } | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  const accept =
    kind === "pdf" ? "application/pdf,.pdf" : kind === "media" ? "video/*,audio/*" : "";
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;
    input.hidden = true;
    document.body.append(input);
    const done = () => input.remove();
    input.addEventListener("change", () => {
      done();
      const file = input.files?.[0];
      if (!file) return resolve(null);
      void file
        .arrayBuffer()
        .then((b) => resolve({ name: file.name, bytes: new Uint8Array(b), mime: file.type }));
    });
    input.addEventListener("cancel", () => {
      done();
      resolve(null);
    });
    input.click();
  });
}

function pickFile(): Promise<Uint8Array | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/gif,image/webp,image/avif";
    // 문서에 붙어 있어야 change가 확실히 온다(브라우저마다 다름)
    input.hidden = true;
    document.body.append(input);
    const done = () => input.remove();
    input.addEventListener("change", () => {
      done();
      const file = input.files?.[0];
      if (!file) return resolve(null);
      void file.arrayBuffer().then((b) => resolve(new Uint8Array(b)));
    });
    input.addEventListener("cancel", () => {
      done();
      resolve(null);
    });
    input.click();
  });
}
