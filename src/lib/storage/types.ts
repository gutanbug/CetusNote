/**
 * 저장 형식 타입 (docs/architecture.md §3, ADR-001).
 * 형식을 바꾸면 schemaVersion을 올리고 schema.ts에 마이그레이션을 더한다.
 */

/** Tiptap JSON 문서. 저장 계층은 내용을 해석하지 않는다. */
export type DocJSON = { type: "doc"; content?: unknown[] } & Record<string, unknown>;

/**
 * 상태 이름. 일반 문서는 기본 4단계(할 일·진행 중·검토·완료), 컬렉션 레코드는
 * 그 컬렉션의 상태 목록(`collection.statuses`, 스키마 4)에서 고른다.
 */
export type PageStatus = string;
/** PDF 쪽 하나의 찍을 영역 (웹뷰 문서 좌표, pt = CSS px). DATA-06 */
export type PdfPageRect = { x: number; y: number; width: number; height: number };
export type PageFont = "default" | "serif" | "mono";

export type PageKind = "page" | "folder" | "collection";

/** 컬렉션 뷰 (COLL-02~04) */
export type CollectionView = "grid" | "board" | "calendar";
/** 정렬·필터에 쓰는 레코드 필드 (COLL-06) */
export type RecordField = "title" | "status" | "assignee" | "due" | "tags";
/** 사용자 속성 id (COLL-08, 스키마 5) — "f"로 시작해 기본 속성 이름과 겹치지 않는다 */
export type FieldId = `f${string}`;
/** 정렬 기준 — 기본 필드 · 수정일 · 사용자 속성 id */
export type CollectionSort = { field: RecordField | "updated" | FieldId; dir: "asc" | "desc" };
/**
 * 적용된 필터 칩 하나. 같은 필드끼리는 또는, 다른 필드끼리는 그리고.
 * 사용자 속성은 선택·다중 선택(옵션 이름)과 체크박스("true"/"false")만 칩으로 거른다
 */
export type CollectionFilter = { field: "status" | "assignee" | "tags" | FieldId; value: string };
/** 기본 속성 4개 — 지울 수 없고 숨기기·순서만 바꾼다 */
export type BuiltinProperty = "status" | "assignee" | "due" | "tags";
/** 사용자 속성 종류 (COLL-08). created·updated는 페이지 시각을 보여 주는 자동 값 */
export type FieldType =
  | "text"
  | "number"
  | "select"
  | "multi"
  | "date"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "created"
  | "updated";
/** 선택 옵션 — 이름과 소프트 컬러 이름 */
export type FieldOption = { name: string; color: string };
/** 사용자 속성 정의 — 컬렉션마다 */
export type FieldDef = { id: FieldId; name: string; type: FieldType; options: FieldOption[] };
/** 속성 순서 한 칸 — 기본 속성 이름이나 사용자 속성 id. 숨기면 표·상세에서 빠진다, card면 보드 카드에 보인다 */
export type PropertySlot = { key: BuiltinProperty | FieldId; hidden: boolean; card: boolean };
/** 레코드 값 — 텍스트류·선택·날짜(YYYY-MM-DD)는 문자열, 숫자, 체크박스, 다중 선택은 문자열 목록 */
export type FieldValue = string | number | boolean | string[];
/** 레코드를 여는 방식 (COLL-07) */
export type RecordOpenMode = "modal" | "side" | "tab";
/** 상태 하나 — 이름과 소프트 컬러 이름(UI-TagChip) */
export type StatusOption = { name: string; color: string };
/** 보드 칸을 나누는 기준 (COLL-03) */
export type BoardGroupBy = "status" | "assignee" | "tags";
/** 칸 머리에 보이는 계산 */
export type BoardCalc = "count" | "due" | "late" | "none";
/** 보드 설정 (스키마 4). 칸 키는 "<기준>:<값>"(값이 없으면 빈 문자열) */
export type BoardSettings = {
  groupBy: BoardGroupBy;
  /** 숨긴 칸 키 */
  hidden: string[];
  /** 칸 색 — 담당·"없음" 칸만. 상태는 statuses, 태그는 workspace 태그 색을 쓴다 */
  colors: Record<string, string>;
  calc: BoardCalc;
};
/** 컬렉션 페이지의 보기 설정 (스키마 3, 4). 컬렉션이 아니면 null */
export type CollectionSettings = {
  view: CollectionView;
  sort: CollectionSort | null;
  filters: CollectionFilter[];
  /** 이 컬렉션의 상태 목록, 보드 칸 순서 (스키마 4) */
  statuses: StatusOption[];
  board: BoardSettings;
  /** 사용자 속성 정의 (스키마 5) */
  fields: FieldDef[];
  /** 기본 속성과 사용자 속성을 합친 순서·숨김·카드 표시 (스키마 5) */
  properties: PropertySlot[];
  /** 이 컬렉션의 레코드 여는 방식. null이면 앱 기본값(settings.json recordOpen)을 따른다 */
  openMode: RecordOpenMode | null;
};

