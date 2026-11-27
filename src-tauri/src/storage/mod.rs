//! 워크스페이스 폴더 읽기·쓰기 (docs/architecture.md §3, ADR-001/002).
//!
//! 프론트엔드는 경로를 넘기지 않는다. 페이지는 id(ULID)로만 가리키고,
//! 워크스페이스 경로는 Rust 쪽 상태에만 있다. 그래서 폴더 밖으로 나가는 요청을 만들 수 없다.
//! 이 모듈은 Tauri에 의존하지 않는 순수 함수만 둔다(단위 테스트 대상).

pub mod attachments;
pub mod backup;
pub mod export;
pub mod history;
pub mod meta;
pub mod reminders;
pub mod watch;

use serde::Serialize;
use serde_json::Value;
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

pub const PAGES_DIR: &str = "pages";
pub const ASSETS_DIR: &str = "assets";
pub const WORKSPACE_FILE: &str = "workspace.json";
/// 다시 만들 수 있는 캐시(페이지 구조 색인, SYS-10). 백업에 넣지 않는다
pub const CACHE_DIR: &str = ".cache";
/// 앱 창이 워크스페이스를 열었다는 표시(프로세스 id). 두 창이 같은 폴더를 쓰면 한쪽 저장이 다른 쪽을 덮는다.
/// MCP 서버는 CAS로 충돌을 막으므로 이 잠금을 잡지 않는다.
pub const APP_LOCK_FILE: &str = ".cetusnote.lock";
/// 빈 폴더가 아닌 곳을 고르면 그 안에 이 이름으로 워크스페이스를 만든다.
/// 개발 빌드는 실사용 폴더(`CetusNote`)를 건드리지 않도록 다른 이름을 쓴다.
pub fn default_folder_name() -> &'static str {
    if cfg!(debug_assertions) {
        "CetusNote Dev"
    } else {
        "CetusNote"
    }
}

/// 프론트엔드로 돌려주는 오류. `code`로 분기하고 `message`는 화면에 보이는 문구다(SYS-14: 앱 언어에 맞춰 나간다).
#[derive(Debug, PartialEq)]
pub struct StorageError {
    pub code: &'static str,
    /// 원문(한국어). 로그·테스트용이고, 프론트엔드에는 `i18n::error_message`로 바꿔 보낸다
    pub message: String,
}

impl StorageError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl Serialize for StorageError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut st = s.serialize_struct("StorageError", 2)?;
        st.serialize_field("code", self.code)?;
        st.serialize_field(
            "message",
            &crate::i18n::error_message(self.code, &self.message),
        )?;
        st.end()
    }
}

impl From<io::Error> for StorageError {
    fn from(e: io::Error) -> Self {
        let code = match e.kind() {
            io::ErrorKind::NotFound => "not_found",
            io::ErrorKind::PermissionDenied => "permission_denied",
            io::ErrorKind::StorageFull => "disk_full",
            _ => "io",
        };
        Self::new(code, e.to_string())
    }
}

