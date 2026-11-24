//! 프론트엔드가 부르는 저장 커맨드. 프론트엔드는 `src/lib/storage`만 이 커맨드를 부른다.
//! 경로는 받지 않는다: 폴더·저장 위치는 Rust가 띄우는 대화상자에서만 정해진다.

use crate::app_import;
use crate::storage::{self, LoadedPages, Result, StorageError, Workspace};
use serde::Serialize;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

/// 앱 설정 폴더의 파일: 마지막 워크스페이스 경로(Rust 전용)와 화면 설정(프론트엔드 소유)
const APP_STATE_FILE: &str = "app-state.json";
const SETTINGS_FILE: &str = "settings.json";

#[derive(Default)]
pub struct AppState {
    workspace: Mutex<Option<Workspace>>,
    /// 문서 가져오기(DATA-08)로 사용자가 고른 파일들의 폴더(정규화). 그 안의 이미지만 읽는다
    import_dirs: Mutex<HashSet<PathBuf>>,
    /// 문서 가져오기로 고른 파일 경로. 번호(인덱스)로만 프런트엔드와 주고받는다
    import_files: Mutex<Vec<PathBuf>>,
    /// 마지막으로 만든 워크스페이스 Markdown 내보내기 폴더(폴더 열기용, DATA-10)
    last_export: Mutex<Option<PathBuf>>,
    /// 마지막으로 만든 PDF 미리보기 파일(앱 캐시, DATA-06). pdf_save가 이 파일을 복사한다
    last_pdf: Mutex<Option<PathBuf>>,
    /// 다른 앱에서 가져오기(DATA-11)로 고른 zip·폴더와 그 목록. 항목은 경로(상대)로만 찾는다
    app_import: Mutex<Option<ImportSession>>,
    /// 워크스페이스 토큰 발급 번호 (DATA-03). 열 때마다 1씩 올라가므로 같은 폴더를 다시 열어도 토큰이 새로 나온다
    workspace_token: AtomicU64,
}

impl AppState {
    fn issue_token(&self) -> u64 {
        self.workspace_token.fetch_add(1, Ordering::SeqCst) + 1
    }

    /// 현재 워크스페이스를 바꾼다. 잠금 아래에서 바꾸므로 진행 중인 쓰기는 끝난 뒤에야 새 워크스페이스를 본다
    fn store(&self, ws: Workspace) -> Result<()> {
        *self
            .workspace
            .lock()
            .map_err(|_| StorageError::new("io", "상태 잠금 실패"))? = Some(ws);
        Ok(())
    }

    /// 테스트용: 토큰을 받아 현재 워크스페이스로 세운다
    #[cfg(test)]
    fn install(&self, mut ws: Workspace) -> Result<u64> {
        ws.token = self.issue_token();
        let token = ws.token;
        self.store(ws)?;
        Ok(token)
    }
}

/// 쓰기 커맨드 공통 진입점 (DATA-03). 호출한 쪽이 알고 있는 워크스페이스 토큰이 현재 것과 다르면
/// 워크스페이스를 바꾼 뒤에 도착한 쓰기이므로 `stale_workspace`로 거절한다. 검사와 실행은 같은 잠금 아래에서 한다.
fn with_workspace_token<T>(
    state: &AppState,
    token: u64,
    f: impl FnOnce(&Workspace) -> Result<T>,
) -> Result<T> {
    let guard = state
        .workspace
        .lock()
        .map_err(|_| StorageError::new("io", "상태 잠금 실패"))?;
    let ws = guard
        .as_ref()
        .ok_or_else(|| StorageError::new("no_workspace", "워크스페이스가 열려 있지 않아요"))?;
    if ws.token != token {
        return Err(StorageError::new(
            "stale_workspace",
            "워크스페이스를 바꾸는 사이 도착한 저장이라 쓰지 않았어요",
        ));
    }
    f(ws)
}

/// 다른 앱 가져오기 세션: 고른 원본과 항목 목록(ADR-020)
pub struct ImportSession {
    source: app_import::Source,
    entries: HashMap<String, app_import::Entry>,
}

/// 가져오기 목록의 글 파일 한 개 (경로와 글자)
#[derive(Serialize)]
pub struct AppImportText {
    path: String,
    text: String,
}

/// 고른 zip·폴더의 목록. texts는 글 파일, paths는 쓸 수 있는 모든 항목(그림 포함), skipped는 건너뛴 이름
#[derive(Serialize)]
pub struct AppImportPick {
    texts: Vec<AppImportText>,
    paths: Vec<String>,
    skipped: Vec<String>,
}

#[derive(Serialize)]
pub struct WorkspaceInfo {
    /// 화면 표시용 폴더 이름과 전체 경로(설정 화면). 프론트엔드가 이 경로로 파일에 접근하지는 않는다.
    name: String,
    path: String,
    /// 쓰기 커맨드에 넘기는 워크스페이스 토큰 (DATA-03)
    token: u64,
}

fn info(ws: &Workspace) -> WorkspaceInfo {
    WorkspaceInfo {
        token: ws.token,
        name: ws
            .root
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        path: ws.root.to_string_lossy().into_owned(),
    }
}

fn config_dir(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn with_workspace<T>(
    state: &State<AppState>,
    f: impl FnOnce(&Workspace) -> Result<T>,
) -> Result<T> {
    let guard = state
        .workspace
        .lock()
        .map_err(|_| StorageError::new("io", "상태 잠금 실패"))?;
    let ws = guard
        .as_ref()
        .ok_or_else(|| StorageError::new("no_workspace", "워크스페이스가 열려 있지 않아요"))?;
    f(ws)
}

/// 최근 워크스페이스 최대 개수 (SHELL-15)
const RECENT_MAX: usize = 10;

/// app-state.json의 최근 워크스페이스 경로 목록
fn recent_paths(saved: Option<&Value>) -> Vec<PathBuf> {
    saved
        .and_then(|v| v.get("recent"))
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(PathBuf::from)
                .collect()
        })
        .unwrap_or_default()
}

/// 연 폴더를 맨 앞에 두고 같은 경로는 한 번만, 최대 RECENT_MAX개
fn push_recent(recent: Vec<PathBuf>, root: &std::path::Path) -> Vec<PathBuf> {
    let mut out = vec![root.to_path_buf()];
    out.extend(recent.into_iter().filter(|p| p != root));
    out.truncate(RECENT_MAX);
    out
}

/// app-state.json의 경로 → 표시 이름 맵 (연 순간에 적어 둔다)
fn recent_names(saved: Option<&Value>) -> serde_json::Map<String, Value> {
    saved
        .and_then(|v| v.get("recentNames"))
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}

/// 워크스페이스 표시 이름: workspace.json의 이름(없으면 폴더 이름). 이미 연 폴더에서만 부른다
fn workspace_display_name(root: &std::path::Path) -> String {
    storage::read_json_opt(&root.join(storage::WORKSPACE_FILE))
        .ok()
        .flatten()
        .and_then(|v| v.get("name").and_then(Value::as_str).map(str::to_string))
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| {
            root.file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default()
        })
}

/// 저장된 최근 목록을 그대로 만든다. 폴더는 읽지 않는다(SYS-09): 없어진 폴더 확인은 고를 때 한다.
fn recent_list(saved: Option<&Value>, current: Option<&std::path::Path>) -> Vec<RecentWorkspace> {
    let names = recent_names(saved);
    recent_paths(saved)
        .into_iter()
        .map(|p| {
            let path = p.to_string_lossy().into_owned();
            let name = names
                .get(&path)
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|n| !n.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| {
                    p.file_name()
                        .map(|n| n.to_string_lossy().into_owned())
                        .unwrap_or_default()
                });
            RecentWorkspace {
                name,
                current: current == Some(p.as_path()),
                path,
            }
        })
        .collect()
}