export type Page = {
  schemaVersion: number;
  /** ULID — 파일 이름(pages/<id>.json)과 같다 */
  id: string;
  /**
   * page: 본문이 있는 문서. folder: 묶음만 하는 폴더(본문 없음, SHELL-14, 스키마 2).
   * 폴더는 루트나 다른 폴더 아래에만 둔다. 문서 아래에는 문서만.
   * collection: 레코드(자식 문서)를 표·보드·캘린더로 보는 페이지(COLL-01, 스키마 3). 폴더 규칙과 같고, 자식은 문서만.
   */
  kind: PageKind;
  title: string;
  icon: string | null;
  /** 워크스페이스 기준 상대 경로 (assets/<id>/…) */
  cover: string | null;
  parentId: string | null;
  props: {
    /** 태그 이름. 색은 workspace.json의 tags에 둔다 */
    tags: string[];
    status: PageStatus | null;
    /** 담당 — 자유 입력 이름 (COLL-01, 스키마 3) */
    assignee: string | null;
    /** 마감 — 지역 날짜 YYYY-MM-DD (스키마 3) */
    due: string | null;
    /** 사용자 속성 값 — 속성 id → 값 (COLL-08, 스키마 5). 정의는 부모 컬렉션에 있다 */
    values: Record<FieldId, FieldValue>;
  };
  collection: CollectionSettings | null;
  layout: { fullWidth: boolean; font: PageFont };
  content: DocJSON;
  /** ISO 8601 (UTC) */
  createdAt: string;
  updatedAt: string;
  /** 휴지통으로 옮긴 시각. null이면 휴지통 밖 */
  trashedAt: string | null;
  /**
   * 템플릿이면 그 정보 (PAGE-14, 스키마 6). 템플릿은 사이드바·검색·홈·멘션에 보이지 않고
   * 템플릿 갤러리에만 나온다. 페이지 제목(title)은 카드 이름이다.
   */
  template: PageTemplate | null;
};

export type PageTemplate = {
  /** 갤러리 분류 id (work · journal · study …) */
  category: string;
  /** 카드 설명 한 줄 */
  description: string;
  /** 적용한 새 문서의 제목. `{{date}}`는 오늘 날짜(YYYY-MM-DD)가 된다. 비면 제목 없음 */
  pageTitle: string;
  /** 기본 템플릿에서 왔으면 그 id (daily 등). 일일 노트(PAGE-13)가 찾는 데 쓴다 */
  builtin: string | null;
};

export type WorkspaceMeta = {
  schemaVersion: number;
  name: string;
  /** 형제 순서: 부모 id(최상위는 "root") → 자식 id 목록. 목록에 없는 페이지는 만든 순서로 뒤에 붙는다 */
  order: Record<string, string[]>;
  favorites: string[];
  /** 태그 이름 → 소프트 컬러 이름(UI-TagChip) */
  tags: Record<string, string>;
  /** 빠른 메모(QN-01) — 페이지를 만들지 않고 던져 둔 글. 오래된 것부터 */
  quickNotes: QuickNote[];
  /** 기본 템플릿을 이 워크스페이스에 사본으로 넣었는지 (PAGE-14). 지워도 다시 넣지 않는다 */
  templatesSeeded: boolean;
};

export type QuickNote = {
  id: string;
  text: string;
  /** ISO 8601 (UTC) */
  createdAt: string;
};

export type WorkspaceInfo = { name: string; path: string };
/** 최근 워크스페이스 — 이름은 workspace.json 이름(없으면 폴더 이름) */
export type RecentWorkspace = WorkspaceInfo & { current: boolean };

export type WorkspaceStatus = {
  /** 열린 워크스페이스. null이면 첫 실행 화면(DATA-03) */
  workspace: WorkspaceInfo | null;
  /** 지난번에 쓰던 폴더가 없어졌을 때 그 경로 */
  missingPath: string | null;
  /** "기본 위치에 만들기" 경로(문서 폴더/CetusNote) */
  defaultPath: string | null;
};

export type LoadError = { file: string; message: string };