impl From<serde_json::Error> for StorageError {
    fn from(e: serde_json::Error) -> Self {
        Self::new("invalid_json", e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, StorageError>;

/// 페이지 id 검사: ULID(Crockford base32 대문자 26자). `../` 같은 경로 조각이 들어올 수 없다.
pub fn is_valid_id(id: &str) -> bool {
    id.len() == 26
        && id.bytes().all(|b| matches!(b, b'0'..=b'9' | b'A'..=b'H' | b'J' | b'K' | b'M' | b'N' | b'P'..=b'T' | b'V'..=b'Z'))
}

fn check_id(id: &str) -> Result<()> {
    if is_valid_id(id) {
        Ok(())
    } else {
        Err(StorageError::new(
            "invalid_id",
            format!("잘못된 페이지 id: {id:?}"),
        ))
    }
}

fn unique_suffix() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!(
        "{}-{nanos}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}

/// 원자적 쓰기: 같은 폴더의 임시 파일에 쓰고 디스크에 내린 뒤 rename한다.
/// 쓰는 도중 앱이 꺼져도 원래 파일은 그대로이거나 새 내용 전체다(반쯤 쓴 파일이 없다).
pub fn atomic_write(path: &Path, bytes: &[u8]) -> io::Result<()> {
    // 읽기 전용 파일은 폴더가 쓸 수 있으면 rename으로 조용히 덮어써진다. 그래서 먼저 막아 저장 실패로 알린다 (DATA-02)
    if fs::metadata(path).is_ok_and(|m| m.permissions().readonly()) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "읽기 전용 파일이라 저장할 수 없어요",
        ));
    }
    let dir = path
        .parent()
        .ok_or_else(|| io::Error::other("상위 폴더 없음"))?;
    let name = path
        .file_name()
        .ok_or_else(|| io::Error::other("파일 이름 없음"))?
        .to_string_lossy();
    let tmp = dir.join(format!(".{name}.{}.tmp", unique_suffix()));
    let written = (|| {
        let mut f = File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()
    })();
    if let Err(e) = written.and_then(|_| fs::rename(&tmp, path)) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    // rename 자체도 디스크에 남도록 폴더를 내린다 (unix)
    #[cfg(unix)]
    if let Ok(d) = File::open(dir) {
        let _ = d.sync_all();
    }
    Ok(())
}

/// JSON 파일 읽기. 없으면 None.
pub fn read_json_opt(path: &Path) -> Result<Option<Value>> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(serde_json::from_slice(&bytes)?)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn write_json(path: &Path, value: &Value) -> Result<()> {
    let mut bytes = serde_json::to_vec_pretty(value)?;
    bytes.push(b'\n');
    atomic_write(path, &bytes)?;
    Ok(())
}

/// 살아 있는 프로세스인가 (kill -0). 권한이 없어도 살아 있는 것으로 본다
#[cfg(unix)]
pub fn process_alive(pid: u32) -> bool {
    // 0 이하는 프로세스 그룹을 뜻하므로 개별 프로세스로 취급하지 않는다
    let Ok(pid) = i32::try_from(pid) else {
        return false;
    };
    if pid <= 0 {
        return false;
    }
    // SAFETY: 신호 0은 프로세스를 죽이지 않고 존재만 확인한다
    unsafe {
        libc::kill(pid, 0) == 0
            || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
    }
}

/// Windows: 프로세스를 열어 종료 코드가 STILL_ACTIVE인지 본다. 열 권한이 없으면(다른 사용자) 살아 있는 것으로 본다.
/// 열 수 없는데 권한 문제도 아니면(없는 pid) 죽은 것으로 본다 — 비정상 종료 뒤 잠금이 남지 않게.
#[cfg(windows)]
pub fn process_alive(pid: u32) -> bool {
    use windows::Win32::Foundation::{CloseHandle, ERROR_ACCESS_DENIED, STILL_ACTIVE};
    use windows::Win32::System::Threading::{
        GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    if pid == 0 {
        return false;
    }
    // SAFETY: 연 핸들은 이 함수 안에서만 쓰고 닫는다
    unsafe {
        let handle = match OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
            Ok(h) => h,
            Err(e) => return e.code() == windows::core::HRESULT::from_win32(ERROR_ACCESS_DENIED.0),
        };
        let mut code = 0u32;
        let alive = GetExitCodeProcess(handle, &mut code).is_ok() && code == STILL_ACTIVE.0 as u32;
        let _ = CloseHandle(handle);
        alive
    }
}

/// 유닉스도 Windows도 아닌 플랫폼에서는 살아 있다고 본다(잠금을 쉽게 풀지 않는 쪽).
#[cfg(not(any(unix, windows)))]
pub fn process_alive(_pid: u32) -> bool {
    true
}

/// 프로세스가 시작된 시각 표식(마이크로초 또는 jiffies). pid가 다른 프로세스에 재사용됐는지 가리는 데 쓴다.
/// 읽을 수 없으면 None.
#[cfg(target_os = "macos")]
pub fn process_started_at(pid: u32) -> Option<u64> {
    let pid = i32::try_from(pid).ok().filter(|p| *p > 0)?;
    // SAFETY: proc_bsdinfo는 정수 필드만 있어 0으로 채운 값이 유효하다. 반환 크기가 구조체 크기와 같을 때만 쓴다
    let mut info: libc::proc_bsdinfo = unsafe { std::mem::zeroed() };
    let size = std::mem::size_of::<libc::proc_bsdinfo>() as libc::c_int;
    let written = unsafe {
        libc::proc_pidinfo(
            pid,
            libc::PROC_PIDTBSDINFO,
            0,
            (&mut info as *mut libc::proc_bsdinfo).cast(),
            size,
        )
    };
    (written == size).then(|| info.pbi_start_tvsec * 1_000_000 + info.pbi_start_tvusec)
}

/// /proc/<pid>/stat의 starttime(22번째 필드, jiffies). comm 필드는 괄호로 싸여 공백이 있을 수 있어 마지막 `)` 뒤부터 센다.
#[cfg(target_os = "linux")]
pub fn process_started_at(pid: u32) -> Option<u64> {
    let stat = fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
    let rest = stat.get(stat.rfind(')')? + 1..)?;
    // `)` 뒤 첫 필드가 state(3번째)이므로 starttime은 인덱스 19다
    rest.split_whitespace().nth(19)?.parse().ok()
}

/// Windows: 프로세스 생성 시각(FILETIME, 100ns 단위)
#[cfg(windows)]
pub fn process_started_at(pid: u32) -> Option<u64> {
    use windows::Win32::Foundation::{CloseHandle, FILETIME};
    use windows::Win32::System::Threading::{
        GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    if pid == 0 {
        return None;
    }
    // SAFETY: 연 핸들은 이 함수 안에서만 쓰고 닫는다
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let (mut created, mut exited, mut kernel, mut user) = (
            FILETIME::default(),
            FILETIME::default(),
            FILETIME::default(),
            FILETIME::default(),
        );
        let ok = GetProcessTimes(handle, &mut created, &mut exited, &mut kernel, &mut user).is_ok();
        let _ = CloseHandle(handle);
        ok.then(|| (u64::from(created.dwHighDateTime) << 32) | u64::from(created.dwLowDateTime))
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
pub fn process_started_at(_pid: u32) -> Option<u64> {
    None
}

/// 잠금 파일 내용을 읽는다. `pid` 또는 `pid 시작표식`(예전 형식은 pid만)
fn parse_lock(text: &str) -> Option<(u32, Option<u64>)> {
    let mut parts = text.split_whitespace();
    let pid = parts.next()?.parse::<u32>().ok()?;
    let started = parts.next().and_then(|s| s.parse::<u64>().ok());
    Some((pid, started))
}

/// 잠금 파일에 쓸 내용. 시작 시각을 알 수 있으면 함께 적는다.
fn lock_text(pid: u32) -> String {
    match process_started_at(pid) {
        Some(started) => format!("{pid} {started}"),
        None => pid.to_string(),
    }
}

/// 잠금을 잡았던 프로세스가 아직 그 프로세스인가. 시작 시각이 다르면 pid가 재사용된 것이다.
/// 기록된 시각이나 현재 시각을 알 수 없으면 pid만으로 판단한다(예전 방식과 같다).
fn is_same_owner(owner: u32, recorded_start: Option<u64>) -> bool {
    match (recorded_start, process_started_at(owner)) {
        (Some(then), Some(now)) => then == now,
        _ => true,
    }
}

/// 앱 창이 이 폴더를 쓰기 전에 잠금을 잡는다. 다른 살아 있는 프로세스가 잡고 있으면 `locked`로 거절한다.
/// 죽은 프로세스의 잠금(예: 강제 종료)은 이어받는다. pid만 같고 시작 시각이 다른 잠금(재사용된 pid)도 이어받는다.
pub fn acquire_app_lock(root: &Path, pid: u32, is_alive: impl Fn(u32) -> bool) -> Result<()> {
    let path = root.join(APP_LOCK_FILE);
    let held = fs::read_to_string(&path)
        .ok()
        .and_then(|text| parse_lock(&text));
    if let Some((owner, started)) = held {
        if owner != pid && is_alive(owner) && is_same_owner(owner, started) {
            return Err(StorageError::new(
                "locked",
                "이 워크스페이스는 다른 CetusNote 창에서 열려 있어요. 그 창을 닫은 뒤 다시 열어 주세요.",
            ));
        }
    }
    atomic_write(&path, lock_text(pid).as_bytes())?;
    Ok(())
}

/// 이 프로세스가 잡은 잠금을 푼다. 다른 프로세스의 잠금은 건드리지 않는다.
pub fn release_app_lock(root: &Path, pid: u32) {
    let path = root.join(APP_LOCK_FILE);
    let owner = fs::read_to_string(&path)
        .ok()
        .and_then(|text| parse_lock(&text))
        .map(|(owner, _)| owner);
    if owner == Some(pid) {
        let _ = fs::remove_file(&path);
    }
}

/// 고른 폴더로 워크스페이스 위치를 정한다.
/// - 이미 워크스페이스(`workspace.json` 또는 `pages/`가 있음)거나 빈 폴더면 그대로 쓴다.
/// - 다른 파일이 있는 폴더면 그 안의 `CetusNote` 폴더를 쓴다(문서 폴더를 어지럽히지 않게).
pub fn resolve_workspace_dir(chosen: &Path) -> Result<PathBuf> {
    let is_workspace = chosen.join(WORKSPACE_FILE).is_file() || chosen.join(PAGES_DIR).is_dir();
    let is_empty = fs::read_dir(chosen)?
        .filter_map(|e| e.ok())
        .all(|e| e.file_name().to_string_lossy().starts_with('.'));
    Ok(if is_workspace || is_empty {
        chosen.to_path_buf()
    } else {
        chosen.join(default_folder_name())
    })
}

#[derive(Debug, Serialize, PartialEq)]
pub struct LoadError {
    pub file: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct LoadedPages {
    pub pages: Vec<Value>,
    /// 읽지 못한 파일. 앱은 이 파일들을 건드리지 않고 알리기만 한다.
    pub errors: Vec<LoadError>,
}

/// 열린 워크스페이스 폴더
#[derive(Debug, Clone)]
pub struct Workspace {
    pub root: PathBuf,
    /// 이 앱이 마지막으로 읽거나 쓴 파일 상태 — 외부 변경 감지(DATA-07)의 기준
    stamps: watch::Stamps,
    /// 워크스페이스를 열 때 Rust가 받는 토큰 (DATA-03). 쓰기 커맨드는 이 값을 맞춰 본다
    pub token: u64,
}

impl Workspace {
    /// 폴더를 열고 `pages/`·`assets/`를 만든다. 지난번에 남은 임시 파일을 치운다.
    pub fn open(root: PathBuf) -> Result<Self> {
        fs::create_dir_all(root.join(PAGES_DIR))?;
        fs::create_dir_all(root.join(ASSETS_DIR))?;
        let ws = Self {
            root,
            stamps: watch::Stamps::default(),
            token: 0,
        };
        ws.clean_temp_files();
        Ok(ws)
    }

    /// 이미 있는 워크스페이스를 붙는다 (MCP 서버, DATA-12). `open`과 달리 폴더를 만들지 않고
    /// 임시 파일도 지우지 않는다. 실행 중인 앱이 쓰는 중인 임시 파일을 건드리지 않으려고.
    pub fn attach(root: PathBuf) -> Result<Self> {
        if !(root.join(WORKSPACE_FILE).is_file() || root.join(PAGES_DIR).is_dir()) {
            return Err(StorageError::new(
                "not_workspace",
                "CetusNote 워크스페이스 폴더가 아니에요 (pages/ 또는 workspace.json이 없어요)",
            ));
        }
        Ok(Self {
            root,
            stamps: watch::Stamps::default(),
            token: 0,
        })
    }

    pub(crate) fn pages_dir(&self) -> PathBuf {
        self.root.join(PAGES_DIR)
    }

    fn page_path(&self, id: &str) -> PathBuf {
        self.pages_dir().join(format!("{id}.json"))
    }

    fn clean_temp_files(&self) {
        if let Ok(entries) = fs::read_dir(self.pages_dir()) {
            for e in entries.filter_map(|e| e.ok()) {
                let name = e.file_name().to_string_lossy().into_owned();
                if name.starts_with('.') && name.ends_with(".tmp") {
                    let _ = fs::remove_file(e.path());
                }
            }
        }
        // workspace.json의 임시 파일
        if let Ok(entries) = fs::read_dir(&self.root) {
            for e in entries.filter_map(|e| e.ok()) {
                let name = e.file_name().to_string_lossy().into_owned();
                if name.starts_with(&format!(".{WORKSPACE_FILE}.")) && name.ends_with(".tmp") {
                    let _ = fs::remove_file(e.path());
                }
            }
        }
    }

    pub fn read_meta(&self) -> Result<Option<Value>> {
        let path = self.root.join(WORKSPACE_FILE);
        self.stamps.remember(WORKSPACE_FILE, &path);
        read_json_opt(&path)
    }

    pub fn write_meta(&self, value: &Value) -> Result<()> {
        if !value.is_object() {
            return Err(StorageError::new(
                "invalid_workspace",
                "workspace.json은 객체여야 해요",
            ));
        }
        let path = self.root.join(WORKSPACE_FILE);
        write_json(&path, value)?;
        self.stamps.remember(WORKSPACE_FILE, &path);
        Ok(())
    }

    /// `pages/*.json`을 모두 읽는다. 깨진 파일은 건너뛰고 `errors`에 모은다.
    pub fn load_all(&self) -> Result<LoadedPages> {
        let mut pages = Vec::new();
        let mut errors = Vec::new();
        for entry in fs::read_dir(self.pages_dir())? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let Some(stem) = name.strip_suffix(".json") else {
                continue;
            };
            if name.starts_with('.') {
                continue;
            }
            let fail = |message: String| LoadError {
                file: name.clone(),
                message,
            };
            // 링크는 따라가지 않는다 — 워크스페이스 밖 파일을 읽지 않게
            if entry.file_type()?.is_symlink() {
                errors.push(fail("링크 파일은 읽지 않아요".into()));
                continue;
            }
            if !is_valid_id(stem) {
                errors.push(fail("파일 이름이 페이지 id 형식이 아니에요".into()));
                continue;
            }
            self.stamps
                .remember(&format!("{PAGES_DIR}/{name}"), &entry.path());
            match read_json_opt(&entry.path())
                .and_then(|v| v.ok_or_else(|| StorageError::new("not_found", "")))
            {
                Ok(page) => match validate_page(&page) {
                    Ok(id) if id == stem => pages.push(page),
                    Ok(id) => errors.push(fail(format!("파일 이름과 id({id})가 달라요"))),
                    Err(e) => errors.push(fail(e.message)),
                },
                Err(e) => errors.push(fail(e.message)),
            }
        }
        errors.sort_by(|a, b| a.file.cmp(&b.file));
        Ok(LoadedPages { pages, errors })
    }

    /// 페이지를 쓴다. 바깥에서 바뀐 디스크 내용을 버전 기록에 남겼으면 `true` (앱 쪽 내용이 이긴다, DATA-07)
    pub fn write_page(&self, page: &Value) -> Result<bool> {
        let id = validate_page(page)?;
        let path = self.page_path(&id);
        let key = format!("{PAGES_DIR}/{id}.json");
        // 이 앱이 본 뒤에 바깥에서 바뀌었으면 덮기 전에 바깥 내용을 버전 기록에 남긴다 (DATA-07)
        let kept_external = if self.stamps.is_known(&key, &path) {
            false
        } else {
            self.keep_external_copy(&id, &path)?
        };
        write_json(&path, page)?;
        self.stamps.remember(&key, &path);
        Ok(kept_external)
    }

    /// 덮이기 전 디스크의 바깥 내용을 기록에 남긴다. 남겼으면 `true`.
    /// 읽을 수 없으면 덮지 않는다(두 쪽 다 지키려고)
    fn keep_external_copy(&self, id: &str, path: &Path) -> Result<bool> {
        let Some(disk) = read_json_opt(path).ok().flatten() else {
            if path.exists() {
                return Err(StorageError::new(
                    "conflict",
                    "바깥에서 바뀐 파일을 읽지 못해 덮지 않았어요",
                ));
            }
            return Ok(false);
        };
        if validate_page(&disk).ok().as_deref() != Some(id) {
            return Err(StorageError::new(
                "conflict",
                "바깥에서 바뀐 파일을 읽지 못해 덮지 않았어요",
            ));
        }
        self.save_version(&disk)?;
        Ok(true)
    }

    /// 페이지 하나 다시 읽기(외부 변경, DATA-07). 파일이 없으면 None
    pub fn read_page(&self, id: &str) -> Result<Option<Value>> {
        check_id(id)?;
        let path = self.page_path(id);
        if fs::symlink_metadata(&path).is_ok_and(|m| m.file_type().is_symlink()) {
            return Err(StorageError::new("symlink", "링크 파일은 읽지 않아요"));
        }
        self.stamps
            .remember(&format!("{PAGES_DIR}/{id}.json"), &path);
        let Some(page) = read_json_opt(&path)? else {
            return Ok(None);
        };
        let found = validate_page(&page)?;
        if found != id {
            return Err(StorageError::new(
                "invalid_page",
                format!("파일 이름과 id({found})가 달라요"),
            ));
        }
        Ok(Some(page))
    }

    /// 같은 폴더를 다시 열 때 이전 인스턴스의 기준 상태(알고 있는 파일 상태)를 이어받는다.
    /// 새 인스턴스의 기준이 비어 있으면 화면에 이미 읽힌 모든 페이지가 바뀐 것으로 잡힌다 (DATA-07)
    pub fn inherit_stamps(&mut self, prev: &Workspace) {
        if prev.root == self.root {
            self.stamps = prev.stamps.clone();
        }
    }

    /// 지난번 이후 바깥에서 바뀐 것 (DATA-07)
    pub fn scan_changes(&self) -> Result<watch::Changes> {
        self.stamps.scan(&self.root)
    }

    /// 영구 삭제: 휴지통에 있는(`trashedAt`이 있는) 페이지만 지운다. 페이지 파일과 `assets/<id>`.
    pub fn purge_page(&self, id: &str) -> Result<()> {
        check_id(id)?;
        let path = self.page_path(id);
        if fs::symlink_metadata(&path).is_ok_and(|m| m.file_type().is_symlink()) {
            return Err(StorageError::new("symlink", "링크 파일은 지우지 않아요"));
        }
        let page = read_json_opt(&path)?
            .ok_or_else(|| StorageError::new("not_found", format!("페이지 없음: {id}")))?;
        if page.get("trashedAt").is_none_or(Value::is_null) {
            return Err(StorageError::new(
                "not_trashed",
                "휴지통에 있는 페이지만 영구 삭제할 수 있어요",
            ));
        }
        fs::remove_file(&path)?;
        self.stamps.forget(&format!("{PAGES_DIR}/{id}.json"));
        let assets = self.root.join(ASSETS_DIR).join(id);
        match fs::symlink_metadata(&assets) {
            // 링크면 링크만 지운다(가리키는 곳은 건드리지 않음)
            Ok(m) if m.file_type().is_symlink() => fs::remove_file(&assets)?,
            Ok(m) if m.is_dir() => fs::remove_dir_all(&assets)?,
            _ => {}
        }
        // 버전 기록(DATA-09). 페이지 파일은 이미 지웠으므로 실패해도 영구 삭제는 끝난 것으로 본다
        // (남은 폴더는 다음 저장 때 쓰이지 않는 고아 폴더일 뿐이다)
        let _ = self.delete_history(id);
        Ok(())
    }
}

/// 이미지 한 장의 최대 크기 (EDIT-14, PAGE-03)
pub const ASSET_MAX_BYTES: usize = 25 * 1024 * 1024;

/// 내용의 앞 바이트로 이미지 종류를 알아내 확장자를 돌려준다. 이름·MIME은 믿지 않는다.
/// SVG는 받지 않는다(문서 안 스크립트·외부 참조).
pub fn sniff_image(bytes: &[u8]) -> Option<&'static str> {
    let b = bytes;
    if b.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("png")
    } else if b.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("jpg")
    } else if b.starts_with(b"GIF87a") || b.starts_with(b"GIF89a") {
        Some("gif")
    } else if b.len() >= 12 && &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        Some("webp")
    } else if b.len() >= 12 && &b[4..8] == b"ftyp" && (&b[8..12] == b"avif" || &b[8..12] == b"avis")
    {
        Some("avif")
    } else {
        None
    }
}