/// 워크스페이스 이름을 바꾸면 최근 목록의 표시 이름도 맞춘다 (SET-02).
/// 목록에 없는 폴더·이미 같은 이름·저장된 상태가 없을 때는 None (다시 쓸 것이 없다)
fn recent_name_update(saved: &Value, root: &Path, name: &str) -> Option<Value> {
    if !saved.is_object()
        || !recent_paths(Some(saved))
            .iter()
            .any(|p| p.as_path() == root)
    {
        return None;
    }
    let key = root.to_string_lossy().into_owned();
    let mut names = recent_names(Some(saved));
    if names.get(&key).and_then(Value::as_str) == Some(name) {
        return None;
    }
    names.insert(key, json!(name));
    let mut next = saved.clone();
    next["recentNames"] = Value::Object(names);
    Some(next)
}

/// 지금 연 워크스페이스의 최근 목록 이름을 workspace.json 이름에 맞춘다.
/// 메타 저장은 이미 끝났으므로 목록 이름을 못 고쳐도 실패로 돌리지 않는다(다음 저장 때 다시 맞춘다)
fn sync_recent_name(app: &AppHandle, root: &Path) {
    let Ok(dir) = config_dir(app) else { return };
    let file = dir.join(APP_STATE_FILE);
    let Some(saved) = storage::read_json_opt(&file).ok().flatten() else {
        return;
    };
    if let Some(next) = recent_name_update(&saved, root, &workspace_display_name(root)) {
        let _ = storage::write_json(&file, &next);
    }
}

/// 새 워크스페이스 이름 검사 — 폴더 이름이 된다. 빈 이름·경로 문자·숨김 이름은 거절
fn valid_workspace_name(name: &str) -> Option<String> {
    let name = name.trim();
    let bad = name.is_empty()
        || name.chars().count() > 80
        || name.starts_with('.')
        || name
            .chars()
            .any(|c| matches!(c, '/' | '\\' | ':' | '\0') || c.is_control());
    (!bad).then(|| name.to_string())
}

fn set_workspace(app: &AppHandle, state: &State<AppState>, root: PathBuf) -> Result<WorkspaceInfo> {
    let mut ws = Workspace::open(root)?;
    let state_file = config_dir(app)?.join(APP_STATE_FILE);
    let saved = storage::read_json_opt(&state_file).ok().flatten();
    let recent = push_recent(recent_paths(saved.as_ref()), &ws.root);
    // 목록 이름은 연 순간에 적어 둔다. 목록을 그릴 때는 폴더를 읽지 않으려고(SYS-09)
    let mut names = recent_names(saved.as_ref());
    names.insert(
        ws.root.to_string_lossy().into_owned(),
        json!(workspace_display_name(&ws.root)),
    );
    names.retain(|k, _| recent.iter().any(|p| p.to_string_lossy() == k.as_str()));
    storage::write_json(
        &state_file,
        &json!({ "workspace": ws.root, "recent": recent, "recentNames": names }),
    )?;
    ws.token = state.issue_token();
    let out = info(&ws);
    state.store(ws)?;
    Ok(out)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStatus {
    /// 열린 워크스페이스. 없으면 첫 실행 화면(DATA-03)
    workspace: Option<WorkspaceInfo>,
    /// 지난번에 쓰던 폴더가 없어졌을 때 그 경로 (첫 실행 화면에 알림)
    missing_path: Option<String>,
    /// "기본 위치에 만들기"가 쓸 경로: 문서 폴더/CetusNote
    default_path: Option<String>,
}

fn default_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .document_dir()
        .ok()
        .map(|d| d.join(storage::DEFAULT_FOLDER_NAME))
}

/// 지금 열린 워크스페이스. 없으면 지난번 경로를 다시 연다. 그 폴더가 사라졌으면 `missing_path`로 알린다.
#[tauri::command]
pub fn workspace_current(app: AppHandle, state: State<AppState>) -> Result<WorkspaceStatus> {
    let default_path = default_dir(&app).map(|p| p.to_string_lossy().into_owned());
    let status = |workspace, missing_path| WorkspaceStatus {
        workspace,
        missing_path,
        default_path: default_path.clone(),
    };
    if let Some(ws) = state
        .workspace
        .lock()
        .map_err(|_| StorageError::new("io", "상태 잠금 실패"))?
        .as_ref()
    {
        return Ok(status(Some(info(ws)), None));
    }
    let saved = storage::read_json_opt(&config_dir(&app)?.join(APP_STATE_FILE))
        .ok()
        .flatten();
    let Some(path) = saved
        .as_ref()
        .and_then(|v| v.get("workspace"))
        .and_then(Value::as_str)
        .map(PathBuf::from)
    else {
        return Ok(status(None, None));
    };
    if !path.is_dir() {
        return Ok(status(None, Some(path.to_string_lossy().into_owned())));
    }
    Ok(status(Some(set_workspace(&app, &state, path)?), None))
}

/// 기본 위치(문서 폴더/CetusNote)에 워크스페이스를 만들거나 연다(DATA-03).
#[tauri::command]
pub fn workspace_use_default(app: AppHandle, state: State<AppState>) -> Result<WorkspaceInfo> {
    let root = default_dir(&app)
        .ok_or_else(|| StorageError::new("not_found", "문서 폴더를 찾을 수 없어요"))?;
    std::fs::create_dir_all(&root)?;
    set_workspace(&app, &state, root)
}