export type StorageErrorCode =
  | "no_workspace"
  | "invalid_id"
  | "invalid_page"
  | "invalid_json"
  | "invalid_workspace"
  | "invalid_settings"
  | "not_found"
  | "not_trashed"
  | "symlink"
  | "permission_denied"
  | "disk_full"
  | "invalid_asset"
  | "unsupported_image"
  | "too_large"
  | "fetch_failed"
  | "invalid_backup"
  | "not_empty"
  | "invalid_path"
  | "invalid_date"
  | "invalid_version"
  | "already_exists"
  | "unsupported"
  | "io";

/** Rust 커맨드가 돌려주는 오류 */
export class StorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

export type LoadResult = { pages: Page[]; errors: LoadError[] };

/** 버전 기록 한 줄(DATA-09). id는 UTC 시각 이름 `YYYYMMDDTHHMMSSmmmZ` (정렬 가능) */
export type PageVersion = {
  id: string;
  /** ISO 8601 UTC */
  savedAt: string;
  /** 파일 크기(바이트) */
  size: number;
  /** 본문 글자 수 */
  chars: number;
};

/**
 * 프론트엔드가 쓰는 저장소. 실제 앱은 Tauri 구현, 스토리·테스트는 메모리 구현을 쓴다.
 * 경로는 주고받지 않는다 — 폴더와 저장 위치는 Rust가 띄우는 대화상자에서 정한다.
 */