/// `assets/<페이지 id>/<파일 이름>`을 검사해 (id, 파일 이름)으로 나눈다.
/// 파일 이름은 영문·숫자·`-`·`_`·`.`만, 점으로 시작하지 않는다(경로 조각·숨김 파일 차단).
pub fn parse_asset_path(path: &str) -> Result<(&str, &str)> {
    let bad = || StorageError::new("invalid_asset", format!("잘못된 이미지 경로: {path:?}"));
    let mut parts = path.split('/');
    let (Some(ASSETS_DIR), Some(id), Some(name), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err(bad());
    };
    let name_ok = !name.is_empty()
        && name.len() <= 100
        && !name.starts_with('.')
        && name
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_' | b'.'));
    if !is_valid_id(id) || !name_ok {
        return Err(bad());
    }
    Ok((id, name))
}

impl Workspace {
    /// 이미지 저장: `assets/<id>/img-<고유값>.<확장자>`. 워크스페이스 기준 상대 경로를 돌려준다.
    pub fn write_asset(&self, page_id: &str, bytes: &[u8]) -> Result<String> {
        check_id(page_id)?;
        if bytes.len() > ASSET_MAX_BYTES {
            return Err(StorageError::new("too_large", "이미지가 25MB보다 커요"));
        }
        let ext = sniff_image(bytes).ok_or_else(|| {
            StorageError::new(
                "unsupported_image",
                "PNG·JPEG·GIF·WebP·AVIF만 넣을 수 있어요",
            )
        })?;
        let dir = self.root.join(ASSETS_DIR).join(page_id);
        if fs::symlink_metadata(&dir).is_ok_and(|m| m.file_type().is_symlink()) {
            return Err(StorageError::new("symlink", "링크 폴더에는 쓰지 않아요"));
        }
        fs::create_dir_all(&dir)?;
        let name = format!("img-{}.{ext}", unique_suffix());
        atomic_write(&dir.join(&name), bytes)?;
        Ok(format!("{ASSETS_DIR}/{page_id}/{name}"))
    }