/// 폴더 선택 대화상자(DATA-03). 취소하면 None.
#[tauri::command]
pub async fn workspace_pick(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceInfo>> {
    let mut dialog = app.dialog().file().set_title("노트를 저장할 폴더 선택");
    if let Ok(docs) = app.path().document_dir() {
        dialog = dialog.set_directory(docs);
    }
    let Some(picked) = dialog.blocking_pick_folder() else {
        return Ok(None);
    };
    let chosen = picked
        .into_path()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    let root = storage::resolve_workspace_dir(&chosen)?;
    set_workspace(&app, &state, root).map(Some)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorkspace {
    /// workspace.json의 이름(없으면 폴더 이름)
    name: String,
    path: String,
    current: bool,
}

/// 최근 연 워크스페이스 (SHELL-15). 저장된 목록만 돌려주고 폴더는 읽지 않는다(SYS-09).
/// 메뉴를 열 때만 부르고, 없어진 폴더는 `workspace_switch`에서 고를 때 확인한다.
#[tauri::command]
pub fn workspace_recent(app: AppHandle, state: State<AppState>) -> Result<Vec<RecentWorkspace>> {
    let saved = storage::read_json_opt(&config_dir(&app)?.join(APP_STATE_FILE))
        .ok()
        .flatten();
    let current = state
        .workspace
        .lock()
        .map_err(|_| StorageError::new("io", "상태 잠금 실패"))?
        .as_ref()
        .map(|ws| ws.root.clone());
    Ok(recent_list(saved.as_ref(), current.as_deref()))
}

/// 최근 목록에 있는 워크스페이스로 바꾼다 (SHELL-15). 목록 밖 경로는 받지 않는다.
#[tauri::command]
pub fn workspace_switch(
    app: AppHandle,
    state: State<AppState>,
    path: String,
) -> Result<WorkspaceInfo> {
    let saved = storage::read_json_opt(&config_dir(&app)?.join(APP_STATE_FILE))
        .ok()
        .flatten();
    let target = PathBuf::from(&path);
    if !recent_paths(saved.as_ref()).contains(&target) {
        return Err(StorageError::new(
            "invalid_path",
            "최근 목록에 없는 폴더예요",
        ));
    }
    if !target.is_dir() {
        return Err(StorageError::new("not_found", "폴더를 찾을 수 없어요"));
    }
    set_workspace(&app, &state, target)
}

/// 최근 목록에서 뺀다 (SHELL-16). 폴더·파일은 건드리지 않는다. 지금 열린 워크스페이스는 뺄 수 없다.
#[tauri::command]
pub fn workspace_forget(app: AppHandle, state: State<AppState>, path: String) -> Result<()> {
    let target = PathBuf::from(&path);
    let current = state
        .workspace
        .lock()
        .map_err(|_| StorageError::new("io", "상태 잠금 실패"))?
        .as_ref()
        .map(|ws| ws.root.clone());
    if current.as_ref() == Some(&target) {
        return Err(StorageError::new(
            "invalid_path",
            "지금 열린 워크스페이스는 목록에서 뺄 수 없어요",
        ));
    }
    let state_file = config_dir(&app)?.join(APP_STATE_FILE);
    let mut saved = storage::read_json_opt(&state_file)?.unwrap_or_else(|| json!({}));
    let recent = forget_recent(recent_paths(Some(&saved)), &target);
    if let Some(obj) = saved.as_object_mut() {
        obj.insert("recent".into(), json!(recent));
    }
    storage::write_json(&state_file, &saved)
}

/// 목록에서 그 경로만 뺀다(순서 유지)
fn forget_recent(recent: Vec<PathBuf>, target: &std::path::Path) -> Vec<PathBuf> {
    recent.into_iter().filter(|p| p != target).collect()
}

/// 새 워크스페이스 (SHELL-15): 위치를 고르는 대화상자 → <위치>/<이름> 폴더를 만들어 연다. 취소하면 None.
#[tauri::command]
pub async fn workspace_create(
    app: AppHandle,
    state: State<'_, AppState>,
    name: String,
) -> Result<Option<WorkspaceInfo>> {
    let name = valid_workspace_name(&name)
        .ok_or_else(|| StorageError::new("invalid_path", "폴더 이름으로 쓸 수 없는 이름이에요"))?;
    let mut dialog = app
        .dialog()
        .file()
        .set_title(format!("“{name}” 워크스페이스를 만들 위치 선택"));
    if let Ok(docs) = app.path().document_dir() {
        dialog = dialog.set_directory(docs);
    }
    let Some(picked) = dialog.blocking_pick_folder() else {
        return Ok(None);
    };
    let parent = picked
        .into_path()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    let root = parent.join(&name);
    if root.exists() {
        return Err(StorageError::new(
            "already_exists",
            "같은 이름의 폴더가 이미 있어요",
        ));
    }
    std::fs::create_dir(&root)?;
    set_workspace(&app, &state, root).map(Some)
}

#[tauri::command]
pub fn workspace_read(state: State<AppState>) -> Result<Option<Value>> {
    with_workspace(&state, Workspace::read_meta)
}

#[tauri::command]
pub fn workspace_write(
    app: AppHandle,
    state: State<AppState>,
    value: Value,
    ws_token: u64,
) -> Result<()> {
    with_workspace_token(&state, ws_token, |ws| {
        ws.write_meta(&value)?;
        sync_recent_name(&app, &ws.root);
        Ok(())
    })
}

#[tauri::command]
pub fn pages_load_all(state: State<AppState>) -> Result<LoadedPages> {
    with_workspace(&state, Workspace::load_all)
}

/// 페이지 구조만 (본문 없음, SYS-10). 본문은 `pages_read`로 연다
#[tauri::command]
pub fn pages_load_meta(state: State<AppState>) -> Result<LoadedPages> {
    with_workspace(&state, Workspace::load_meta)
}

#[tauri::command]
pub fn page_write(state: State<AppState>, page: Value, ws_token: u64) -> Result<()> {
    with_workspace_token(&state, ws_token, |ws| ws.write_page(&page))
}

#[tauri::command]
pub fn page_purge(state: State<AppState>, id: String, ws_token: u64) -> Result<()> {
    with_workspace_token(&state, ws_token, |ws| ws.purge_page(&id))
}

/// 버전 기록(DATA-09): 페이지 전체를 새 버전으로 남긴다. 오래된 것은 50개까지만 둔다
#[tauri::command]
pub fn history_save(
    state: State<AppState>,
    page: Value,
    ws_token: u64,
) -> Result<storage::history::VersionInfo> {
    with_workspace_token(&state, ws_token, |ws| ws.save_version(&page))
}

#[tauri::command]
pub fn history_list(
    state: State<AppState>,
    id: String,
) -> Result<Vec<storage::history::VersionInfo>> {
    with_workspace(&state, |ws| ws.list_versions(&id))
}

#[tauri::command]
pub fn history_read(state: State<AppState>, id: String, version: String) -> Result<Value> {
    with_workspace(&state, |ws| ws.read_version(&id, &version))
}

#[tauri::command]
pub fn history_delete(state: State<AppState>, id: String, ws_token: u64) -> Result<()> {
    with_workspace_token(&state, ws_token, |ws| ws.delete_history(&id))
}

/// 앱 설정(테마, 포인트 색, 사이드바 폭 …). 내용은 프론트엔드가 정한다.
#[tauri::command]
pub fn settings_read(app: AppHandle) -> Result<Option<Value>> {
    storage::read_json_opt(&config_dir(&app)?.join(SETTINGS_FILE))
}

#[tauri::command]
pub fn settings_write(app: AppHandle, value: Value) -> Result<()> {
    if !value.is_object() {
        return Err(StorageError::new(
            "invalid_settings",
            "설정은 객체여야 해요",
        ));
    }
    storage::write_json(&config_dir(&app)?.join(SETTINGS_FILE), &value)
}

/// 앱 아이콘 바꾸기(SET-07): "light"(화이트) 또는 "dark"(블랙)만 받는다. Dock(macOS)·창 아이콘에 건다.
#[tauri::command]
pub fn app_icon_set(app: AppHandle, theme: String) -> Result<()> {
    let bytes = crate::app_icon::png_for(&theme).ok_or_else(|| {
        StorageError::new(
            "invalid_icon",
            "아이콘은 화이트(light)나 블랙(dark)만 골라요",
        )
    })?;
    crate::app_icon::apply(&app, bytes)
}

/// Markdown 내보내기(DATA-04): 저장 대화상자 → 원자적 쓰기. 취소하면 None, 저장하면 파일 이름.
#[tauri::command]
pub async fn export_markdown(
    app: AppHandle,
    file_name: String,
    text: String,
) -> Result<Option<String>> {
    let mut dialog = app
        .dialog()
        .file()
        .set_title("Markdown으로 내보내기")
        .add_filter("Markdown", &["md"])
        .set_file_name(file_name);
    if let Ok(docs) = app.path().document_dir() {
        dialog = dialog.set_directory(docs);
    }
    let Some(picked) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    storage::atomic_write(&path, text.as_bytes())?;
    Ok(path.file_name().map(|n| n.to_string_lossy().into_owned()))
}

/// 워크스페이스 전체 Markdown 내보내기(DATA-10): 폴더 고르기 → 새 폴더에 목록대로 쓴다. 취소하면 None.
/// 목록의 경로는 storage::export가 검사한다. 프론트엔드는 폴더 경로를 받지 않는다.
#[tauri::command]
pub async fn workspace_export_markdown(
    app: AppHandle,
    state: State<'_, AppState>,
    manifest: storage::export::ExportManifest,
) -> Result<Option<storage::export::ExportReport>> {
    let root = workspace_root(&state)?;
    let mut dialog = app.dialog().file().set_title("Markdown으로 모두 내보내기");
    if let Ok(docs) = app.path().document_dir() {
        dialog = dialog.set_directory(docs);
    }
    let Some(picked) = dialog.blocking_pick_folder() else {
        return Ok(None);
    };
    let parent = picked
        .into_path()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    let report = storage::export::write_export(&root, &parent, &manifest)?;
    *state
        .last_export
        .lock()
        .map_err(|_| StorageError::new("io", "내보내기 상태를 저장하지 못했어요"))? =
        Some(report.path.clone());
    Ok(Some(report))
}

/// 마지막 워크스페이스 Markdown 내보내기 폴더를 Finder로 연다(DATA-10)
#[tauri::command]
pub fn workspace_export_reveal(app: AppHandle, state: State<AppState>) -> Result<()> {
    use tauri_plugin_opener::OpenerExt;
    let dir = state
        .last_export
        .lock()
        .map_err(|_| StorageError::new("io", "내보내기 상태를 읽지 못했어요"))?
        .clone()
        .ok_or_else(|| StorageError::new("not_found", "내보낸 폴더가 없어요"))?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| StorageError::new("io", e.to_string()))
}

/// 문서 가져오기(DATA-08)에서 한 번에 고를 수 있는 파일 수 · 글 파일 크기 · 이진 파일(docx·pdf) 크기
const IMPORT_MAX_FILES: usize = 100;
const IMPORT_MAX_TEXT_BYTES: u64 = 5 * 1024 * 1024;
const IMPORT_MAX_BINARY_BYTES: u64 = 25 * 1024 * 1024;
/// 글로 바로 읽는 형식 · 바이트를 프런트엔드가 변환하는 형식(docx) · PDF 글(pdf_text)
const TEXT_EXTS: [&str; 5] = ["md", "markdown", "txt", "html", "htm"];
const BINARY_EXTS: [&str; 2] = ["docx", "pdf"];
const IMAGE_EXTS: [&str; 6] = ["png", "jpg", "jpeg", "gif", "webp", "avif"];

#[derive(Serialize)]
pub struct DocumentFile {
    /// 고른 파일의 번호(document_bytes · document_pdf_text에 돌려준다). 경로는 프런트엔드에 주지 않는다
    id: String,
    /// 확장자를 뺀 파일 이름 (제목이 없을 때 쓴다)
    name: String,
    /// 소문자 확장자 (md · txt · html · docx · pdf …)
    ext: String,
    /// 파일이 있는 폴더 — 상대 경로 이미지를 읽을 때 document_image에 돌려준다
    dir: String,
    /// 글 형식(md·txt·html)만 담는다. 나머지는 null
    text: Option<String>,
}

#[derive(Serialize)]
pub struct DocumentPick {
    files: Vec<DocumentFile>,
    /// 너무 크거나 읽지 못하거나 지원하지 않는 파일 이름
    skipped: Vec<String>,
}

/// 고른 파일 번호 → 실제 경로. 이 목록에 없는 번호는 거절한다
fn picked_path(state: &AppState, id: &str) -> Result<PathBuf> {
    let bad = || StorageError::new("not_found", "가져올 파일을 찾지 못했어요");
    let index: usize = id.parse().map_err(|_| bad())?;
    state
        .import_files
        .lock()
        .map_err(|_| StorageError::new("io", "가져오기 상태를 읽지 못했어요"))?
        .get(index)
        .cloned()
        .ok_or_else(bad)
}

/// 문서 가져오기(DATA-08): 파일 고르기(여러 개) → md·txt·html은 글을, docx·pdf는 번호만 돌려준다.
/// 취소하면 None. 고른 파일의 폴더를 기억해 두고, document_image는 그 폴더 안의 이미지만 읽는다.
#[tauri::command]
pub async fn document_pick(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<DocumentPick>> {
    let mut dialog = app.dialog().file().set_title("문서 가져오기").add_filter(
        "문서",
        &["md", "markdown", "txt", "html", "htm", "docx", "pdf"],
    );
    if let Ok(docs) = app.path().document_dir() {
        dialog = dialog.set_directory(docs);
    }
    let Some(picked) = dialog.blocking_pick_files() else {
        return Ok(None);
    };
    let mut files = Vec::new();
    let mut skipped = Vec::new();
    let mut dirs = Vec::new();
    let mut paths = Vec::new();
    // 이번 고르기의 첫 번호: 앞선 고르기에서 기억한 파일 수 다음부터
    let base = state_offset(&state)?;
    for item in picked.into_iter().take(IMPORT_MAX_FILES) {
        let Ok(path) = item.into_path() else { continue };
        let name = path
            .file_stem()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_ascii_lowercase())
            .unwrap_or_default();
        let is_text = TEXT_EXTS.contains(&ext.as_str());
        if !is_text && !BINARY_EXTS.contains(&ext.as_str()) {
            skipped.push(name);
            continue;
        }
        let limit = if is_text {
            IMPORT_MAX_TEXT_BYTES
        } else {
            IMPORT_MAX_BINARY_BYTES
        };
        let size_ok = std::fs::metadata(&path)
            .ok()
            .is_some_and(|m| m.is_file() && m.len() <= limit);
        let text = if is_text && size_ok {
            std::fs::read(&path)
                .ok()
                .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        } else {
            None
        };
        let dir = path.parent().and_then(|d| d.canonicalize().ok());
        let readable = size_ok && (!is_text || text.is_some());
        let (true, Some(dir)) = (readable, dir) else {
            skipped.push(name);
            continue;
        };
        files.push(DocumentFile {
            id: (base + paths.len()).to_string(),
            name,
            ext,
            dir: dir.to_string_lossy().into_owned(),
            text,
        });
        paths.push(path);
        dirs.push(dir);
    }
    {
        let mut list = state
            .import_files
            .lock()
            .map_err(|_| StorageError::new("io", "가져오기 상태를 읽지 못했어요"))?;
        list.extend(paths);
    }
    state
        .import_dirs
        .lock()
        .map_err(|_| StorageError::new("io", "가져오기 상태를 읽지 못했어요"))?
        .extend(dirs);
    Ok(Some(DocumentPick { files, skipped }))
}

/// 지금까지 기억한 파일 수. 번호는 여러 번 고르기에 걸쳐 이어진다
fn state_offset(state: &AppState) -> Result<usize> {
    state
        .import_files
        .lock()
        .map(|list| list.len())
        .map_err(|_| StorageError::new("io", "가져오기 상태를 읽지 못했어요"))
}

/// 고른 docx 파일의 바이트(DATA-08). 프런트엔드가 mammoth로 HTML을 만든다
#[tauri::command]
pub fn document_bytes(state: State<AppState>, id: String) -> Result<tauri::ipc::Response> {
    let path = picked_path(&state, &id)?;
    let meta = std::fs::metadata(&path)?;
    if meta.len() > IMPORT_MAX_BINARY_BYTES {
        return Err(StorageError::new("too_large", "파일이 25MB보다 커요"));
    }
    Ok(tauri::ipc::Response::new(std::fs::read(&path)?))
}

/// 고른 PDF의 글자와 제목(DATA-08). 글자만 가져온다
#[tauri::command]
pub fn document_pdf_text(state: State<AppState>, id: String) -> Result<crate::pdf::PdfText> {
    let path = picked_path(&state, &id)?;
    let meta = std::fs::metadata(&path)?;
    if meta.len() > IMPORT_MAX_BINARY_BYTES {
        return Err(StorageError::new("too_large", "파일이 25MB보다 커요"));
    }
    let bytes = std::fs::read(&path)?;
    crate::pdf::extract_text(&bytes).map_err(|msg| StorageError::new("io", msg))
}

/// 가져온 문서의 상대 경로 이미지 → 이 페이지의 assets로 복사(DATA-08).
/// `dir`은 document_pick이 돌려준 폴더여야 하고, 이미지는 그 폴더 안(하위 폴더 포함)에 있어야 한다.
#[tauri::command]
pub fn document_image(
    state: State<AppState>,
    page_id: String,
    dir: String,
    src: String,
) -> Result<String> {
    let dir = PathBuf::from(dir);
    let allowed = state
        .import_dirs
        .lock()
        .map_err(|_| StorageError::new("io", "가져오기 상태를 읽지 못했어요"))?
        .contains(&dir);
    if !allowed {
        return Err(StorageError::new(
            "forbidden",
            "가져온 파일의 폴더가 아니에요",
        ));
    }
    let path = resolve_import_image(&dir, &src)?;
    let meta = std::fs::metadata(&path)?;
    if meta.len() > storage::ASSET_MAX_BYTES as u64 {
        return Err(StorageError::new("too_large", "이미지가 25MB보다 커요"));
    }
    let bytes = std::fs::read(&path)?;
    with_workspace(&state, |ws| ws.write_asset(&page_id, &bytes))
}

/// 다른 앱에서 가져오기(DATA-11): zip 파일 또는 폴더를 고르고 목록을 만든다. 취소하면 None.
/// kind는 "zip" 또는 "folder". 목록 만들기는 백그라운드 스레드에서 한다(화면이 멈추지 않게).
#[tauri::command]
pub async fn app_import_pick(
    app: AppHandle,
    state: State<'_, AppState>,
    kind: String,
) -> Result<Option<AppImportPick>> {
    let picked = if kind == "folder" {
        app.dialog()
            .file()
            .set_title("다른 앱에서 가져오기")
            .blocking_pick_folder()
    } else {
        app.dialog()
            .file()
            .set_title("다른 앱에서 가져오기")
            .add_filter("zip", &["zip"])
            .blocking_pick_file()
    };
    let Some(picked) = picked else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|_| StorageError::new("invalid_path", "고른 위치를 읽지 못했어요"))?;
    let source = if kind == "folder" {
        app_import::Source::Folder(path)
    } else {
        app_import::Source::Zip(path)
    };
    let job = source.clone();
    let listing = match tauri::async_runtime::spawn_blocking(move || match &job {
        app_import::Source::Zip(p) => app_import::list_zip(p),
        app_import::Source::Folder(p) => app_import::list_folder(p),
    })
    .await
    {
        Ok(listing) => listing?,
        Err(e) => return Err(StorageError::new("io", e.to_string())),
    };
    let paths = listing.entries.iter().map(|e| e.path.clone()).collect();
    let texts = listing
        .texts
        .iter()
        .map(|(path, text)| AppImportText {
            path: path.clone(),
            text: text.clone(),
        })
        .collect();
    let skipped = listing.skipped.clone();
    let entries = listing
        .entries
        .into_iter()
        .map(|e| (e.path.clone(), e))
        .collect();
    *state
        .app_import
        .lock()
        .map_err(|_| StorageError::new("io", "가져오기 상태를 읽지 못했어요"))? =
        Some(ImportSession { source, entries });
    Ok(Some(AppImportPick {
        texts,
        paths,
        skipped,
    }))
}