export interface Storage {
  /** 열린(또는 지난번) 워크스페이스와 첫 실행 화면에 필요한 정보 */
  workspaceStatus(): Promise<WorkspaceStatus>;
  /** 폴더 선택 대화상자. 취소하면 null */
  pickWorkspace(): Promise<WorkspaceInfo | null>;
  /** 기본 위치(문서 폴더/CetusNote)에 만들거나 연다 */
  openDefaultWorkspace(): Promise<WorkspaceInfo>;
  /** 최근 연 워크스페이스 (SHELL-15). 없어진 폴더는 빠진다 */
  recentWorkspaces(): Promise<RecentWorkspace[]>;
  /** 최근 목록의 워크스페이스로 바꾼다 */
  switchWorkspace(path: string): Promise<WorkspaceInfo>;
  /** 최근 목록에서 뺀다 (SHELL-16). 폴더는 그대로. 지금 열린 것은 뺄 수 없다 */
  forgetWorkspace(path: string): Promise<void>;
  /** 위치를 고르는 대화상자 → <위치>/<이름> 폴더를 만들어 연다. 취소하면 null */
  createWorkspace(name: string): Promise<WorkspaceInfo | null>;
  readWorkspace(): Promise<WorkspaceMeta>;
  writeWorkspace(meta: WorkspaceMeta): Promise<void>;
  loadPages(): Promise<LoadResult>;
  /** 원자적 쓰기 */
  writePage(page: Page): Promise<void>;
  /** 휴지통에 있는 페이지만 영구 삭제(파일 + assets/<id> + 버전 기록) */
  purgePage(id: string): Promise<void>;
  /** 버전 기록(DATA-09): 페이지 전체를 새 버전으로 남긴다. 페이지마다 최근 50개까지 */
  saveVersion(page: Page): Promise<PageVersion>;
  /** 버전 목록, 최근 것이 앞. 기록이 없으면 빈 목록 */
  listVersions(pageId: string): Promise<PageVersion[]>;
  /** 버전 하나의 페이지 내용 */
  readVersion(pageId: string, versionId: string): Promise<Page>;
  /** 페이지의 버전 기록을 모두 지운다(영구 삭제 때) */
  deleteVersions(pageId: string): Promise<void>;
  readSettings(): Promise<Record<string, unknown> | null>;
  writeSettings(settings: Record<string, unknown>): Promise<void>;
  /** 저장 대화상자 → 파일 쓰기. 취소하면 null, 저장하면 파일 이름 */
  exportMarkdown(fileName: string, text: string): Promise<string | null>;
  /**
   * 워크스페이스 전체 Markdown 내보내기(DATA-10): 폴더 고르기 → 새 폴더에 목록대로 쓴다.
   * 취소하면 null. 쓰지 못한 항목은 failed에 경로로 남는다(나머지는 쓴다).
   */
  exportWorkspaceMarkdown(manifest: WorkspaceExportManifest): Promise<WorkspaceExportReport | null>;
  /** 마지막으로 만든 워크스페이스 내보내기 폴더를 Finder로 연다 */
  revealWorkspaceExport(): Promise<void>;
  /** Markdown 가져오기(DATA-08): 파일 고르기(여러 개). 취소하면 null */
  pickMarkdown(): Promise<MarkdownPick | null>;
  /**
   * 가져온 Markdown의 상대 경로 이미지(`img/a.png`)를 그 페이지 assets로 복사한다.
   * dir은 pickMarkdown이 준 폴더여야 하고, 이미지는 그 폴더 안에 있어야 한다.
   */
  importMarkdownImage(pageId: string, dir: string, src: string): Promise<string>;
  /** 이미지 저장(EDIT-14, PAGE-03): 그 페이지의 assets에 넣고 `assets/<id>/…` 경로를 돌려준다 */
  writeAsset(pageId: string, bytes: Uint8Array): Promise<string>;
  /** writeAsset이 준 경로의 바이트 */
  readAsset(path: string): Promise<Uint8Array>;
  /** 이미지 선택 대화상자 → writeAsset. 취소하면 null */
  pickAsset(pageId: string): Promise<string | null>;
  /** 이미지 링크(http·https)를 내려받아 writeAsset (PAGE-10) */
  /** publicOnly: 내부망 주소(루프백·사설 등)는 거절한다 — 붙여 넣은 웹 이미지(EDIT-24) */
  fetchAsset(pageId: string, url: string, options?: { publicOnly?: boolean }): Promise<string>;
  /** 백업(DATA-05): 저장 대화상자 → 워크스페이스 전체 zip. 취소하면 null, 저장하면 파일 이름 */
  exportBackup(fileName: string, createdAt: string): Promise<string | null>;
  /** 하루 한 번 자동 백업(.backups/, 최근 7개). today는 지역 날짜 YYYY-MM-DD. 오늘 것이 있으면 null */
  autoBackup(today: string, createdAt: string): Promise<string | null>;
  /** 자동 백업 파일 이름(최근 것이 앞) */
  listBackups(): Promise<string[]>;
  /** 자동 백업 폴더를 Finder로 연다 */
  revealBackups(): Promise<void>;
  /** 백업 zip 선택 → 풀 폴더 선택 → 풀고 그 폴더를 연다. 지금 워크스페이스는 그대로. 취소하면 null */
  restoreBackup(): Promise<WorkspaceInfo | null>;
  /** PDF 쪽 한 장 찍기 (DATA-06). run은 내보내기 한 번의 번호, index는 쪽 순서, rect는 웹뷰 문서 좌표(pt). 제한 시간을 넘기면 실패한다 */
  renderPdfPage(run: number, index: number, rect: PdfPageRect): Promise<void>;
  /** 찍어 둔 쪽 count장을 한 PDF로 합쳐 앱 캐시에 둔다. 돌려주는 값은 쪽 수다 (DATA-06). 마지막 PDF는 savePdf가 쓴다 */
  finishPdf(run: number, count: number): Promise<number>;
  /** 합쳐 둔 미리보기 PDF의 쪽 index를 PNG 바이트로 그린다. width는 픽셀 폭 (DATA-06). 화면용이고 저장본은 벡터 그대로다 */
  renderPdfPreviewPage(index: number, width: number): Promise<ArrayBuffer>;
  /** 마지막 PDF를 저장 대화상자에서 고른 곳에 쓴다 (DATA-06). 취소하면 null, 저장하면 파일 이름 */
  savePdf(fileName: string): Promise<string | null>;
  /** 지난번 이후 바깥에서 바뀐 것 (DATA-07). 이 앱이 읽고 쓴 것은 빠진다 */
  scanChanges(): Promise<ExternalChanges>;
  /** 페이지 몇 개 다시 읽기. 없어진 파일은 결과에서 빠진다 */
  readPages(ids: string[]): Promise<LoadResult>;
}

/** 워크스페이스 내보내기 목록의 한 항목: 글이거나 워크스페이스 이미지(assets/…) 복사 */
export type WorkspaceExportFile = { path: string; text: string } | { path: string; asset: string };

export type WorkspaceExportManifest = { rootName: string; files: WorkspaceExportFile[] };

export type WorkspaceExportReport = {
  /** 만든 폴더 이름 (` (2)` 포함) */
  folder: string;
  /** 쓰지 못한 항목의 상대 경로 */
  failed: string[];
  written: number;
};

export type MarkdownFile = {
  /** 확장자를 뺀 파일 이름 */
  name: string;
  text: string;
  /** 파일이 있는 폴더 (상대 경로 이미지용) */
  dir: string;
};
export type MarkdownPick = { files: MarkdownFile[]; skipped: string[] };

export type ExternalChanges = { changed: string[]; removed: string[]; meta: boolean };