    /// 이미지 읽기. 경로는 write_asset이 준 형식만, 링크(폴더·파일)는 따라가지 않는다.
    pub fn read_asset(&self, path: &str) -> Result<Vec<u8>> {
        let (id, name) = parse_asset_path(path)?;
        let dir = self.root.join(ASSETS_DIR).join(id);
        let file = dir.join(name);
        for p in [&dir, &file] {
            if fs::symlink_metadata(p).is_ok_and(|m| m.file_type().is_symlink()) {
                return Err(StorageError::new("symlink", "링크는 읽지 않아요"));
            }
        }
        Ok(fs::read(file)?)
    }
}

/// 페이지 최소 형식 검사 후 id를 돌려준다. 본문 구조는 프론트엔드(lib/storage)가 책임진다.
pub fn validate_page(page: &Value) -> Result<String> {
    let obj = page
        .as_object()
        .ok_or_else(|| StorageError::new("invalid_page", "페이지는 객체여야 해요"))?;
    let id = obj
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| StorageError::new("invalid_page", "id가 없어요"))?;
    check_id(id)?;
    match obj.get("schemaVersion").and_then(Value::as_u64) {
        Some(v) if v >= 1 => Ok(id.to_owned()),
        _ => Err(StorageError::new("invalid_page", "schemaVersion이 없어요")),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn app_lock_refuses_a_live_owner_and_takes_over_a_dead_one() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        // 잠금이 없으면 잡는다
        acquire_app_lock(root, 100, |_| false).unwrap();
        assert_eq!(lock_owner_pid(root), 100);
        // 다른 살아 있는 프로세스가 잡고 있으면 거절한다
        let err = acquire_app_lock(root, 200, |p| p == 100).unwrap_err();
        assert_eq!(err.code, "locked");
        assert!(err.message.contains("다른 CetusNote 창"));
        // 죽은 프로세스의 잠금은 이어받는다
        acquire_app_lock(root, 200, |_| false).unwrap();
        assert_eq!(lock_owner_pid(root), 200);
        // 자기 잠금은 다시 잡아도 된다
        acquire_app_lock(root, 200, |_| true).unwrap();
    }

    #[test]
    fn release_drops_only_our_own_lock() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        acquire_app_lock(root, 100, |_| false).unwrap();
        // 다른 프로세스의 잠금은 건드리지 않는다
        release_app_lock(root, 200);
        assert!(root.join(APP_LOCK_FILE).exists());
        // 자기 잠금은 풀고, 풀린 뒤에는 다른 창이 연다
        release_app_lock(root, 100);
        assert!(!root.join(APP_LOCK_FILE).exists());
        acquire_app_lock(root, 200, |_| true).unwrap();
    }

    #[test]
    fn process_alive_sees_this_process() {
        assert!(process_alive(std::process::id()));
        assert!(!process_alive(0));
    }

    fn lock_owner_pid(root: &Path) -> u32 {
        let text = fs::read_to_string(root.join(APP_LOCK_FILE)).unwrap();
        parse_lock(&text).unwrap().0
    }

    /// 잠금 주인 자리에 무관한 살아 있는 프로세스(sleep)를 세워 둔다. 끝나면 정리한다.
    #[cfg(unix)]
    struct Sleeper(std::process::Child);

    #[cfg(unix)]
    impl Sleeper {
        fn spawn() -> Self {
            Sleeper(
                std::process::Command::new("sleep")
                    .arg("30")
                    .spawn()
                    .unwrap(),
            )
        }
        fn pid(&self) -> u32 {
            self.0.id()
        }
    }

    #[cfg(unix)]
    impl Drop for Sleeper {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }

    /// 예전 형식(pid만)의 잠금은 살아 있는 pid면 여전히 거절한다. 재사용 구분이 없는 한계는 그대로다.
    #[cfg(unix)]
    #[test]
    fn old_pid_only_lock_still_refuses_a_live_pid() {
        let other = Sleeper::spawn();
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(APP_LOCK_FILE), other.pid().to_string()).unwrap();
        let err = acquire_app_lock(dir.path(), 200, process_alive).unwrap_err();
        assert_eq!(err.code, "locked");
    }

    /// pid가 재사용됐다(같은 pid, 다른 시작 시각)면 거짓 거절하지 않고 이어받는다
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn lock_with_a_reused_pid_is_taken_over() {
        let other = Sleeper::spawn();
        let started = process_started_at(other.pid()).unwrap();
        let dir = tempfile::tempdir().unwrap();
        // 잠금을 남긴 앱은 이 프로세스가 아니었다고 기록돼 있다
        fs::write(
            dir.path().join(APP_LOCK_FILE),
            format!("{} {}", other.pid(), started + 1),
        )
        .unwrap();
        acquire_app_lock(dir.path(), 200, process_alive).unwrap();
        assert_eq!(lock_owner_pid(dir.path()), 200);
    }

    /// 시작 시각까지 같은 살아 있는 프로세스는 여전히 잠금 주인이다
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn lock_with_the_same_start_time_is_refused() {
        let other = Sleeper::spawn();
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(APP_LOCK_FILE), lock_text(other.pid())).unwrap();
        let err = acquire_app_lock(dir.path(), 200, process_alive).unwrap_err();
        assert_eq!(err.code, "locked");
    }

    #[test]
    fn lock_text_round_trips_and_accepts_the_old_format() {
        assert_eq!(parse_lock("123"), Some((123, None)));
        assert_eq!(parse_lock("123 456\n"), Some((123, Some(456))));
        assert_eq!(parse_lock("junk"), None);
    }

    use super::*;
    use serde_json::json;

    const ID: &str = "01JD0000000000000000000000";
    const ID2: &str = "01JD0000000000000000000001";

    const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR";

    #[test]
    fn asset_write_read_roundtrip_and_sniff() {
        let (_d, ws) = ws();
        let path = ws.write_asset(ID, PNG).unwrap();
        assert!(path.starts_with(&format!("assets/{ID}/img-")) && path.ends_with(".png"));
        assert_eq!(ws.read_asset(&path).unwrap(), PNG);
        let jpg = ws.write_asset(ID, &[0xFF, 0xD8, 0xFF, 0xE0, 0, 0]).unwrap();
        assert!(jpg.ends_with(".jpg"));
        assert_ne!(
            path,
            ws.write_asset(ID, PNG).unwrap(),
            "같은 내용도 새 이름"
        );
    }

    #[test]
    fn asset_rejects_unknown_types_big_files_and_bad_ids() {
        let (_d, ws) = ws();
        let svg = b"<svg xmlns='http://www.w3.org/2000/svg'/>";
        assert_eq!(
            ws.write_asset(ID, svg).unwrap_err().code,
            "unsupported_image"
        );
        assert_eq!(ws.write_asset("../x", PNG).unwrap_err().code, "invalid_id");
        let mut big = PNG.to_vec();
        big.resize(ASSET_MAX_BYTES + 1, 0);
        assert_eq!(ws.write_asset(ID, &big).unwrap_err().code, "too_large");
    }

    #[test]
    fn asset_path_must_stay_inside_assets() {
        let (_d, ws) = ws();
        for bad in [
            "assets/../workspace.json",
            &format!("assets/{ID}/../../workspace.json"),
            &format!("assets/{ID}/.hidden"),
            &format!("pages/{ID}.json"),
            &format!("assets/{ID}"),
            &format!("assets/{ID}/a/b.png"),
            "/etc/passwd",
            &format!("assets/{ID}/a b.png"),
        ] {
            assert_eq!(
                ws.read_asset(bad).unwrap_err().code,
                "invalid_asset",
                "{bad}"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn asset_does_not_follow_symlinks() {
        let (_d, ws) = ws();
        let outside = tempfile::tempdir().unwrap();
        std::fs::write(outside.path().join("x.png"), PNG).unwrap();
        std::os::unix::fs::symlink(outside.path(), ws.root.join(ASSETS_DIR).join(ID)).unwrap();
        assert_eq!(
            ws.read_asset(&format!("assets/{ID}/x.png"))
                .unwrap_err()
                .code,
            "symlink"
        );
        assert_eq!(ws.write_asset(ID, PNG).unwrap_err().code, "symlink");
    }

    #[test]
    fn purge_removes_page_assets() {
        let (_d, ws) = ws();
        let mut p = page(ID);
        ws.write_page(&p).unwrap();
        let path = ws.write_asset(ID, PNG).unwrap();
        p["trashedAt"] = json!("2026-11-19T00:00:00Z");
        ws.write_page(&p).unwrap();
        ws.purge_page(ID).unwrap();
        assert_eq!(ws.read_asset(&path).unwrap_err().code, "not_found");
    }

    fn page(id: &str) -> Value {
        json!({ "schemaVersion": 1, "id": id, "title": "회의록", "content": { "type": "doc" }, "trashedAt": null })
    }

    fn ws() -> (tempfile::TempDir, Workspace) {
        let dir = tempfile::tempdir().unwrap();
        let ws = Workspace::open(dir.path().to_path_buf()).unwrap();
        (dir, ws)
    }

    #[test]
    fn id_rejects_paths_and_wrong_alphabet() {
        assert!(is_valid_id(ID));
        for bad in [
            "",
            "../../etc/passwd",
            "01JD000000000000000000000/",
            "01jd0000000000000000000000",
            "01JD000000000000000000000I",
            "01JD00000000000000000000000",
        ] {
            assert!(!is_valid_id(bad), "{bad}");
        }
    }

    #[test]
    fn atomic_write_replaces_and_leaves_no_temp() {
        let (_d, ws) = ws();
        let path = ws.root.join("a.json");
        atomic_write(&path, b"one").unwrap();
        atomic_write(&path, b"two").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"two");
        let names: Vec<_> = fs::read_dir(&ws.root)
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert!(
            names.iter().all(|n| !n.to_string_lossy().ends_with(".tmp")),
            "{names:?}"
        );
    }

    #[test]
    fn atomic_write_refuses_read_only_target_and_recovers() {
        let (_d, ws) = ws();
        let path = ws.root.join("a.json");
        atomic_write(&path, b"one").unwrap();
        let mut perm = fs::metadata(&path).unwrap().permissions();
        perm.set_readonly(true);
        fs::set_permissions(&path, perm.clone()).unwrap();

        // 폴더는 쓸 수 있어도 실패해야 하고, 원본은 그대로여야 한다
        let err = atomic_write(&path, b"two").unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::PermissionDenied);
        assert_eq!(fs::read(&path).unwrap(), b"one");
        let temps = fs::read_dir(&ws.root)
            .unwrap()
            .filter(|e| {
                e.as_ref()
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .ends_with(".tmp")
            })
            .count();
        assert_eq!(temps, 0);

        // 권한을 되돌리면 다시 저장된다 (재시도 복구)
        perm.set_readonly(false);
        fs::set_permissions(&path, perm).unwrap();
        atomic_write(&path, b"two").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"two");
    }

    #[test]
    fn write_page_reports_permission_denied_for_read_only_page() {
        let (_d, ws) = ws();
        let page = page(ID);
        ws.write_page(&page).unwrap();
        let path = ws.page_path(ID);
        let mut perm = fs::metadata(&path).unwrap().permissions();
        perm.set_readonly(true);
        fs::set_permissions(&path, perm.clone()).unwrap();

        let err = ws.write_page(&page).unwrap_err();
        assert_eq!(err.code, "permission_denied");

        perm.set_readonly(false);
        fs::set_permissions(&path, perm).unwrap();
        ws.write_page(&page).unwrap();
    }

    #[test]
    fn opening_pages_writes_nothing_and_keeps_no_history() {
        let (_d, ws) = ws();
        let old = page(ID);
        fs::write(ws.page_path(ID), serde_json::to_vec(&old).unwrap()).unwrap();
        let before = fs::read(ws.page_path(ID)).unwrap();

        // 구조만 읽기·본문 읽기 둘 다 파일을 건드리지 않는다 (버전 기록도 없다)
        ws.load_meta().unwrap();
        assert!(ws.read_page(ID).unwrap().is_some());
        assert_eq!(fs::read(ws.page_path(ID)).unwrap(), before);
        assert!(ws.list_versions(ID).unwrap().is_empty());
    }

    #[test]
    fn first_save_of_a_loaded_page_keeps_no_copy() {
        // 구조만 읽은 페이지의 첫 저장 (본문 지연 로딩 경로)
        let (_d, ws) = ws();
        fs::write(ws.page_path(ID), serde_json::to_vec(&page(ID)).unwrap()).unwrap();
        ws.load_meta().unwrap();
        let mut edited = page(ID);
        edited
            .as_object_mut()
            .unwrap()
            .insert("title".into(), json!("앱에서 고친 제목"));
        assert!(!ws.write_page(&edited).unwrap());
        assert!(ws.list_versions(ID).unwrap().is_empty());
    }

    #[test]
    fn first_save_after_reading_a_body_keeps_no_copy() {
        let (_d, ws) = ws();
        fs::write(ws.page_path(ID), serde_json::to_vec(&page(ID)).unwrap()).unwrap();
        let loaded = ws.read_page(ID).unwrap().unwrap();
        assert!(!ws.write_page(&loaded).unwrap());
        assert!(ws.list_versions(ID).unwrap().is_empty());
    }

    #[test]
    fn write_page_reports_no_kept_copy_when_nothing_changed_outside() {
        let (_d, ws) = ws();
        assert!(!ws.write_page(&page(ID)).unwrap());
        assert!(!ws.write_page(&page(ID)).unwrap());
        assert!(ws.list_versions(ID).unwrap().is_empty());
    }

    #[test]
    fn write_page_keeps_external_copy_once_and_reports_it() {
        let (_d, ws) = ws();
        ws.write_page(&page(ID)).unwrap();
        // 바깥(다른 앱·동기화)이 파일을 바꿨다
        let mut external = page(ID);
        external
            .as_object_mut()
            .unwrap()
            .insert("title".into(), json!("바깥에서 고친 제목"));
        fs::write(ws.page_path(ID), serde_json::to_vec(&external).unwrap()).unwrap();

        // 앱 쪽 내용이 이기고, 바깥 내용은 버전 기록에 남는다
        assert!(ws.write_page(&page(ID)).unwrap());
        assert_eq!(ws.list_versions(ID).unwrap().len(), 1);
        // 같은 충돌에 대해서는 한 번만 알린다
        assert!(!ws.write_page(&page(ID)).unwrap());
        assert_eq!(ws.list_versions(ID).unwrap().len(), 1);
    }

    #[test]
    fn open_removes_leftover_temp_files() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join(PAGES_DIR)).unwrap();
        let leftover = dir
            .path()
            .join(PAGES_DIR)
            .join(format!(".{ID}.json.1-2-3.tmp"));
        fs::write(&leftover, b"{").unwrap();
        Workspace::open(dir.path().to_path_buf()).unwrap();
        assert!(!leftover.exists());
    }

    #[test]
    fn write_then_load_round_trip() {
        let (_d, ws) = ws();
        ws.write_page(&page(ID)).unwrap();
        ws.write_page(&page(ID2)).unwrap();
        let loaded = ws.load_all().unwrap();
        assert_eq!(loaded.pages.len(), 2);
        assert!(loaded.errors.is_empty());
    }

    #[test]
    fn write_rejects_invalid_pages() {
        let (_d, ws) = ws();
        assert_eq!(
            ws.write_page(&json!({ "id": ID })).unwrap_err().code,
            "invalid_page"
        );
        assert_eq!(
            ws.write_page(&json!({ "id": "../x", "schemaVersion": 1 }))
                .unwrap_err()
                .code,
            "invalid_id"
        );
        assert_eq!(ws.write_page(&json!([1])).unwrap_err().code, "invalid_page");
    }

    #[test]
    fn load_collects_broken_files_without_failing() {
        let (_d, ws) = ws();
        ws.write_page(&page(ID)).unwrap();
        let pages = ws.root.join(PAGES_DIR);
        fs::write(pages.join(format!("{ID2}.json")), b"{ broken").unwrap();
        fs::write(pages.join("notes.json"), b"{}").unwrap();
        fs::write(
            pages.join("01JD0000000000000000000002.json"),
            serde_json::to_vec(&page(ID)).unwrap(),
        )
        .unwrap();
        fs::write(pages.join("readme.txt"), b"x").unwrap();
        let loaded = ws.load_all().unwrap();
        assert_eq!(loaded.pages.len(), 1);
        let files: Vec<_> = loaded.errors.iter().map(|e| e.file.as_str()).collect();
        assert_eq!(
            files,
            [
                format!("{ID2}.json").as_str(),
                "01JD0000000000000000000002.json",
                "notes.json"
            ]
        );
    }

    #[test]
    fn purge_only_trashed_pages_and_their_assets() {
        let (_d, ws) = ws();
        ws.write_page(&page(ID)).unwrap();
        assert_eq!(ws.purge_page(ID).unwrap_err().code, "not_trashed");
        let mut trashed = page(ID);
        trashed["trashedAt"] = json!("2026-11-19T09:00:00Z");
        ws.write_page(&trashed).unwrap();
        let assets = ws.root.join(ASSETS_DIR).join(ID);
        fs::create_dir_all(&assets).unwrap();
        fs::write(assets.join("cover.jpg"), b"x").unwrap();
        ws.purge_page(ID).unwrap();
        assert!(!ws.page_path(ID).exists());
        assert!(!assets.exists());
        assert_eq!(ws.purge_page(ID).unwrap_err().code, "not_found");
        assert_eq!(ws.purge_page("../../x").unwrap_err().code, "invalid_id");
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_are_not_followed() {
        use std::os::unix::fs::symlink;
        let (_d, ws) = ws();
        let outside = tempfile::tempdir().unwrap();
        let secret = outside.path().join("secret.json");
        fs::write(&secret, serde_json::to_vec(&page(ID)).unwrap()).unwrap();
        symlink(&secret, ws.page_path(ID)).unwrap();
        let loaded = ws.load_all().unwrap();
        assert!(loaded.pages.is_empty());
        assert_eq!(loaded.errors.len(), 1);
        assert_eq!(ws.purge_page(ID).unwrap_err().code, "symlink");
        assert!(secret.exists());
        // assets/<id>가 바깥 폴더를 가리키는 링크면 링크만 지운다
        let mut trashed = page(ID2);
        trashed["trashedAt"] = json!("2026-11-19T09:00:00Z");
        ws.write_page(&trashed).unwrap();
        fs::write(outside.path().join("keep.txt"), b"x").unwrap();
        symlink(outside.path(), ws.root.join(ASSETS_DIR).join(ID2)).unwrap();
        ws.purge_page(ID2).unwrap();
        assert!(outside.path().join("keep.txt").exists());
        assert!(fs::symlink_metadata(ws.root.join(ASSETS_DIR).join(ID2)).is_err());
    }

    #[test]
    fn meta_round_trip_and_missing_is_none() {
        let (_d, ws) = ws();
        assert_eq!(ws.read_meta().unwrap(), None);
        let meta = json!({ "schemaVersion": 1, "name": "내 노트" });
        ws.write_meta(&meta).unwrap();
        assert_eq!(ws.read_meta().unwrap(), Some(meta));
        assert_eq!(
            ws.write_meta(&json!(1)).unwrap_err().code,
            "invalid_workspace"
        );
    }

    #[test]
    fn resolve_uses_subfolder_only_for_non_empty_non_workspace() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path();
        assert_eq!(resolve_workspace_dir(p).unwrap(), p);
        fs::write(p.join(".DS_Store"), b"").unwrap();
        assert_eq!(
            resolve_workspace_dir(p).unwrap(),
            p,
            "숨김 파일만 있으면 빈 폴더로 본다"
        );
        fs::write(p.join("report.pdf"), b"").unwrap();
        assert_eq!(
            resolve_workspace_dir(p).unwrap(),
            p.join(default_folder_name())
        );
        fs::write(p.join(WORKSPACE_FILE), b"{}").unwrap();
        assert_eq!(resolve_workspace_dir(p).unwrap(), p);
    }
}