/// 가져오기 목록에 있는 항목 하나의 바이트(그림 등). path는 목록의 상대 경로
#[tauri::command]
pub async fn app_import_bytes(
    state: State<'_, AppState>,
    path: String,
) -> Result<tauri::ipc::Response> {
    let (source, entry) = {
        let guard = state
            .app_import
            .lock()
            .map_err(|_| StorageError::new("io", "가져오기 상태를 읽지 못했어요"))?;
        let session = guard
            .as_ref()
            .ok_or_else(|| StorageError::new("not_found", "가져올 원본이 없어요"))?;
        let entry = session
            .entries
            .get(&path)
            .cloned()
            .ok_or_else(|| StorageError::new("not_found", "가져올 파일을 찾지 못했어요"))?;
        (session.source.clone(), entry)
    };
    let bytes =
        match tauri::async_runtime::spawn_blocking(move || app_import::read_entry(&source, &entry))
            .await
        {
            Ok(bytes) => bytes?,
            Err(e) => return Err(StorageError::new("io", e.to_string())),
        };
    Ok(tauri::ipc::Response::new(bytes))
}

/// 마크다운 속 상대 주소(`img/a%20b.png`, `./a.png`)를 dir 기준 실제 경로로. 폴더 밖·이미지가 아니면 거절
fn resolve_import_image(dir: &Path, src: &str) -> Result<PathBuf> {
    let bad = || StorageError::new("invalid_asset", "가져올 수 없는 이미지 경로예요");
    let base = url::Url::from_directory_path(dir).map_err(|_| bad())?;
    let joined = base.join(src.trim()).map_err(|_| bad())?;
    if joined.scheme() != "file" {
        return Err(bad());
    }
    let path = joined.to_file_path().map_err(|_| bad())?;
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    if !IMAGE_EXTS.contains(&ext.as_str()) {
        return Err(bad());
    }
    let real = path
        .canonicalize()
        .map_err(|_| StorageError::new("not_found", "이미지 파일이 없어요"))?;
    if !real.starts_with(dir) {
        return Err(bad());
    }
    Ok(real)
}

