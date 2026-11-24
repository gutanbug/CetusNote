# 아키텍처

> 상태: **확정** (2026-11-19). 이후 변경은 §5 결정 기록에 행을 추가한다.

## 1. 구성도

```
┌──────────────────────────── Tauri v2 앱 ────────────────────────────┐
│  WebView (React)                                                    │
│   screens/  ──▶ features/ (상태·로직) ──▶ lib/storage (IPC 클라이언트) │
│      │                                         │ invoke()            │
│      └─▶ components/ (L1–L6, 순수 UI)           ▼                     │
│  ─────────────────────────────────────── IPC ──────────────────────  │
│  Rust (src-tauri)                                                   │
│   commands/  ──▶ storage/ (파일 읽기·쓰기, 원자적 저장, 감시)          │
│                    │                                                │
└────────────────────┼────────────────────────────────────────────────┘
                     ▼
              워크스페이스 폴더 (로컬 파일)
```

- **components/** 는 props만 받는 순수 UI다. 저장소나 Tauri API를 직접 부르지 않는다. 그래서 Storybook과 Debug 화면에서 그대로 렌더링할 수 있다.
- **features/** 가 상태와 로직을 갖고, 저장은 `lib/storage`를 통해서만 한다.
- 파일 시스템 접근은 **Rust 커맨드만** 한다. 프론트엔드는 `invoke`로 정해진 커맨드만 호출한다.

## 2. 폴더 구조

```
src/
  app/              앱 진입, 라우팅, Provider(테마, 단축키, 토스트)
  screens/          화면 조립 (editor, home, settings …)
  features/         기능 단위 상태·로직 (pages, tree, search, trash, quick-note, prefs)
  components/
    ui/             L1–L2 (shadcn 생성물 포함)
    shell/          L3
    editor/         L4 (Tiptap 확장, 노드 뷰, 슬래시 메뉴, 툴바)
    page/           L5
    collection/     L6
  lib/
    storage/        Rust 커맨드 래퍼 + 타입 (스토리/테스트용 메모리 구현 포함)
    shortcuts/      단축키 정의(표 하나로 관리 → SET-05에서 그대로 표시)
    utils.ts
  styles/
    tokens.css      docs/design/tokens.md와 동일한 CSS 변수
    globals.css     Tailwind 진입, 폰트, 기본 스타일
  debug/            Debug 화면 (개발 빌드 전용, docs/dev/debug-screen.md)
  assets/fonts/     Pretendard Variable, JetBrains Mono, Nanum Myeongjo (모두 npm 패키지로 번들)
src-tauri/
  src/commands.rs   프론트엔드가 부르는 커맨드 (경로를 받지 않음, id만)
  src/app_icon.rs   앱 아이콘 바꾸기(SET-07): 테마별 PNG를 바이너리에 넣고 Dock(macOS)·창 아이콘에 건다
  icons/            번들 아이콘(icon.icns·icon.ico·PNG, 기본은 라이트=화이트). 런타임 전환용은 icons/themes/{light,dark}/icon-512.png(라이트=화이트, 다크=블랙). 1024 원본은 design/app-icon/
  src/storage/      파일 형식 검사, 원자적 쓰기, 링크 차단 — Tauri와 무관한 순수 함수 + 단위 테스트
  build.rs          커맨드 목록(AppManifest) — capabilities에서 허용한 창만 부를 수 있다
  permissions/      storage.toml: 저장 커맨드 묶음 → capabilities/default.json에서 메인 창에만
```

- 스토리 파일(`*.stories.tsx`)은 컴포넌트 옆에 둔다.
- 상태 관리는 **Zustand**를 쓴다(ADR-005). 작고, React 밖(단축키 핸들러, Tiptap 확장)에서도 접근하기 쉽다.

## 3. 저장 구조 (DB 없음)

### 워크스페이스 폴더

```
<워크스페이스>/                       기본값: ~/Documents/CetusNote (첫 실행 시 선택)
  workspace.json                     이름, 공간, 트리 순서, 즐겨찾기, 태그 색, 탭 상태
  pages/
    <pageId>.json                    페이지 1개 = 파일 1개
  assets/
    <pageId>/<파일명>                 이미지, 커버
  .backups/                          자동 백업 zip (CetusNote-YYYY-MM-DD.zip, 최근 7개, DATA-05)
  .history/<pageId>/<버전>.json      페이지 버전 기록 (DATA-09, ADR-013). 페이지 전체를 파일 하나로, 페이지당 최근 50개. 백업 zip에는 넣지 않는다
```

`pages/<pageId>.json` 형식:

```jsonc
{
  "id": "01J…", // ULID
  "kind": "page", // page | folder (스키마 2, SHELL-14) | collection (스키마 3, COLL-01). 컬렉션 아래에는 문서만 둔다
  "title": "주간 회의록 2026-11-19",
  "icon": "📝",
  "cover": "assets/01J…/cover.jpg",
  "parentId": null, // 트리 부모 — 부모 관계의 기준은 페이지 파일
  "props": {
    "tags": ["회의"],
    "status": "진행 중",
    "assignee": "차민석",
    "due": "2026-11-24",
    "values": { "f…": 1200 },
  }, // 태그는 이름으로(색은 workspace.json). 담당·마감은 스키마 3. values = 사용자 속성 값(스키마 5)
  "collection": null, // 컬렉션만: { "view": "grid|board|calendar", "sort": { "field", "dir" } | null, "filters": [{ "field", "value" }],
  //   "statuses": [{ "name", "color" }], "board": { "groupBy": "status|assignee|tags", "hidden": ["<기준>:<값>"], "colors": {}, "calc": "count|due|late|none" },
  //   "fields": [{ "id": "f…", "name", "type": "text|number|select|multi|date|checkbox|url|email|phone|created|updated", "options": [{ "name", "color" }] }],
  //   "properties": [{ "key": "status|assignee|due|tags|f…", "hidden", "card" }], "openMode": "modal|side|tab" | null } (스키마 4·5)
  "layout": { "fullWidth": false, "font": "default" }, // 페이지 메뉴(PAGE-05): 전체 폭, 글꼴 default|serif|mono
  "content": { "type": "doc", "content": [] }, // Tiptap JSON
  "createdAt": "2026-11-19T09:00:00Z",
  "updatedAt": "2026-11-19T09:12:00Z",
  "trashedAt": null,
  "template": null, // 템플릿 문서(PAGE-14)면 { category, description, pageTitle, builtin }, 아니면 null (ADR-012)
  "schemaVersion": 6, // 1 → 2: kind 추가(그전 파일은 모두 page로 읽는다). 2 → 3: 담당·마감·컬렉션(값만 채움). 3 → 4: 컬렉션 상태 목록·보드 설정, 상태 자유 이름(기본 4단계로 채움). 4 → 5: 사용자 속성·열기 방식(값만 채움). 5 → 6: 템플릿 필드(값만 채움, null)
}
```

`workspace.json` 형식 (페이지 한 개에 속하지 않는 것만):

```jsonc
{
  "schemaVersion": 1,
  "name": "내 노트",
  "order": { "root": ["01J…"], "01J…": ["01K…"] }, // 형제 순서. 목록에 없는 페이지는 만든 순서로 뒤에
  "favorites": ["01J…"],
  "tags": { "회의": "blue" }, // 태그 이름 → 소프트 컬러
  "templatesSeeded": true, // 기본 템플릿 사본을 넣었는지(PAGE-14, ADR-012). 한 번만 넣고, 지운 기본 템플릿은 되살리기 전까지 다시 넣지 않는다
  "quickNotes": [{ "id": "01J…", "text": "떠오른 생각", "createdAt": "2026-11-19T09:00:00Z" }], // 빠른 메모(QN-01), 오래된 것부터
}
```

- 빠른 메모(2026-11-19)는 페이지가 아니라 workspace.json에 둔다. 다른 값과 달리 저장하자마자 쓰고, 실패하면 목록에 넣지 않고 입력 칸의 글을 남긴다(사용자 글이므로).
- 태그는 **이름**으로 저장한다(2026-11-19 사용자 결정). 페이지 파일만으로 뜻이 통하고, workspace.json이 없어져도 태그가 남는다. 이름을 바꾸면 그 태그를 쓴 페이지 파일을 모두 다시 쓴다.
- **폴더(SHELL-14, 2026-11-19 사용자 결정):** 폴더도 `pages/`의 파일 하나다(`kind: "folder"`). 휴지통·순서·이동·이름 바꾸기를 문서와 똑같이 쓴다. 규칙은 `canContain` — 루트·폴더·문서 아래에는 무엇이든(2026-11-20 사용자 요청으로 문서 아래 폴더·컬렉션 허용), 컬렉션 아래에는 문서(레코드)만. 스토어(`create`·`update`)가 어긋난 이동을 막고, 파일을 직접 고쳐 어긋난 경우 트리(`features/pages/tree.ts`)가 루트에 둔다.
- 읽을 때 `lib/storage/schema.ts`가 빠진 값은 기본값으로 채우고, 잘못된 값은 안전한 값으로 바꾸고, 모르는 키는 버린다. 앱보다 새 `schemaVersion`의 파일은 열지 않는다(덮어써서 정보를 잃지 않게).

### 커맨드 (`src-tauri/src/commands.rs` ↔ `src/lib/storage`)

프론트엔드는 **경로를 넘기지 않는다.** 페이지는 id(ULID, 형식 검사)로만 가리키고, 워크스페이스 경로는 Rust 상태에만 있다. 폴더와 내보내기 위치는 Rust가 띄우는 대화상자에서만 정해진다.

| 커맨드                                                       | `Storage` 메서드                                                         | 내용                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workspace_current`                                          | `workspaceStatus()`                                                      | 열린 워크스페이스. 없으면 `app-state.json`의 지난 경로를 다시 연다. 폴더가 없어졌으면 `missingPath`, 기본 위치 `defaultPath`도 함께                                                                                                                                      |
| `workspace_use_default`                                      | `openDefaultWorkspace()`                                                 | 기본 위치(문서 폴더/CetusNote)에 만들거나 연다                                                                                                                                                                                                                           |
| `workspace_pick`                                             | `pickWorkspace()`                                                        | 폴더 선택 대화상자(DATA-03). 빈 폴더·기존 워크스페이스는 그대로, 다른 파일이 있으면 그 안 `CetusNote/`                                                                                                                                                                   |
| `workspace_recent` / `workspace_switch` / `workspace_create` | `recentWorkspaces()` / `switchWorkspace(path)` / `createWorkspace(name)` | 최근 워크스페이스(없어진 폴더 제외), 최근 목록 경로로만 전환, 이름 검사 → 위치 대화상자 → `<위치>/<이름>` 새 폴더(있으면 `already_exists`) (SHELL-15)                                                                                                                    |
| `workspace_forget`                                           | `forgetWorkspace(path)`                                                  | 최근 목록에서 그 경로만 뺀다. 폴더는 그대로, 지금 열린 워크스페이스는 `invalid_path` (SHELL-16)                                                                                                                                                                          |
| `workspace_read` / `workspace_write`                         | `readWorkspace()` / `writeWorkspace()`                                   | `workspace.json`                                                                                                                                                                                                                                                         |
| `pages_load_all`                                             | `loadPages()`                                                            | `pages/*.json` 전부. 깨진 파일·이름과 id가 다른 파일·링크는 `errors`로 모으고 건드리지 않는다                                                                                                                                                                            |
| `page_write`                                                 | `writePage()`                                                            | 원자적 쓰기(임시 파일 → 디스크에 내림 → rename → 폴더 내림)                                                                                                                                                                                                              |
| `page_purge`                                                 | `purgePage()`                                                            | `trashedAt`이 있는 페이지만. 파일과 `assets/<id>`(링크면 링크만)                                                                                                                                                                                                         |
| `app_icon_set`                                               | `setAppIcon(theme)`                                                      | 앱 아이콘 교체(SET-07). `"light"`·`"dark"`만 받는다. 미리보기(메모리 저장소)는 아무 일도 하지 않는다                                                                                                                                                                     |
| `settings_read` / `settings_write`                           | `readSettings()` / `writeSettings()`                                     | 앱 설정 폴더 `settings.json` (`tauri-plugin-store`는 쓰지 않는다)                                                                                                                                                                                                        |
| `workspace_export_markdown`                                  | `exportWorkspaceMarkdown()`                                              | 워크스페이스 전체 Markdown 내보내기(DATA-10, ADR-014). 폴더 대화상자 → `<워크스페이스> Markdown <날짜>` 새 폴더에 목록(manifest)대로 쓴다. 목록의 경로는 검사하고, 이미지는 `assets/`에서만 복사. 한 항목 실패는 실패 목록으로                                           |
| `workspace_export_reveal`                                    | `revealWorkspaceExport()`                                                | 마지막 내보내기 폴더를 Finder로 연다(토스트의 「폴더 열기」)                                                                                                                                                                                                             |
| `export_markdown`                                            | `exportMarkdown()`                                                       | 저장 대화상자 → 원자적 쓰기(DATA-04)                                                                                                                                                                                                                                     |
| `asset_write`                                                | `writeAsset()`                                                           | 이미지 저장(EDIT-14·PAGE-03). 바이트를 JSON이 아닌 그대로, 페이지 id는 `x-page-id` 헤더. 종류는 내용 앞 바이트로 판별(PNG·JPEG·GIF·WebP·AVIF, 25MB 이하) → `assets/<id>/img-<고유값>.<확장자>`                                                                           |
| `asset_read`                                                 | `readAsset()`                                                            | `assets/<id>/<파일>` 형식만(파일 이름은 영문·숫자·`-_.`, 점으로 시작 금지). 링크(폴더·파일)는 따라가지 않는다. 바이트 그대로 돌려준다                                                                                                                                    |
| `asset_pick`                                                 | `pickAsset()`                                                            | 이미지 고르기 대화상자(Rust) → 그 페이지 assets에 복사. 취소하면 null                                                                                                                                                                                                    |
| `asset_fetch`                                                | `fetchAsset(pageId, url)`                                                | 이미지 링크 내려받기(PAGE-10, ADR-008). http·https만, 20초·리다이렉트 5번·25MB, 종류는 내용으로 판별 → `asset_write`와 같이 저장. 오류 `fetch_failed`                                                                                                                    |
| `backup_export`                                              | `exportBackup(fileName, createdAt)`                                      | 백업 zip 저장 대화상자(Rust) → 워크스페이스 밖에만. 취소하면 null                                                                                                                                                                                                        |
| `backup_auto`                                                | `autoBackup(today, createdAt)`                                           | `.backups/`에 하루 한 번(날짜 형식 검사), 최근 7개만 남김(이름 형식이 맞는 것만 지움)                                                                                                                                                                                    |
| `backup_list`                                                | `listBackups()`                                                          | 자동 백업 이름(최근 것이 앞)                                                                                                                                                                                                                                             |
| `backup_reveal`                                              | `revealBackups()`                                                        | `.backups/`를 Finder로                                                                                                                                                                                                                                                   |
| `backup_restore`                                             | `restoreBackup()`                                                        | zip → 폴더 대화상자 → 검사 후 풀기 → 그 폴더를 워크스페이스로. 지금 폴더는 그대로                                                                                                                                                                                        |
| `pdf_page` · `pdf_finish` · `pdf_save`                       | `renderPdfPage()` · `finishPdf()` · `savePdf()`                          | PDF 미리보기: 쪽마다(rect) 메인 WKWebView의 `createPDFWithConfiguration`으로 찍어 조각을 앱 캐시에 쓰고, `finishPdf`가 PDFKit으로 한 파일에 합쳐 바이트를 돌려준다. 쪽 나누기는 `pdf-layout.ts`. 저장: 저장 대화상자 → 캐시 PDF 복사(DATA-06). 찍을 내용은 `#print-root` |
| `workspace_scan`                                             | `scanChanges()`                                                          | 지난번 이후 바깥에서 바뀐 페이지·사라진 페이지·workspace.json (DATA-07)                                                                                                                                                                                                  |
| `pages_read`                                                 | `readPages(ids)`                                                         | 페이지 몇 개 다시 읽기. 없는 파일은 빠진다                                                                                                                                                                                                                               |
| `history_save`                                               | `saveVersion(page)`                                                      | 버전 기록 한 개 저장(UTC 밀리초 이름, 같은 밀리초면 한 칸씩 밀어 덮어쓰지 않음). 페이지당 50개를 넘으면 가장 오래된 것부터 지움 (DATA-09)                                                                                                                                |
| `history_list`                                               | `listVersions(id)`                                                       | 버전 목록(최근 것이 앞): 이름·저장 시각·파일 크기·글자 수. 읽을 수 없는 버전은 뺀다                                                                                                                                                                                      |
| `history_read`                                               | `readVersion(id, version)`                                               | 버전 하나의 페이지 내용. 버전 이름은 `YYYYMMDDTHHMMSSmmmZ` 형식만 받는다(`invalid_version`)                                                                                                                                                                              |
| `history_delete`                                             | `deleteVersions(id)`                                                     | 페이지의 `.history/<id>` 전체 삭제. 영구 삭제(`page_purge`)도 같은 일을 한다                                                                                                                                                                                             |

- 오류는 `{ code, message }`로 돌아오고 `lib/storage`가 `StorageError`로 바꾼다. 코드: `no_workspace` `invalid_id` `invalid_page` `invalid_version` `not_found` `not_trashed` `symlink` `permission_denied` `disk_full` `io` 등.
- 앱을 열 때 지난번에 남은 임시 파일(`.<이름>.<…>.tmp`)을 지운다.
- 스토리·테스트는 같은 규칙의 메모리 구현 `createMemoryStorage()`를 쓴다(저장 실패 흉내 `failWrite` 포함).

### Markdown 내보내기 (DATA-04, `features/export/markdown.ts`)

Tiptap JSON을 직접 바꾸는 순수 함수다(외부 변환 라이브러리 없음). GitHub 호환, 페이지 속성은 front matter(2026-11-19 사용자 결정).

| 블록·서식                                  | Markdown                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| 페이지                                     | YAML front matter(title, tags, status, created, updated) + `# 아이콘 제목`             |
| 제목 · 목록 · 번호 · 할 일 · 인용 · 구분선 | `#`~ · `-` · `1.`(start 유지) · `- [ ]`/`- [x]` · `>` · `---`                          |
| 코드 블록                                  | 울타리 + 언어(내용의 백틱보다 긴 울타리)                                               |
| 콜아웃 · 토글                              | 이모지를 붙인 인용 · `<details>`(열림 상태 유지)                                       |
| 표                                         | GFM 표(첫 행 머리글, 셀 줄바꿈 `<br>`, `\|` 이스케이프)                                |
| 수식                                       | `$…$` · `$$ … $$`                                                                      |
| 굵게·기울임·취소선·코드·링크               | `**` `*` `~~` `` ` `` `[ ](url)`. 이어진 마크는 하나로 묶고, 경계 공백은 기호 바깥으로 |
| 밑줄 · 하이라이트 · 위/아래 첨자           | `<u>` `<mark>` `<sup>` `<sub>`                                                         |
| 이미지                                     | `![캡션](assets/…)` (워크스페이스 기준 경로, 파일은 함께 내보내지 않음)                |
| 글자색 · 모르는 블록                       | 버림 · 안쪽 내용만                                                                     |

- 본문 글자의 Markdown 기호와 줄 맨 앞 블록 기호(`#` `>` `-` `1.`)를 이스케이프한다. 파일 이름은 제목에서 못 쓰는 글자를 뺀 것.
- 테스트는 손으로 만든 JSON(13개) + Debug Playground 문서(모든 블록, 노드 22종·마크 9종)를 실제 에디터 JSON으로 변환해 확인했다.

### 원칙

- **원자적 쓰기:** 임시 파일에 쓴 뒤 rename한다. 쓰다가 앱이 꺼져도 파일이 깨지지 않게 하기 위해서다.
- **자동 저장:** 편집이 멈추고 약 800ms 뒤 저장하고, 페이지를 떠날 때와 창을 닫을 때 즉시 저장한다. 상태는 `SH-SaveStatus`로 표시한다.
  - 구현: `features/pages/save-queue.ts`. 페이지마다 따로 디바운스하고, 같은 페이지 쓰기는 겹치지 않게 차례로 한다(쓰는 동안 또 바뀌면 끝난 뒤 최신 내용만 한 번 더).
  - 실패하면 내용을 버리지 않고 들고 있다가 다음 편집·"다시 시도"·닫기 때 다시 쓴다. 상태: 기다리거나 쓰는 중 `saving`, 실패분이 남으면 `error`, 아니면 `saved`.
  - 창 닫기(`lib/storage/window.ts`, 권한 `core:window:allow-destroy`): 남은 저장을 끝낸 뒤 닫는다. 실패하면 한 번은 닫지 않고 토스트로 알리고, 한 번 더 닫으면 그대로 닫힌다(디스크가 계속 실패해도 창에 갇히지 않게). 브라우저 미리보기는 `beforeunload`로 묻는다.
  - 영구 삭제는 휴지통 이동을 먼저 파일에 쓴 뒤 지운다(Rust가 `trashedAt`을 보고 지우므로).
- **검색:** 시작할 때 모든 페이지로 메모리 인덱스를 만들고, 페이지가 바뀔 때마다 그 페이지만 다시 색인한다(`features/search`). 라이브러리 없이 **부분 문자열**로 찾는다 — 한국어 조사·단어 중간도 맞고, 띄어 쓴 검색어는 모두 들어 있어야 나온다(AND). 오타 허용은 없다. DB는 쓰지 않는다(ADR-003).
- **휴지통:** 파일을 지우지 않고 `trashedAt`만 기록한다. 영구 삭제할 때 파일과 `assets/<pageId>`를 지운다.
- **버전 기록(2026-11-21, DATA-09):** 페이지를 고치면 `.history/<pageId>/`에 페이지 전체를 한 파일로 남긴다. 저장이 끝난 내용만 보고(`observe`), 페이지마다 10분에 한 번 이하, 마지막으로 남긴 것과 내용(제목·아이콘·본문 지문)이 다를 때만 남긴다. 10분 안의 변경은 그 시각에 한 번 남긴다(예약). 되돌리기 전·휴지통 이동 전·외부 변경으로 덮이기 전에는 바로 남긴다(같은 내용이면 건너뜀). 폴더·컬렉션은 본문이 없어 남기지 않는다. 되돌리면 제목·아이콘·본문만 바꾸고 id·위치·속성·커버는 그대로 둔다. 되돌리기 전 내용을 먼저 남기고, 실패하면 되돌리지 않는다. 실행 취소는 되돌리기 전 내용을 메모리에서 다시 쓴다. 로딩·외부 변경 감지·백업은 `.history`를 보지 않는다. 구현: `src-tauri/src/storage/history.rs`, `features/history/`.
- **컬렉션(2026-11-20, COLL-01~06, 스키마 3):** 별도 파일 없이 kind `collection` 페이지 + 그 아래 문서(레코드). 페이지에 `props.assignee`(자유 입력, 80자)·`props.due`(YYYY-MM-DD)와 `collection: { view, sort, filters }`(컬렉션만, 나머지는 null)을 더했다. 2 → 3 마이그레이션은 값만 채운다. `canContain`: 컬렉션 아래에는 문서만. 계산은 `features/collection/model.ts`. 스키마 4(2026-11-20, AppFlowy식 보드): 컬렉션마다 상태 목록(`statuses`, 칸 순서·색)과 보드 설정(`board`)을 두고 `props.status`는 자유 이름(40자)이 됐다. 일반 문서는 기본 4단계를 그대로 쓴다. 칸 안 순서는 따로 저장하지 않고 레코드 순서(workspace `order[컬렉션 id]`)를 쓴다. 스키마 5(2026-11-20, COLL-07·08): 컬렉션에 사용자 속성 정의(`fields`, id `f`+소문자·숫자, 50개까지)·속성 순서(`properties`: 숨김·카드 표시, 기본 4개 포함)·열기 방식(`openMode`, null = settings.json `recordOpen`)을, 레코드에 `props.values`(속성 id → 값)를 더했다. 속성을 지우면 정의·순서·필터·정렬과 레코드 값을 함께 지운다. 레코드 사이드 패널 폭은 settings.json `recordPanelWidth`. 페이지 아이콘(2026-11-20, PAGE-10): 스키마는 그대로, `icon` 문자열 하나에 이모지 그대로 · `lucide:<이름>[:<색>]`(색은 소프트 컬러 9종, 이름은 `components/ui/page-icon-set.ts` 모음) · `image:assets/<id>/<파일>`(올린 이미지, 커버·본문 이미지처럼 `assetRefs`가 챙겨 복제·영구 삭제 때 옮긴다)를 담는다(`lib/page-icon.ts`). Markdown 내보내기는 이모지만 제목에 넣는다. 최근 고른 아이콘은 settings.json 워크스페이스별 `recentIcons`(24개).
- **외부 변경 감지(2026-11-20, DATA-07):** 파일 감시(`notify`) 대신 비교 방식. Rust `Workspace`가 자신이 읽고 쓴 파일의 (수정 시각, 크기)를 기억하고, `workspace_scan`이 디스크와 비교한다 — 자기 저장은 변경으로 잡히지 않는다. 커맨드는 워크스페이스 잠금 안에서 돌아 쓰기와 검사가 겹치지 않는다. 프론트엔드는 창 포커스·30초마다 확인하고, 저장 전이거나 확인 중에 바뀐 페이지는 덮지 않는다(충돌 시 이 앱 내용 우선).
- **PDF(2026-11-23, DATA-06 재작업 · 같은 날 인쇄 작업 → createPDF로 교체):** PDF 라이브러리는 넣지 않는다. 시스템 인쇄 창 대신 앱 안 미리보기 대화상자(PG-PdfPreview)에서 PDF를 본 뒤 저장한다. 처음에는 `NSPrintOperation.runOperation`으로 찍었는데, 내용이 한 문단이어도 쪽을 끝없이 만들어 PDF가 수백 MB가 되고 메인 스레드가 멈췄다(재현·확인 2026-11-23). 그래서 Rust(`pdf.rs`)는 메인 WKWebView의 `createPDFWithConfiguration`으로 쪽(rect)마다 찍는다(완료 콜백, 메인 스레드를 막지 않음). 쪽 나누기(A4 높이, 블록 단위 줄바꿈)는 프론트엔드(`pdf-layout.ts`)가 정하고, 쪽을 찍는 동안만 `html[data-pdf-capture]`로 인쇄 화면(`#print-root`)만 보이며 라이트 토큰을 쓴다. 조각은 PDFKit으로 합친다. 전체 제한 시간 30초, 쪽마다 10초. 미리보기(2026-11-23 후속, PG-PdfPreview)는 iframe 대신 쪽 그림을 보여 준다: `pdf_preview_page`가 합쳐 둔 PDF의 쪽을 PDFKit 썸네일로 PNG 그린다(화면용, 저장본은 벡터 그대로). 브라우저 PDF 뷰어를 쓰지 않아 그 안내 막대가 뜨지 않는다.
- **백업(2026-11-19, DATA-05):** zip 하나(`zip` 8.6.0 고정, deflate만 — 이미지는 압축 없이). 표지 `cetusnote-backup.json`(`format: 1`)이 없거나 더 새 형식이면 거절한다. 풀 때는 `workspace.json` · `pages/<ULID>.json` · `assets/<ULID>/<이름>`만 받고(경로 탈출·숨김·다른 파일이면 하나도 쓰지 않음), 파일마다(JSON 20MB, 이미지 25MB)·전체(4GB) 크기를 읽으면서도 자른다. 실패하면 이번에 쓴 것을 지운다. 백업·복원 전에 프론트엔드가 남은 저장을 먼저 끝낸다.
- **이미지(2026-11-19):** 페이지는 `assets/…` 경로만 저장하고, 화면은 `features/assets`가 바이트를 읽어 blob URL로 그린다(같은 경로는 한 번만, 워크스페이스가 바뀌면 비움). 복제·페이지 사이 복사로 다른 페이지 폴더의 이미지를 빌려 쓸 수 있으므로, 영구 삭제 전에 빌려 쓰는 페이지마다 사본을 만들어 경로를 바꾼다(`pagesStore.adoptAssets`). 커버를 바꾸거나 이미지 블록을 지워도 파일은 남는다(실행 취소를 위해 — 정리는 백업 단계에서 다시 본다).
- **앱 설정**(테마, 포인트 색, 사이드바 폭)은 워크스페이스가 아니라 앱 설정 폴더의 `settings.json`에, 마지막 워크스페이스 경로와 최근 워크스페이스 경로 목록(`recent`, 최대 10개, SHELL-15)은 `app-state.json`(Rust 전용)에 둔다. 워크스페이스 전환은 최근 목록에 있는 경로만 받는다(그 밖의 경로는 대화상자로만).
- **읽던 위치(PAGE-15):** 페이지마다 스크롤(맨 위 블록 + 블록 안 비율)과 선택 범위를 `settings.json`의 `workspaces[<경로>].positions` 배열에 둔다(최근 것이 뒤, 최대 200개). 페이지 파일·`updatedAt`은 건드리지 않고, 영구 삭제 때 지운다.
- **분할 화면(SHELL-19, 2026-11-24 제거):** 오른쪽 패널 기능을 없앴다. 예전 `workspaces[<경로>].split` 값은 읽지 않고, 다음 저장 때 사라진다(별도 마이그레이션 없음).
- **스키마 버전:** `schemaVersion`을 두고, 버전이 바뀌면 읽을 때 마이그레이션한다.

## 4. Tauri 보안 · 개발 설정

- 파일 접근은 저장 커맨드로만 한다. 프론트엔드에 `plugin-fs`·`plugin-dialog` 권한을 주지 않는다. 앱 커맨드는 `build.rs`의 목록과 `permissions/storage.toml` 묶음으로 메인 창에만 허용한다.
- 노트 HTML(붙여넣기, 마크다운 가져오기)은 Tiptap 스키마를 거쳐 정제한다. `dangerouslySetInnerHTML`은 쓰지 않는다.
- 창 설정 `dragDropEnabled: false`(2026-11-19): Tauri가 파일 끌어 놓기를 가로채지 않게 해 웹뷰의 HTML5 drop(이미지 끌어 놓기)이 받는다. 경로는 받지 않고 파일 내용만 쓴다.
- macOS 앱 메뉴(`src-tauri/src/menu.rs`, 2026-11-19): 기본 메뉴와 같되 ⌘W를 "탭 닫기"로, 창 닫기를 ⇧⌘W로 옮겼다. 새 탭 · 탭 닫기는 `app-menu` 이벤트로 프런트엔드(`lib/storage/app-menu.ts`)에 알린다. 메뉴 단축키는 웹뷰 keydown보다 먼저 받는다. 창 닫기는 `close()`로 닫기 요청을 거쳐 저장을 끝낸다.
- `tauri-plugin-mcp-bridge`는 `#[cfg(debug_assertions)]`에서만 등록한다. 권한(`mcp-bridge:default`)도 `tauri.dev.conf.json`의 개발 전용 capability에만 둔다(2026-11-19). 릴리스에는 등록도 권한도 없다(크레이트가 의존성이라 권한 이름 문자열만 바이너리에 남는다).
- Debug 화면 코드도 개발 빌드에서만 번들에 들어가게 한다(`import.meta.env.DEV` 조건부 동적 import).

### CSP (ADR-007, 2026-11-19)

`tauri.conf.json`의 `app.security.csp`(릴리스)와 `devCsp`(개발). 외부 출처는 하나도 허용하지 않는다.

| 지시어                     | 값                                 | 이유                                                                                          |
| -------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `default-src`              | `'self'`                           | 앱이 직접 제공하는 파일만                                                                     |
| `script-src`               | `'self'`                           | 인라인 스크립트·eval 금지. Tauri가 번들 스크립트 해시를 자동으로 붙인다                       |
| `style-src`                | `'self' 'unsafe-inline'`           | Radix·Motion·Floating UI의 위치 계산 `style` 속성과 sonner가 넣는 `<style>`에 필요            |
| `img-src`                  | `'self' blob: data:`               | 워크스페이스 이미지는 커맨드로 읽어 blob URL로 그린다(asset 프로토콜은 켜지 않음, 2026-11-19) |
| `media-src`                | `'self' blob:`                     | 같은 이유                                                                                     |
| `font-src`                 | `'self' data:`                     | JetBrains Mono 일부를 Vite가 `data:`로 넣는다                                                 |
| `connect-src`              | `'self' ipc: http://ipc.localhost` | Tauri IPC와 번들 이모지 데이터. 개발에서만 `ws://localhost:1420`(HMR)을 더한다                |
| `object-src` · `frame-src` | `'none'`                           | 쓰지 않음                                                                                     |
| `base-uri` · `form-action` | `'none'`                           | 쓰지 않음                                                                                     |

- `dangerousDisableAssetCspModification: ["style-src"]`: Tauri가 `style-src`에 nonce를 붙이면 브라우저가 `'unsafe-inline'`을 무시해 위 `style` 속성이 깨진다. 스크립트 쪽 해시 보호는 그대로 둔다.
- 개발 실행은 Vite 페이지를 그대로 띄우므로 CSP가 걸리지 않는다. CSP를 바꾸면 `pnpm build` 결과물에 같은 헤더를 붙여 확인한다.
- 개발용 자동화 브리지(`tauri-plugin-mcp-bridge`)는 이 CSP 아래에서 동작하지 않는다(인라인 스크립트 주입). 브리지는 개발 실행(`pnpm app`)에서만 쓰고 릴리스에는 들어가지 않으므로 문제없다.

## 5. 결정 기록 (ADR)

| #   | 결정                                                                                                                                                                                                                                                                                                                                                                                                                             | 상태 | 이유 / 대안                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001 | 페이지 = JSON 파일 1개 (Tiptap JSON)                                                                                                                                                                                                                                                                                                                                                                                             | 확정 | 콜아웃, 토글, 멘션, 속성을 손실 없이 저장할 수 있다. 대안인 Markdown 파일은 사람이 읽기 좋지만 커스텀 블록에서 정보가 손실된다. Markdown은 내보내기(DATA-04)로 제공한다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 002 | 파일 I/O는 Rust 커맨드만                                                                                                                                                                                                                                                                                                                                                                                                         | 확정 | 권한 범위를 좁게 유지                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 003 | 검색은 메모리 인덱스 — 부분 문자열 검색(2026-11-19 개정)                                                                                                                                                                                                                                                                                                                                                                         | 확정 | DB 없음 원칙. MiniSearch는 한국어 단어 중간을 못 찾아 쓰지 않는다(사용자 결정). 5,000페이지 × 10,000자에서 검색 한 번 13ms 이하(측정)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 004 | 아이콘은 lucide로 통일                                                                                                                                                                                                                                                                                                                                                                                                           | 확정 | 사용자 결정. 프로토타입의 Phosphor를 대체                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 005 | 상태 관리는 Zustand                                                                                                                                                                                                                                                                                                                                                                                                              | 확정 | 대안: React Context + useReducer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 006 | 컴포넌트의 단일 소스는 스토리 파일 → Storybook과 Debug 화면이 함께 사용                                                                                                                                                                                                                                                                                                                                                          | 확정 | 두 곳을 따로 관리하지 않기 위해. `docs/dev/debug-screen.md` 참고                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 007 | CSP는 외부 출처 없이 `'self'` + Tauri IPC/asset만 (§4 CSP)                                                                                                                                                                                                                                                                                                                                                                       | 확정 | 로컬 우선 앱이라 외부 연결이 필요 없다. 스타일만 `'unsafe-inline'`(UI 라이브러리의 위치 계산). 대안: `null`(보호 없음)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 008 | 이미지 링크는 Rust(`ureq` 3.5.1, rustls)가 내려받는다 — 웹뷰 CSP는 그대로                                                                                                                                                                                                                                                                                                                                                        | 확정 | 업로드 탭 "이미지 링크"(PAGE-10, 사용자 요청). 사용자가 링크를 넣고 올릴 때만 나가는 요청이고, 받은 바이트는 이미지 판별 후 assets에만 저장한다. 웹뷰 `connect-src`를 열지 않아 ADR-007은 유지. 대안: 웹뷰 fetch(CSP·CORS로 막힘), `reqwest`(의존성이 큼)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 009 | 마크다운 붙여넣기는 `marked` 18.1.2(MIT)로 HTML을 만든 뒤 에디터 스키마로 읽는다                                                                                                                                                                                                                                                                                                                                                 | 확정 | EDIT-23. `@tiptap/markdown`은 쓰는 Tiptap 3.34.0에 맞는 판이 2주가 안 돼 보류. 결과 HTML은 화면 밖 문서(`DOMParser`)에서 읽어 스크립트·원격 이미지가 실행·로드되지 않고, 스키마에 없는 태그는 버린다. 저장 형식(ADR-001)은 그대로                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 010 | 붙여 넣은 웹 이미지도 ADR-008의 `asset_fetch`로 내려받는다                                                                                                                                                                                                                                                                                                                                                                       | 확정 | EDIT-24. 사용자가 붙여 넣을 때만(문서를 열 때 원격 이미지를 그리지 않는다). 내려받는 동안 이미지 노드에 `remote`(원래 주소)를 두고 끝나면 지운다 — 스키마 버전은 그대로(빠져 있으면 null). 결과는 실행 취소 기록에 넣지 않는다. 주소는 프런트(http·https·data만, 붙여 넣은 `data-remote`도 다시 검사)와 Rust(`public_only`: DNS로 푼 모든 주소가 공개 인터넷일 때만, 리다이렉트도 한 단계씩 검사 — 루프백·사설·링크 로컬·CGNAT 거절) 두 곳에서 거른다. 아이콘 업로드 탭의 링크는 사용자가 직접 넣으므로 검사하지 않는다. 대안: `<img>`를 그대로 그리기(CSP·오프라인에서 깨지고 추적됨)                                                                                                                                                                        |
| 011 | 문서 가져오기는 고른 파일의 폴더 안 이미지만 읽는다                                                                                                                                                                                                                                                                                                                                                                              | 확정 | DATA-08. 파일은 Rust 대화상자(`document_pick`, 최대 100개, 글 형식 5MB · docx·pdf 25MB)로 고르고, 글은 문자열로, docx·pdf는 번호(`document_bytes`·`document_pdf_text`)로만 넘긴다. 프런트엔드에 경로를 주지 않는다. 고른 파일의 폴더(정규화 경로)를 앱 상태에 기억해 두고, `document_image`는 그 폴더 안(하위 포함)의 이미지 확장자 파일만 읽어 assets로 복사한다(`..`·절대 경로·다른 스킴·심볼릭 링크로 밖을 가리키면 거절). 웹 이미지는 내려받을 자리로 두고 페이지를 열 때 ADR-010 경로로 받는다. 형식별 변환은 ADR-016                                                                                                                                                                                                                                    |
| 012 | 템플릿은 숨긴 워크스페이스 페이지다 — 기본 템플릿은 한 번만 사본으로 넣는다                                                                                                                                                                                                                                                                                                                                                      | 확정 | PAGE-14(사용자 결정, 2026-11-21). 템플릿은 페이지 파일 하나(`template` 필드, schemaVersion 6)로 저장해 페이지와 같은 방식으로 읽고 쓴다. 트리·검색·백링크·멘션에서 숨기고 휴지통 규칙을 그대로 쓴다. 기본 6개는 `templatesSeeded`가 없을 때 한 번 사본으로 넣고, 그 뒤로는 사용자가 편집·삭제할 수 있다. 지운 기본 템플릿은 설정 › 데이터의 「기본 템플릿 되살리기」로 되돌린다. 본문 날짜는 `{{date}}` 토큰으로 두고 적용할 때 오늘 날짜로 바꾼다(일일 노트 PAGE-13도 같은 규칙). 대안: 앱 코드의 상수 목록(편집 불가), 별도 템플릿 파일 폴더(페이지 형식 두 벌)                                                                                                                                                                                             |
| 013 | 페이지 버전 기록은 `.history/<pageId>/`에 페이지 전체를 파일로 남긴다 — 페이지당 50개 · 10분 간격 · 내용이 바뀐 때만                                                                                                                                                                                                                                                                                                             | 확정 | DATA-09(사용자 결정, 2026-11-21). 데이터를 잃지 않게 하는 안전망이라 DB나 diff 저장 대신 파일 하나에 완전한 사본을 둔다(복원이 단순하고, 한 파일이 깨져도 다른 버전은 남는다). 버전 이름은 UTC 밀리초(`YYYYMMDDTHHMMSSmmmZ`)라 사전순이 곧 시간순. 영구 삭제 때 함께 지운다(실패해도 영구 삭제는 끝낸 것으로 본다, 남은 폴더는 쓰이지 않는 고아). **백업 zip에는 넣지 않는다**: 페이지마다 50개 사본이 더해져 백업이 수십 배로 커질 수 있고, 복원 허용 목록을 넓혀야 한다. 버전은 이 기기의 되돌리기용이다. 페이지 파일 형식(ADR-001)과 `schemaVersion`은 그대로. 대안: 변경분(diff) 저장(복원 시 재조립·손상 위험), 백업 zip에 포함(위 이유), 앱 설정 폴더에 저장(워크스페이스를 옮기면 기록이 빠짐)                                                         |
| 014 | 워크스페이스 전체 Markdown 내보내기는 고른 폴더 안에 새 `<워크스페이스> Markdown <날짜>` 폴더를 만들어 쓰고, 기존 파일은 덮어쓰지 않는다                                                                                                                                                                                                                                                                                         | 확정 | DATA-10(사용자 결정, 2026-11-21). 구조: 폴더 → 디렉터리, 글 → `<제목>.md`, 자식이 있는 글 → `<제목>.md` + `<제목>/`, 컬렉션 → `<제목>/index.md`(본문 + 레코드 표) + 레코드 `.md`. 이미지는 루트 `assets/<페이지 id>/`에 워크스페이스와 같은 경로로 복사하고 본문은 상대 경로로 고친다(페이지마다 복사하지 않는다). 멘션은 내보낸 문서면 상대 경로 링크, 아니면 제목 글. 휴지통·템플릿은 뺀다. 쓰기는 Rust만: 새 폴더는 `create_dir`로 만들어 이름 충돌을 ` (2)`로 푼다, 경로는 `..`·절대·숨김·역슬래시를 거절, 이미지는 워크스페이스 `assets/` 안의 일반 파일만 복사(링크 거절). 한 항목이 실패해도 나머지는 쓴다. 대안: 백업 zip에 포함(복원 대상이 아니라 쓸모가 다름), 페이지마다 저장 대화상자(문서가 많으면 번거로움), 프런트엔드가 경로 지정(경계 위반) |
| 015 | 읽던 위치는 페이지 파일이 아니라 워크스페이스별 `settings.json`에 둔다(최대 200개, LRU). 스크롤은 픽셀이 아니라 맨 위 블록 + 블록 안 비율로 적는다                                                                                                                                                                                                                                                                               | 확정 | PAGE-15(사용자 선택, 2026-11-21). 페이지 스키마·`schemaVersion`을 바꾸지 않고, 화면 폭·배율이 바뀌어도 같은 문단에 닿는다. 캐럿은 문서 위치를 그대로 쓰되 복원할 때 문서 크기에 맞춘다. 대안: 페이지 파일에 넣기(수정일·버전 기록을 흔든다), 픽셀 값(배율 변경에 깨진다), 스토리지 DB(ADR-003 위반)                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 016 | 문서 가져오기 형식: txt·html은 자체 변환, docx는 `mammoth` 1.13.0(BSD-2-Clause, JS)으로 HTML을 만든 뒤 html 경로, pdf는 PDFKit(`objc2-pdf-kit`)으로 글자만 뽑는다                                                                                                                                                                                                                                                                | 확정 | DATA-08(사용자 결정, 2026-11-23). 세 형식 모두 같은 HTML 경로(`htmlToDoc`: 스크립트·스타일·폼·이벤트 속성·`javascript:` 등 제거, 제목은 `<title>`·첫 `<h1>`)와 붙여넣기와 같은 스키마를 쓴다. PDF는 레이아웃·표·그림을 잃는다는 것을 받아들인다. 브라우저 미리보기는 PDF를 가져오지 못한다(`unsupported`). 테스트 DOM은 `happy-dom` 21.0.4(devDependency, MIT)로 돌린다. 대안: `pdf.js`(무거움·워커), `jszip` 직접 파싱(표·스타일 손실이 크다)                                                                                                                                                                                                                                                                                                                |
| 017 | 앱 업데이트는 Tauri updater로 하고 설치는 사용자가 누른 뒤에만 한다. 확인 주소는 GitHub Releases의 `latest.json`이다                                                                                                                                                                                                                                                                                                             | 확정 | SYS-07(사용자 결정, 2026-11-23). 자동 확인은 앱을 켤 때와 켜 둔 동안 하루에 한 번, 실패는 화면에 알리지 않는다. 업데이트 파일은 개인 키(`~/.tauri/cetusnote.key`, 저장소 밖)로 서명하고, 앱에는 공개키만 `tauri.conf.json`에 둔다. 릴리스는 `v*` 태그에서 GitHub Actions가 macOS universal로 만들며, 업데이트 산출물은 `tauri.release.conf.json`으로만 켠다(개발 빌드에는 영향 없음). 설치 전에는 저장을 모두 끝내고 `tauri-plugin-process`로 다시 연다. Apple 서명·공증은 아직 없어 처음 설치는 우클릭 › 열기다. 대안: 자동 설치(사용자 결정과 다름), 자체 업데이트 서버(서버·계정 범위 밖), 공증(개발자 계정 필요)                                                                                                                                          |
| 018 | Windows·Linux를 같은 Tauri 앱으로 지원한다. OS별 차이는 설정 파일 분리(`tauri.macos.conf.json`·`tauri.windows.conf.json`·`tauri.linux.conf.json`), `cfg(target_os)`, `lib/platform-labels`(UA 판별 · 단축키 표기 · 주 수식키)로만 다룬다                                                                                                                                                                                         | 확정 | SYS-08(사용자 결정, 2026-11-23). 창 틀: macOS만 오버레이, 나머지는 OS 기본. 번들: macOS dmg·app, Windows NSIS(코드 서명 없음 → SmartScreen 안내), Linux AppImage·deb. 플랫폼 값은 `PlatformContext`로 내려보내고 컴포넌트는 값만 읽는다(개발 빌드에서만 `?platform=` 주소 인자로 바꿔 본다). 업데이트 목록은 세 OS의 `.sig`를 `scripts/make-latest-json.mjs`가 모아 만든다(작업마다 덮어쓰지 않게). 빌드 확인은 `ci.yml`(PR, Windows·Linux, 릴리스 없음; macOS는 개발 Mac에서 직접 확인). 실기기 확인 전까지 Windows·Linux는 "구현 · 확인 필요"                                                                                                                                                                                                               |
| 019 | PDF 내보내기 엔진: macOS는 기존대로 쪽마다 WKWebView `createPDF` + PDFKit 합치기. Windows·Linux는 문서 전체를 OS 인쇄 엔진으로 한 번에 찍는다(WebView2 `ICoreWebView2_7::PrintToPdf`, WebKitGTK `PrintOperation` + Print-to-File). 미리보기 쪽 그림과 PDF 가져오기 글자는 Windows·Linux에서 pdf.js(`pdfjs-dist` 6.5.438, Apache-2.0)                                                                                             | 확정 | DATA-06·DATA-08(SYS-08). 두 엔진은 쪽 하나만 찍는 API가 없어서 쪽 단위 영역 찍기를 쓸 수 없다. 그래서 쪽 나누기는 엔진이 CSS `@page`(A4, 여백 20·18mm)로 하고, 쪽보다 긴 블록은 쪽 사이에서 나뉠 수 있다(macOS와 다른 점). 글자는 벡터로 남는다. pdf.js는 PDF를 만들지 못해서 쓰기에는 쓰지 않고, 미리보기·글자 읽기에만 쓴다. 이미지로 찍으면 글자 선택이 안 돼서 택하지 않았다                                                                                                                                                                                                                                                                                                                                                                              |
| 020 | 다른 앱에서 가져오기(DATA-11)는 zip·폴더를 Rust가 읽는다: `app_import_pick`이 고른 원본의 목록(경로·글 파일 글자)을 만들고, 그림 등은 `app_import_bytes`로 경로를 골라 그때그때 읽는다                                                                                                                                                                                                                                           | 확정 | 원본 zip·폴더는 앱 밖이라 프런트엔드에 경로·파일 권한을 열지 않는다(ADR-011과 같은 방식). 목록은 상대 경로(`/`)만 주고받고, `..`·절대 경로·역슬래시·드라이브 문자·심볼릭 링크·숨김 파일은 거절한다. zip 안의 zip은 한 단계만 펼친다(Notion 분할). 상한: 항목 2만 개, 글 파일 10MB, 그림 25MB, zip 512MB, 합계 2GB. 백그라운드 스레드에서 읽어 화면이 멈추지 않는다. zip은 기존 백업이 쓰는 `zip` 크레이트(=8.6.0, deflate)를 그대로 쓴다(새 의존성 없음). 대안: 프런트엔드 JS zip 라이브러리(전체를 메모리에 올리고 경로 검사를 흩어 해야 함), 압축을 임시 폴더에 풀기(남은 파일 정리·디스크 사용량 문제), 가져오기 전체를 한 번에 Rust에서 문서 JSON으로 변환(형식별 변환 로직이 Rust로 옮겨 감)                                                             | 원본을 세션 상태에만 둔다(앱을 닫으면 사라진다). 백업·DATA-08의 파일 번호 방식과 같은 모양                    |
| 021 | 사이드바 트리는 펼쳐진 행을 평평한 목록으로 펴고 보이는 구간만 그린다(SYS-10). 라이브러리 없이 고정 행 높이(30px) 자체 윈도잉을 쓴다                                                                                                                                                                                                                                                                                             | 확정 | 행은 `min-h-7.5`에 말줄임 한 줄이라 높이가 바뀌지 않아 측정이 필요 없다. `@tanstack/react-virtual`은 가변 높이 측정용이라 여기서는 의존성과 측정 루프만 더한다. 대안 `React.memo`만 쓰기는 5000개 루트 행을 그대로 그려 첫 그리기 332ms를 줄이지 못했다(측정). 스크롤 영역은 가장 가까운 ScrollArea 뷰포트, 구간 밖이어도 포커스·Tab·끄는 행은 남긴다                                                                                                                                                                                                                                                                                                                                                                                                         | 펼치기 높이 애니메이션은 뺀다. 행 높이를 바꾸면 `ROW_HEIGHT`(`page-tree-rows.ts`)와 `min-h-7.5`를 같이 바꾼다 |
| 022 | 본문 지연 로딩: 시작할 때는 페이지 메타데이터만 읽고 본문은 열 때 읽는다                                                                                                                                                                                                                                                                                                                                                         | 확정 | 아래 ADR-022 참고. 구현 완료(2026-11-24, SYS-10)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —                                                                                                             |
| 023 | 긴 문서 입력 경로: 코드 블록 하이라이트는 바뀐 범위와 겹치는 블록만 다시 칠하고, 본문 검색 색인은 찾기·유휴 시간에 한 번에 만든다                                                                                                                                                                                                                                                                                                | 확정 | SYS-11. Tiptap 기본 lowlight 플러그인은 문서 변경마다 전체 노드를 두 번 훑고 스텝마다 코드 블록 전체와 맞춰, 코드 블록 1만 개에서 한 글자에 2.4초가 걸렸다(측정). 색인은 고친 페이지의 본문 전체를 낱말로 쪼개므로 입력마다 하지 않는다. 같은 페이지를 여러 번 고치면 마지막 본문만 만든다. 찾기는 밀린 페이지를 먼저 만들어 결과는 즉시 만든 것과 같다. 대안: content-visibility(스크롤 개선이 측정되지 않았고 선택 링이 잘릴 위험이 있어 취소), 노드 뷰 가상화(큰 변경이라 후속 과제)                                                                                                                                                                                                                                                                       | —                                                                                                             |
| 024 | 워크스페이스 토큰(DATA-03): Rust가 워크스페이스를 열 때마다 새 토큰을 발급하고, 쓰기 커맨드(`page_write`·`page_purge`·`history_save`·`history_delete`·`workspace_write`·`asset_write`)는 호출 순간의 토큰을 싣는다. Rust는 잠금 아래에서 현재 토큰과 맞지 않으면 `stale_workspace`로 거절한다. 같은 폴더를 다시 열어도 토큰이 새로 나오므로 A→B→A 되돌아오기도 막는다. 저장 대기열은 이 오류를 다시 쓰지 않고 오류 상태로 남긴다 |
| 025 | 파일 첨부 · 미디어 저장(제안, 2026-11-24, EDIT-31~33): 파일은 `assets/<pageId>/`에 복사하고 노드에는 상대 경로·이름·크기·종류만 둔다. PDF·영상·소리는 Tauri 자산 프로토콜(`convertFileSrc`)로 읽는다. 확정 전 — 아래 상세                                                                                                                                                                                                        |

### ADR-022 — 본문 지연 로딩 (상태: 확정, 2026-11-24 구현)

- **배경:** 시작할 때 모든 본문을 읽어 프런트엔드로 보냈다(합성 5,000쪽: IPC 22.5MB, JSON 파싱 44ms, 힙 44MB).
- **결정:**
  1. **시작:** `pages_load_meta`가 `pages/*.json`의 구조(`content` 제외)만 돌려준다. 파일별 (수정 시각 ns, 크기)가 같으면 `workspace/.cache/pages-index.json`의 항목을 쓰고 파일을 읽지 않는다. 색인은 지워도 되는 캐시다. 형식 번호가 다르거나 깨졌으면 처음부터 다시 만든다.
  2. **열 때 읽기:** `ensureBody(id)`가 `pages_read`로 본문을 읽는다. 같은 id는 한 번만 읽는다. 읽기 전 본문은 `UNLOADED_BODY` 자리 값이고(객체 참조로 판단), 메인 화면은 읽는 동안 에디터를 그리지 않는다.
  3. **구조만 고친 페이지:** 이름·휴지통 등은 바로 화면에 반영하고 저장은 본문이 올 때까지 미룬다(`pendingMeta`). 자리 값을 디스크에 쓰지 않는다. `flushAll`·`flushPage`는 본문을 먼저 기다린다.
  4. **검색 색인:** 워크스페이스를 읽으면 제목을 조각으로 만들고, 본문은 유휴 시간에 100쪽씩 읽어 색인한다(스토어에는 넣지 않는다). 본문 없는 페이지의 이름 변경은 기존 본문 색인을 남긴다(`upsertTitle`). 끝나면 전체 빌드와 결과가 같다(`onComplete`).
  5. **본문 요약**(`features/pages/summary.ts`): 같은 백그라운드 읽기에서 페이지마다 백링크 대상·체크리스트 항목·첫 그림을 뽑는다. 백링크, 홈 할 일, 표지 그림은 이것만 본다. 열린 본문을 고치면 유휴 시간에 다시 뽑는다.
  6. **전체 본문이 필요한 곳만 전부 읽는다:** 워크스페이스 내보내기(`ensureAllBodies`), 영구 삭제 때 그림 사본 정리(`adoptAssets`). 단일 페이지(PDF·Markdown 내보내기, 버전 복원, 템플릿 사용)는 그 페이지만 읽는다.
  7. **바깥 변경(DATA-07):** 바뀐 파일은 전체로 다시 읽어 `applyExternal`에 넣는다. 열지 않은 페이지도 반영되며 본문이 채워진다. 구조 색인은 파일 상태로 자동 무효화된다.
- **측정** (합성 워크스페이스, 페이지당 JSON 약 3.2KB, 5,000쪽 / 20,000쪽, 전 → 후):

| 항목                                                        | 5,000쪽                                         | 20,000쪽                               |
| ----------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| Rust 불러오기 (release, `load_all` → `load_meta` 색인 적중) | 약 175ms → 약 48ms (색인 없는 첫 실행 약 193ms) | 약 727ms → 약 204ms (첫 실행 약 862ms) |
| IPC 크기 (직렬화 JSON)                                      | 22.5MB → 2.2MB                                  | 90MB → 8.7MB                           |
| 직렬화 시간 (Rust)                                          | 26ms → 3ms                                      | 101ms → 11ms                           |
| JS JSON.parse                                               | 44ms → 4ms                                      | 180ms → 16ms                           |
| 구조 준비 (store.load, JS)                                  | 53ms → 16ms                                     | 213ms → 50ms                           |
| JS 힙, 불러오기 직후                                        | 44MB → 8MB                                      | 176MB → 31MB                           |
| 검색 준비 (찾는 낱말이 전부 나옴, 백그라운드)               | 280ms → 535ms                                   | 1,360ms → 2,750ms                      |
| JS 힙, 검색 준비 후                                         | 73MB → 43MB                                     | 292MB → 170MB                          |
| 페이지 열기 (디스크에서 한 쪽)                              | 0 (이미 메모리) → 3ms, 다시 열기 0.005ms        | 0 → 10ms, 다시 열기 0.01ms             |

측정 방법: Rust는 `storage::meta`의 `CETUS_PERF_WS` 측정 테스트(`--release`), JS는 `features/pages/lazy-load.perf.test.ts`(같은 환경 변수, 디스크에서 파일을 읽는 메모리 스토리지). 검색 준비 시간은 노드의 동기 파일 읽기를 포함하므로 실제 앱의 절대값과 다르다. 이전 커밋 기준은 같은 하네스를 그 커밋 복사본에서 돌렸다.

- **알려진 제한·위험:**
  - 색인이 없는 첫 실행(업데이트 직후 한 번)은 전체 불러오기보다 약간 느리다(위 표). 색인을 쓴 뒤의 실행부터 빨라진다.
  - 본문을 아직 안 읽은 페이지를 바깥에서 고치면, 앱이 그 전 내용을 읽을 수 없으므로 덮어쓰기 전 버전 기록 보존에 대한 검토가 필요하다. 이번 작업에서는 확인하지 않았다.
  - 백그라운드 읽기가 끝나기 전에는 아직 안 읽은 본문의 낱말·백링크·할 일이 빠진다. 페이지가 많을수록 끝나는 데 시간이 든다(위 표).
  - 백링크 문맥의 멘션 칩 글은 요약을 만든 때의 제목이다. 대상 제목을 바꾸면 그 페이지 요약을 다시 뽑을 때까지 옛 제목이 남는다.
  - 프리페치와 본문 캐시 크기 제한(LRU)은 없다. 연 본문은 메모리에 남는다.
  - 이 측정은 합성 데이터와 노드 하네스 기준이다. Tauri 앱 실행과 브라우저(Aside) 확인은 하지 않았다.
- **후속 후보:** LRU 본문 캐시, 탭·최근 문서 프리페치, 요약을 Rust 쪽 색인 파일로 옮기기(JS가 본문을 읽지 않고 백링크·할 일을 얻게).

### ADR-025 — 파일 첨부 · 미디어 저장 (상태: 제안, 2026-11-24)

- **배경:** EDIT-31(파일 첨부), EDIT-32(PDF), EDIT-33(비디오·오디오)은 이미지(ADR-008·010, `asset_write`·`asset_pick`·`asset_fetch`)보다 큰 파일을 다룬다. 이미지는 `features/assets`가 바이트를 읽어 blob URL로 그리는데, 수백 MB 영상에는 맞지 않는다.
- **제안:**
  1. **저장 위치:** 기존 `assets/<pageId>/` 규칙을 따른다. 파일 이름은 `<첨부 id>-<정리한 이름>`(영문·숫자·`-_.`, 점으로 시작 금지, 원본 이름은 노드 속성에). 같은 파일을 두 번 넣으면 두 번 복사한다(중복 제거는 1차 범위 밖).
  2. **노드 속성:** `{ path: "assets/…", name, size, mime, kind }` — `kind`는 `file` · `pdf` · `video` · `audio`. 경로는 워크스페이스 기준 상대 경로라 워크스페이스를 옮겨도 깨지지 않는다.
  3. **Rust 커맨드:** 기존 `asset_pick`은 이미지만 받는다. 파일 첨부용 `asset_pick_file`(대화상자 → 그 페이지 assets에 복사, 크기 상한 검사, 취소 시 null)을 추가하고, `asset_write`의 형식 검사는 파일 첨부 경로에서만 넓힌다.
  4. **렌더링:** PDF·영상·소리는 바이트 대신 `convertFileSrc(절대 경로)`로 웹뷰가 직접 읽는다. 자산 프로토콜 범위는 워크스페이스 `assets/`로 제한한다. CSP(ADR-007)는 `'self'` + Tauri IPC/asset만 허용하므로 외부 출처는 늘리지 않는다. 자산 프로토콜 허용 범위 설정은 구현 때 확인한다.
  5. **크기 상한(제안):** 파일 첨부 100MB, 영상·소리 별도 상한은 결정 필요. 넘으면 저장 전에 거절한다(EDIT-14의 25MB 이미지 상한과 구분).
  6. **Markdown 내보내기:** 첨부는 `[이름](assets/…)` 링크, 영상·소리·PDF도 링크로 내보낸다. 파일은 함께 내보내지 않는다(이미지 규칙과 같음). 경로 블록은 텍스트, 날짜 칩은 `YYYY-MM-DD`.
  7. **백업·삭제:** 백업 zip에는 `assets/`가 들어간다(기존 규칙). 휴지통 이동은 파일을 지우지 않고, 영구 삭제 때 `assets/<pageId>`와 함께 지운다.
  8. **알림(EDIT-37):** 알림 시각을 어디에 저장할지(페이지 블록 속성 또는 설정 파일)는 이 ADR이 아니라 EDIT-37 결정 때 정한다.
- **열린 질문:** 크기 상한 값, PDF 렌더링 방식(웹뷰 기본 vs pdf.js), 실행 파일 첨부 허용 여부(열 때 OS 기본 앱에 맡기는 것으로 충분한지).
- **구현 메모 (2026-11-24, 컴포넌트 단계 · 2단계에서 연결):**
  - **PDF 렌더링 결정:** 웹뷰 기본 PDF 뷰어 대신 **pdf.js 번들**. 새 의존성은 없다. `pdfjs-dist` **6.5.438**(정확히 고정, 2026-11-01 공개)은 DATA-06 내보내기 미리 보기 때 이미 들어 있다. PDF 블록은 `import("pdfjs-dist")`와 `pdf.worker.min.mjs?url`로 마운트 때만 불러온다(워커는 앱 번들 파일, CSP `'self'`). 쪽은 화면 근처에 올 때만 그린다.
  - **번들 영향(`vite build`, 2026-11-24 측정):** pdf 지연 청크 444 KB(gzip 134 KB) · 워커 자산 1.27 MB. 둘 다 이미 있던 것이다. 새 컴포넌트는 아직 어떤 화면에도 연결되지 않아 릴리스 번들 증가는 0이다.
  - **크기 상한 상수:** `src/lib/attachments/limits.ts` — 파일 25MB, 영상·소리 200MB(사용자 결정). 2단계의 Rust 검사(`asset_pick_file`)도 같은 값을 쓴다.
  - **2단계 필요 사항:** 노드 속성(`path`·`name`·`size`·`mime`·`kind`)을 컴포넌트 props에 그대로 넘기고, `resolveSrc`는 `convertFileSrc`로 구현한다. 콜백(`onOpen`·`onReveal`·`onDownload`·`onReplace`·`onRemove`)은 Rust 커맨드로 잇는다.
  - **미확인:** PDF 글자 층(검색·선택)은 넣지 않았다(선택 사항 · 1차 범위 밖). 쪽 높이는 첫 쪽 비율로 잡아, 쪽마다 크기가 다른 문서는 그릴 때 한 번 바뀐다.