/// 이미지 저장(EDIT-14, PAGE-03). 본문은 JSON이 아니라 바이트 그대로(`x-page-id` 헤더로 페이지).
/// 종류는 내용으로 판별하고 `assets/<id>/img-….<확장자>` 상대 경로를 돌려준다.
#[tauri::command]
pub fn asset_write(state: State<AppState>, request: tauri::ipc::Request<'_>) -> Result<String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err(StorageError::new(
            "invalid_asset",
            "이미지 바이트가 필요해요",
        ));
    };
    let page_id = request
        .headers()
        .get("x-page-id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| StorageError::new("invalid_id", "페이지 id가 없어요"))?;
    let ws_token = request
        .headers()
        .get("x-workspace-token")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
        .ok_or_else(|| StorageError::new("invalid_asset", "워크스페이스 토큰이 없어요"))?;
    with_workspace_token(&state, ws_token, |ws| ws.write_asset(page_id, bytes))
}

/// 이미지 읽기: 바이트 그대로 돌려준다(프론트엔드가 blob URL로 그림)
#[tauri::command]
pub fn asset_read(state: State<AppState>, path: String) -> Result<tauri::ipc::Response> {
    with_workspace(&state, |ws| ws.read_asset(&path)).map(tauri::ipc::Response::new)
}

/// 이미지 고르기 대화상자 → 그 페이지의 assets에 복사. 취소하면 None.
#[tauri::command]
pub async fn asset_pick(
    app: AppHandle,
    state: State<'_, AppState>,
    page_id: String,
) -> Result<Option<String>> {
    let mut dialog = app
        .dialog()
        .file()
        .set_title("이미지 선택")
        .add_filter("이미지", &["png", "jpg", "jpeg", "gif", "webp", "avif"]);
    if let Ok(dir) = app.path().picture_dir() {
        dialog = dialog.set_directory(dir);
    }
    let Some(picked) = dialog.blocking_pick_file() else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    let meta = std::fs::metadata(&path)?;
    if meta.len() > storage::ASSET_MAX_BYTES as u64 {
        return Err(StorageError::new("too_large", "이미지가 25MB보다 커요"));
    }
    let bytes = std::fs::read(&path)?;
    with_workspace(&state, |ws| ws.write_asset(&page_id, &bytes)).map(Some)
}

/// 이미지 링크 내려받기 (PAGE-10 업로드 탭 · EDIT-24 붙여 넣은 웹 이미지) → 그 페이지의 assets에 저장.
/// http·https만, 20초·리다이렉트 5번·25MB까지. 종류는 내용으로 판별한다(write_asset).
/// `public_only`(붙여 넣은 웹 글): 주소가 내부망(루프백·사설·링크 로컬 등)을 가리키면 거절한다.
/// 리다이렉트도 한 번씩 따라가며 매번 검사한다.
#[tauri::command]
pub async fn asset_fetch(
    state: State<'_, AppState>,
    page_id: String,
    url: String,
    public_only: Option<bool>,
) -> Result<String> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) {
        return Err(StorageError::new(
            "fetch_failed",
            "http·https 링크만 가져올 수 있어요",
        ));
    }
    let public_only = public_only.unwrap_or(false);
    let bytes = tauri::async_runtime::spawn_blocking(move || download(&url, public_only))
        .await
        .map_err(|e| StorageError::new("fetch_failed", e.to_string()))??;
    with_workspace(&state, |ws| ws.write_asset(&page_id, &bytes))
}

const MAX_REDIRECTS: u32 = 5;

fn fetch_error(e: impl std::fmt::Display) -> StorageError {
    StorageError::new("fetch_failed", e.to_string())
}

fn download(url: &str, public_only: bool) -> Result<Vec<u8>> {
    // 내부망 검사를 할 때는 리다이렉트를 직접 따라간다(건너뛴 주소마다 검사)
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(std::time::Duration::from_secs(20)))
        .max_redirects(if public_only { 0 } else { MAX_REDIRECTS })
        .max_redirects_will_error(!public_only)
        .build();
    let agent: ureq::Agent = config.into();
    let mut current = url::Url::parse(url).map_err(fetch_error)?;
    for _ in 0..=MAX_REDIRECTS {
        if public_only {
            check_public(&current)?;
        }
        let mut res = agent
            .get(current.as_str())
            .header("User-Agent", "CetusNote")
            .header("Accept", "image/*")
            .call()
            .map_err(fetch_error)?;
        if public_only && res.status().is_redirection() {
            let location = res
                .headers()
                .get("location")
                .and_then(|v| v.to_str().ok())
                .ok_or_else(|| fetch_error("리다이렉트 주소가 없어요"))?;
            current = current.join(location).map_err(fetch_error)?;
            continue;
        }
        return res
            .body_mut()
            .with_config()
            .limit(storage::ASSET_MAX_BYTES as u64)
            .read_to_vec()
            .map_err(|e| match e {
                ureq::Error::BodyExceedsLimit(_) => {
                    StorageError::new("too_large", "이미지가 25MB보다 커요")
                }
                e => fetch_error(e),
            });
    }
    Err(fetch_error("리다이렉트가 너무 많아요"))
}

/// 주소의 호스트가 공개 인터넷 주소로만 풀리는지. 이름은 DNS로 풀어 모든 주소를 본다
fn check_public(url: &url::Url) -> Result<()> {
    use std::net::ToSocketAddrs;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(fetch_error("http·https 링크만 가져올 수 있어요"));
    }
    let host = url
        .host_str()
        .ok_or_else(|| fetch_error("주소에 호스트가 없어요"))?;
    let host = host.trim_start_matches('[').trim_end_matches(']');
    let port = url.port_or_known_default().unwrap_or(80);
    let addrs: Vec<_> = (host, port)
        .to_socket_addrs()
        .map_err(fetch_error)?
        .collect();
    if addrs.is_empty() || addrs.iter().any(|a| !is_public_ip(a.ip())) {
        return Err(fetch_error("내부 네트워크 주소의 이미지는 가져오지 않아요"));
    }
    Ok(())
}

fn is_public_ip(ip: std::net::IpAddr) -> bool {
    use std::net::IpAddr;
    match ip {
        IpAddr::V4(v) => {
            let [a, b, ..] = v.octets();
            !(v.is_private()
                || v.is_loopback()
                || v.is_link_local()
                || v.is_unspecified()
                || v.is_broadcast()
                || v.is_documentation()
                || v.is_multicast()
                || a == 0
                || (a == 100 && (b & 0xc0) == 64) // CGNAT 100.64/10
                || (a == 198 && (b & 0xfe) == 18)) // 벤치마크 198.18/15
        }
        IpAddr::V6(v) => {
            if let Some(m) = v.to_ipv4_mapped() {
                return is_public_ip(IpAddr::V4(m));
            }
            let s = v.segments()[0];
            !(v.is_loopback()
                || v.is_unspecified()
                || v.is_multicast()
                || (s & 0xfe00) == 0xfc00 // 고유 로컬 fc00::/7
                || (s & 0xffc0) == 0xfe80) // 링크 로컬 fe80::/10
        }
    }
}

// ── 백업 (DATA-05) ──────────────────────────────────────────

/// 지금 워크스페이스 경로. 오래 걸리는 백업 중에 다른 저장을 막지 않도록 잠금 밖에서 쓴다
fn workspace_root(state: &State<AppState>) -> Result<PathBuf> {
    with_workspace(state, |ws| Ok(ws.root.clone()))
}

/// 백업 내보내기: 저장 대화상자에서 고른 곳에 zip. 취소하면 None, 아니면 파일 이름
#[tauri::command]
pub async fn backup_export(
    app: AppHandle,
    state: State<'_, AppState>,
    file_name: String,
    created_at: String,
) -> Result<Option<String>> {
    let root = workspace_root(&state)?;
    let mut dialog = app
        .dialog()
        .file()
        .set_title("백업 내보내기")
        .add_filter("Cetus Note 백업", &["zip"])
        .set_file_name(file_name);
    if let Ok(docs) = app.path().document_dir() {
        dialog = dialog.set_directory(docs);
    }
    let Some(picked) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    if path.starts_with(&root) && !path.starts_with(root.join(storage::backup::AUTO_DIR)) {
        // 워크스페이스 안(pages/ 등)에 두면 다음 백업에 섞이거나 폴더를 어지럽힌다
        return Err(StorageError::new(
            "invalid_path",
            "워크스페이스 폴더 밖에 저장해 주세요",
        ));
    }
    storage::backup::create_backup(&root, &path, &created_at)?;
    Ok(path.file_name().map(|n| n.to_string_lossy().into_owned()))
}

/// 하루 한 번 자동 백업(.backups/). 오늘 것이 이미 있으면 None
#[tauri::command]
pub async fn backup_auto(
    state: State<'_, AppState>,
    today: String,
    created_at: String,
) -> Result<Option<String>> {
    let root = workspace_root(&state)?;
    // 압축은 워크스페이스가 크면 수백 ms 걸리므로 비동기 워커를 붙잡지 않도록 블로킹 풀에서 돌린다 (SYS-10)
    tauri::async_runtime::spawn_blocking(move || {
        storage::backup::auto_backup(&root, &today, &created_at)
    })
    .await
    .map_err(|e| StorageError::new("io", e.to_string()))?
}

/// 자동 백업 목록(최근 것이 앞)
#[tauri::command]
pub fn backup_list(state: State<AppState>) -> Result<Vec<String>> {
    storage::backup::auto_list(&workspace_root(&state)?)
}

/// 자동 백업 폴더를 Finder로 연다(없으면 만든다)
#[tauri::command]
pub fn backup_reveal(app: AppHandle, state: State<AppState>) -> Result<()> {
    use tauri_plugin_opener::OpenerExt;
    let dir = workspace_root(&state)?.join(storage::backup::AUTO_DIR);
    std::fs::create_dir_all(&dir)?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| StorageError::new("io", e.to_string()))
}

/// 백업 불러오기: zip을 고르고, 풀 폴더를 고르면 거기에 풀어 그 폴더를 워크스페이스로 연다.
/// 지금 워크스페이스는 건드리지 않는다. 고른 폴더에 다른 파일이 있으면 그 안에 새 폴더를 만든다
#[tauri::command]
pub async fn backup_restore(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceInfo>> {
    let Some(zip) = app
        .dialog()
        .file()
        .set_title("불러올 백업 선택")
        .add_filter("Cetus Note 백업", &["zip"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let zip = zip
        .into_path()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    let mut dialog = app.dialog().file().set_title("백업을 풀 폴더 선택");
    if let Ok(docs) = app.path().document_dir() {
        dialog = dialog.set_directory(docs);
    }
    let Some(picked) = dialog.blocking_pick_folder() else {
        return Ok(None);
    };
    let chosen = picked
        .into_path()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    let dest = storage::backup::restore_dir(&chosen)?;
    storage::backup::restore_backup(&zip, &dest)?;
    set_workspace(&app, &state, dest).map(Some)
}

// ── PDF 내보내기 (DATA-06) ──────────────────────────────────

/// 쪽 하나를 찍는 제한 시간. 넘기면 실패로 돌려보내 미리보기가 무한 로딩에 빠지지 않게 한다
const PDF_PAGE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);
/// 쪽들을 한 파일로 합치는 제한 시간
const PDF_FINISH_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

/// 내보내기 한 번(run)의 쪽 조각 폴더. 앱 캐시 안이라 사용자 워크스페이스는 건드리지 않는다
fn pdf_parts_dir(app: &AppHandle, run: u32) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    Ok(dir.join("pdf-parts").join(run.to_string()))
}

/// 인쇄 전용 화면의 rect 한 쪽을 PDF 조각(index.pdf)으로 쓴다. 프론트엔드가 쪽마다 한 번씩 부른다.
/// WKWebView 작업은 메인 스레드에서 시작하고 기다리지 않는다(완료는 콜백). 제한 시간을 넘기면 실패한다.
#[tauri::command]
pub async fn pdf_page(
    app: AppHandle,
    window: tauri::WebviewWindow,
    run: u32,
    index: u32,
    rect: crate::pdf::PageRect,
) -> Result<()> {
    let dir = pdf_parts_dir(&app, run)?;
    if index == 0 {
        // 새 내보내기는 지난번에 실패해 남은 조각을 지운다
        if let Some(parts_root) = dir.parent() {
            let _ = std::fs::remove_dir_all(parts_root);
        }
    }
    std::fs::create_dir_all(&dir)?;
    let part = dir.join(format!("{index}.pdf"));
    let (tx, rx) = std::sync::mpsc::channel::<std::result::Result<(), String>>();
    let fail_tx = tx.clone();
    window
        .with_webview(move |webview| {
            let done_tx = tx.clone();
            let target = part.clone();
            let started = crate::pdf::capture_page(webview, rect, move |result| {
                let outcome = result.and_then(|bytes| {
                    std::fs::write(&target, bytes).map_err(|_| "쪽 PDF를 쓰지 못했어요".to_string())
                });
                let _ = done_tx.send(outcome);
            });
            if let Err(message) = started {
                let _ = fail_tx.send(Err(message));
            }
        })
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    let received = tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(PDF_PAGE_TIMEOUT))
        .await
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    let outcome =
        received.map_err(|_| StorageError::new("io", "PDF 쪽을 만들지 못했어요(시간 초과)"))?;
    outcome.map_err(|m| StorageError::new("io", m))?;
    Ok(())
}

/// 찍어 둔 쪽 조각 count개를 순서대로 합쳐 미리보기 PDF로 앱 캐시에 쓰고 바이트를 돌려준다.
/// 마지막 파일은 AppState에 남겨 pdf_save가 쓴다. 조각 폴더는 지운다.
#[tauri::command]
pub async fn pdf_finish(
    app: AppHandle,
    state: State<'_, AppState>,
    run: u32,
    count: u32,
) -> Result<u32> {
    if count == 0 {
        return Err(StorageError::new("io", "찍은 쪽이 없어요").into());
    }
    let dir = pdf_parts_dir(&app, run)?;
    let parts: Vec<PathBuf> = (0..count).map(|i| dir.join(format!("{i}.pdf"))).collect();
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(crate::pdf::merge_pages(&parts));
    })
    .map_err(|e| StorageError::new("io", e.to_string()))?;
    let merged = tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(PDF_FINISH_TIMEOUT))
        .await
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    let bytes = merged
        .map_err(|_| StorageError::new("io", "PDF를 합치지 못했어요(시간 초과)"))?
        .map_err(|m| StorageError::new("io", m))?;
    let _ = std::fs::remove_dir_all(&dir);
    if let Some(parts_root) = dir.parent() {
        // 비어 있으면 조각 상위 폴더도 지운다(remove_dir은 빈 폴더만 지운다)
        let _ = std::fs::remove_dir(parts_root);
    }
    let out_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    let path = out_dir.join("pdf-export.pdf");
    storage::atomic_write(&path, &bytes)?;
    *state
        .last_pdf
        .lock()
        .map_err(|_| StorageError::new("io", "PDF 상태를 저장하지 못했어요"))? = Some(path);
    Ok(count)
}

/// 미리보기 PDF의 쪽 index를 PNG로 그려 돌려준다(DATA-06). 화면에만 보이는 그림이고 저장본은 벡터 그대로다.
#[tauri::command]
pub async fn pdf_preview_page(
    app: AppHandle,
    state: State<'_, AppState>,
    index: u32,
    width: u32,
) -> Result<tauri::ipc::Response> {
    let src = state
        .last_pdf
        .lock()
        .map_err(|_| StorageError::new("io", "PDF 상태를 읽지 못했어요"))?
        .clone()
        .ok_or_else(|| StorageError::new("not_found", "먼저 PDF 미리보기를 만들어 주세요"))?;
    let width = f64::from(width.clamp(200, 2400));
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(crate::pdf::render_page_png(&src, index as usize, width));
    })
    .map_err(|e| StorageError::new("io", e.to_string()))?;
    let png = tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(PDF_PAGE_TIMEOUT))
        .await
        .map_err(|e| StorageError::new("io", e.to_string()))?
        .map_err(|_| StorageError::new("io", "쪽 그림을 그리지 못했어요(시간 초과)"))?
        .map_err(|m| StorageError::new("io", m))?;
    Ok(tauri::ipc::Response::new(png))
}

/// 제한 시간: 문서 전체를 인쇄 엔진이 찍는 시간(Windows·Linux, SYS-08)
const PDF_PRINT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(60);

/// Windows·Linux: 인쇄 화면(html[data-pdf-capture]) 전체를 OS 인쇄 엔진으로 PDF 하나로 쓴다(SYS-08).
/// 미리보기 쪽 그림은 프론트엔드가 pdf.js로 그린다. macOS는 쪽마다 찍는 pdf_page 경로를 쓴다.
#[tauri::command]
pub async fn pdf_print_document(
    app: AppHandle,
    state: State<'_, AppState>,
    window: tauri::WebviewWindow,
    run: u32,
) -> Result<()> {
    if cfg!(target_os = "macos") {
        return Err(StorageError::new("io", "macOS는 쪽마다 찍어요").into());
    }
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    // 실행 번호가 같은 지난 파일을 지운다. 이번 인쇄가 실패하면 미리보기도 남지 않는다
    let path = dir.join(format!("pdf-export-{run}.pdf"));
    let _ = std::fs::remove_file(&path);
    let (tx, rx) = std::sync::mpsc::channel::<std::result::Result<(), String>>();
    let target = path.clone();
    window
        .with_webview(move |webview| crate::pdf::print_document(webview, target, tx))
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    let received = tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(PDF_PRINT_TIMEOUT))
        .await
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    received
        .map_err(|_| StorageError::new("io", "PDF를 만들지 못했어요(시간 초과)"))?
        .map_err(|m| StorageError::new("io", m))?;
    *state
        .last_pdf
        .lock()
        .map_err(|_| StorageError::new("io", "PDF 상태를 저장하지 못했어요"))? = Some(path);
    Ok(())
}

/// 마지막으로 만든 미리보기 PDF의 바이트(Windows·Linux의 pdf.js 미리보기·글자 확인용, SYS-08)
#[tauri::command]
pub fn pdf_export_bytes(state: State<AppState>) -> Result<tauri::ipc::Response> {
    let src = state
        .last_pdf
        .lock()
        .map_err(|_| StorageError::new("io", "PDF 상태를 읽지 못했어요"))?
        .clone()
        .ok_or_else(|| StorageError::new("not_found", "먼저 PDF 미리보기를 만들어 주세요"))?;
    let bytes = std::fs::read(&src).map_err(|_| StorageError::new("io", "PDF를 읽지 못했어요"))?;
    Ok(tauri::ipc::Response::new(bytes))
}

/// PDF 저장: 저장 대화상자에서 고른 곳에 마지막으로 만든 PDF를 쓴다. 취소하면 None, 아니면 파일 이름
#[tauri::command]
pub async fn pdf_save(
    app: AppHandle,
    state: State<'_, AppState>,
    file_name: String,
) -> Result<Option<String>> {
    let src = state
        .last_pdf
        .lock()
        .map_err(|_| StorageError::new("io", "PDF 상태를 읽지 못했어요"))?
        .clone()
        .ok_or_else(|| StorageError::new("not_found", "먼저 PDF 미리보기를 만들어 주세요"))?;
    let mut dialog = app
        .dialog()
        .file()
        .set_title("PDF로 저장")
        .add_filter("PDF", &["pdf"])
        .set_file_name(file_name);
    if let Ok(docs) = app.path().document_dir() {
        dialog = dialog.set_directory(docs);
    }
    let Some(picked) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|e| StorageError::new("io", e.to_string()))?;
    let bytes = std::fs::read(&src)?;
    storage::atomic_write(&path, &bytes)?;
    Ok(path.file_name().map(|n| n.to_string_lossy().into_owned()))
}

// ── 외부 변경 감지 (DATA-07) ────────────────────────────────

/// 지난번 이후 바깥(다른 앱·동기화 도구)에서 바뀐 페이지·workspace.json
#[tauri::command]
pub fn workspace_scan(state: State<AppState>) -> Result<storage::watch::Changes> {
    with_workspace(&state, Workspace::scan_changes)
}

/// 페이지 몇 개 다시 읽기. 없어진 파일은 빠지고, 읽지 못한 파일은 errors로
#[tauri::command]
pub fn pages_read(state: State<AppState>, ids: Vec<String>) -> Result<LoadedPages> {
    with_workspace(&state, |ws| {
        let mut pages = Vec::new();
        let mut errors = Vec::new();
        for id in ids.iter().take(10_000) {
            match ws.read_page(id) {
                Ok(Some(p)) => pages.push(p),
                Ok(None) => {}
                Err(e) => errors.push(storage::LoadError {
                    file: format!("{id}.json"),
                    message: e.message,
                }),
            }
        }
        Ok(LoadedPages { pages, errors })
    })
}

#[cfg(test)]
mod tests {
    /// DATA-03: 워크스페이스를 바꾸면 옛 토큰의 쓰기는 새 폴더에 닿지 않고 stale_workspace로 거절된다
    #[test]
    fn write_with_stale_workspace_token_is_rejected() {
        use super::{AppState, with_workspace_token};
        use crate::storage::Workspace;
        let state = AppState::default();
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        let ta = state
            .install(Workspace::open(a.path().to_path_buf()).unwrap())
            .unwrap();
        let tb = state
            .install(Workspace::open(b.path().to_path_buf()).unwrap())
            .unwrap();
        assert_ne!(ta, tb, "워크스페이스마다 새 토큰을 받아야 한다");
        let err = with_workspace_token(&state, ta, |_| Ok(()))
            .err()
            .expect("옛 토큰은 거절돼야 한다");
        assert_eq!(err.code, "stale_workspace");
        with_workspace_token(&state, tb, |_| Ok(())).expect("현재 토큰은 통과해야 한다");
        // 같은 폴더를 다시 열어도 새 토큰이므로 옛 토큰은 여전히 거절된다 (A→B→A 되돌아오기)
        let ta2 = state
            .install(Workspace::open(a.path().to_path_buf()).unwrap())
            .unwrap();
        assert_eq!(
            with_workspace_token(&state, ta, |_| Ok(()))
                .err()
                .expect("되돌아온 뒤에도 옛 토큰은 거절")
                .code,
            "stale_workspace"
        );
        with_workspace_token(&state, ta2, |_| Ok(())).expect("새 토큰은 통과");
    }

    #[test]
    fn import_image_paths_stay_in_folder() {
        use super::resolve_import_image;
        let root = tempfile::tempdir().unwrap();
        let dir = root.path().join("notes");
        std::fs::create_dir_all(dir.join("img")).unwrap();
        std::fs::write(dir.join("img/a b.png"), b"x").unwrap();
        std::fs::write(dir.join("c.png"), b"x").unwrap();
        std::fs::write(dir.join("note.md"), b"x").unwrap();
        std::fs::write(root.path().join("outside.png"), b"x").unwrap();
        let dir = dir.canonicalize().unwrap();
        // 하위 폴더 · 공백(%20) · ./ 는 된다
        assert!(resolve_import_image(&dir, "img/a%20b.png").is_ok());
        assert!(resolve_import_image(&dir, "./c.png").is_ok());
        // 폴더 밖 · 절대 경로 · 다른 스킴 · 이미지가 아닌 파일 · 없는 파일은 거절
        for bad in [
            "../outside.png",
            "img/../../outside.png",
            "/etc/hosts",
            "https://example.com/a.png",
            "note.md",
            "missing.png",
        ] {
            assert!(resolve_import_image(&dir, bad).is_err(), "{bad}");
        }
        let outside = root.path().join("outside.png").canonicalize().unwrap();
        assert!(resolve_import_image(&dir, &format!("file://{}", outside.display())).is_err());
    }

    #[test]
    fn public_ip_rules() {
        use super::is_public_ip;
        for ip in ["8.8.8.8", "1.1.1.1", "2606:4700::1111"] {
            assert!(is_public_ip(ip.parse().unwrap()), "{ip}");
        }
        for ip in [
            "127.0.0.1",
            "10.0.0.1",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "0.0.0.0",
            "100.64.0.1",
            "::1",
            "fd00::1",
            "fe80::1",
            "::ffff:127.0.0.1",
        ] {
            assert!(!is_public_ip(ip.parse().unwrap()), "{ip}");
        }
    }

    #[test]
    fn check_public_rejects_local_hosts() {
        for u in [
            "http://localhost/a.png",
            "http://127.0.0.1:8080/a.png",
            "http://[::1]/a.png",
        ] {
            assert!(
                super::check_public(&url::Url::parse(u).unwrap()).is_err(),
                "{u}"
            );
        }
        assert!(super::check_public(&url::Url::parse("file:///etc/passwd").unwrap()).is_err());
    }

    use super::*;

    #[test]
    fn forget_removes_only_that_path() {
        let (a, b, c) = (
            PathBuf::from("/a"),
            PathBuf::from("/b"),
            PathBuf::from("/c"),
        );
        let out = forget_recent(vec![a.clone(), b.clone(), c.clone()], &b);
        assert_eq!(out, vec![a.clone(), c.clone()]);
        // 없는 경로면 그대로
        assert_eq!(forget_recent(out.clone(), &PathBuf::from("/x")), out);
    }

    #[test]
    fn recent_list_skips_folder_checks_and_uses_saved_names() {
        // 없는 폴더도 목록에 그대로 둔다 — 목록을 그릴 때는 폴더를 보지 않는다 (SYS-09)
        let saved = json!({
            "recent": ["/no/such/Desktop/점검", "/no/such/Documents/CetusNote"],
            "recentNames": { "/no/such/Desktop/점검": "점검 노트" }
        });
        let current = PathBuf::from("/no/such/Documents/CetusNote");
        let out = recent_list(Some(&saved), Some(current.as_path()));
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].name, "점검 노트");
        assert!(!out[0].current);
        // 이름이 없으면 폴더 이름을 쓰고, 지금 연 폴더만 current
        assert_eq!(out[1].name, "CetusNote");
        assert!(out[1].current);
        assert!(recent_list(None, None).is_empty());
    }

    #[test]
    fn recent_name_update_follows_rename_of_recent_root() {
        // 워크스페이스 이름을 바꾸면 최근 목록의 이름도 따라간다 (SET-02)
        let root = Path::new("/no/such/Documents/CetusNote");
        let saved = json!({
            "recent": ["/no/such/Documents/CetusNote", "/no/such/Desktop/점검"],
            "recentNames": {
                "/no/such/Documents/CetusNote": "CetusNote",
                "/no/such/Desktop/점검": "점검"
            }
        });
        let next = recent_name_update(&saved, root, "내 노트").expect("이름이 바뀌었으면 갱신");
        let out = recent_list(Some(&next), Some(root));
        assert_eq!(out[0].name, "내 노트");
        assert_eq!(out[1].name, "점검");
        // 이미 같은 이름이면 다시 쓰지 않는다
        assert!(recent_name_update(&next, root, "내 노트").is_none());
        // 최근 목록에 없는 폴더, 저장된 것이 없을 때는 건드리지 않는다
        assert!(recent_name_update(&saved, Path::new("/no/such/other"), "x").is_none());
        assert!(recent_name_update(&json!(null), root, "x").is_none());
    }

    #[test]
    fn workspace_display_name_prefers_workspace_json() {
        let root = tempfile::tempdir().unwrap();
        let dir = root.path().join("폴더");
        std::fs::create_dir_all(&dir).unwrap();
        assert_eq!(workspace_display_name(&dir), "폴더");
        std::fs::write(dir.join(storage::WORKSPACE_FILE), r#"{"name": "내 노트"}"#).unwrap();
        assert_eq!(workspace_display_name(&dir), "내 노트");
    }

    #[test]
    fn recent_keeps_latest_first_without_duplicates() {
        let a = PathBuf::from("/a");
        let b = PathBuf::from("/b");
        assert_eq!(
            push_recent(vec![a.clone(), b.clone()], &b),
            vec![b.clone(), a.clone()]
        );
        let many: Vec<PathBuf> = (0..12).map(|i| PathBuf::from(format!("/w{i}"))).collect();
        let out = push_recent(many, &a);
        assert_eq!(out.len(), RECENT_MAX);
        assert_eq!(out[0], a);
        assert_eq!(
            recent_paths(Some(&json!({ "recent": ["/a", 3, "/b"] }))),
            vec![a, b]
        );
        assert!(recent_paths(Some(&json!({ "workspace": "/a" }))).is_empty());
    }

    #[test]
    fn workspace_name_rules() {
        assert_eq!(
            valid_workspace_name("  업무 노트 "),
            Some("업무 노트".into())
        );
        for bad in [
            "",
            "  ",
            ".hidden",
            "a/b",
            "a\\b",
            "a:b",
            "줄\n바꿈",
            &"가".repeat(81),
        ] {
            assert_eq!(valid_workspace_name(bad), None, "{bad:?}");
        }
    }
}
