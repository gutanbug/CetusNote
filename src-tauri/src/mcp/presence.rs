//! MCP 연결 상태 (DATA-12). 설정 「Agent / MCP」의 연결 뱃지가 쓴다.
//!
//! `--mcp` 서버는 앱 창과 다른 프로세스다(AI 도구가 띄운다). 그래서 서버가 연결되면 워크스페이스의
//! `.cache/mcp/<pid>.json`에 「누가(클라이언트 이름) · 언제부터」를 적고, 끝나면 지운다.
//! 강제 종료로 파일이 남을 수 있으므로 읽을 때 pid가 살아 있는지·같은 프로세스인지(시작 시각) 확인하고,
//! 아니면 지운다. `.cache`는 숨김 폴더라 백업·목록·감시에서 빠진다.
//!
//! 클라이언트 설정(Claude Code `~/.claude.json`, Claude Desktop `claude_desktop_config.json`)에
//! 이 앱의 `--mcp` 항목이 있는지도 본다. 파일은 읽기만 하고, 있음/없음만 돌려준다.

use crate::storage::{CACHE_DIR, process_alive, process_started_at};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const DIR: &str = "mcp";

/// 지금 연결된 MCP 서버 하나
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub pid: u32,
    /// 연결한 AI 도구가 알린 이름(예: "claude-code"). 모르면 빈 글
    pub client: String,
    /// 연결된 시각 (Unix ms)
    pub since: u64,
    /// 프로세스 시작 시각 표식 — pid 재사용을 가린다. 읽지 못하면 None
    #[serde(default)]
    pub started_at: Option<u64>,
}

fn dir(root: &Path) -> PathBuf {
    root.join(CACHE_DIR).join(DIR)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 연결이 살아 있는 동안 파일을 둔다. 버리면(정상 종료) 지운다
pub struct Presence {
    path: PathBuf,
}

impl Presence {
    /// 연결을 알린다. 쓰지 못하면 None(상태 표시만 못 할 뿐 서버는 그대로 돈다)
    pub fn register(root: &Path, client: &str) -> Option<Self> {
        let pid = std::process::id();
        let session = Session {
            pid,
            client: client.to_owned(),
            since: now_ms(),
            started_at: process_started_at(pid),
        };
        let dir = dir(root);
        fs::create_dir_all(&dir).ok()?;
        let path = dir.join(format!("{pid}.json"));
        fs::write(&path, serde_json::to_vec(&session).ok()?).ok()?;
        Some(Self { path })
    }
}

impl Drop for Presence {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

/// 같은 프로세스가 아직 살아 있는가 (pid + 시작 시각)
fn alive(s: &Session) -> bool {
    if !process_alive(s.pid) {
        return false;
    }
    match (s.started_at, process_started_at(s.pid)) {
        (Some(recorded), Some(now)) => recorded == now,
        _ => true,
    }
}

/// 이 워크스페이스에 지금 연결된 MCP 서버들(오래된 순). 끝난 연결의 파일은 지운다
pub fn live_sessions(root: &Path) -> Vec<Session> {
    let Ok(entries) = fs::read_dir(dir(root)) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let session = fs::read(&path)
            .ok()
            .and_then(|b| serde_json::from_slice::<Session>(&b).ok());
        match session {
            Some(s) if alive(&s) => out.push(s),
            _ => {
                let _ = fs::remove_file(&path);
            }
        }
    }
    out.sort_by_key(|s| s.since);
    out
}

/// 설정 파일 안 어딘가의 `mcpServers`에 이 앱의 `--mcp` 항목이 있는가.
/// 항목 이름이 "cetusnote"이거나, 명령이 이 실행 파일(또는 이름에 cetusnote가 든 파일)이고 인자에 `--mcp`가 있으면 맞다
pub fn has_server_entry(config: &Value, exe: &str) -> bool {
    fn entry_matches(name: &str, entry: &Value, exe: &str) -> bool {
        let args_mcp = entry
            .get("args")
            .and_then(Value::as_array)
            .is_some_and(|a| a.iter().any(|v| v.as_str() == Some("--mcp")));
        let command = entry.get("command").and_then(Value::as_str).unwrap_or("");
        let file = Path::new(command)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        args_mcp
            && (name.eq_ignore_ascii_case("cetusnote")
                || (!exe.is_empty() && command == exe)
                || file.contains("cetusnote"))
    }
    match config {
        Value::Object(map) => map.iter().any(|(key, value)| {
            let here = key == "mcpServers"
                && value
                    .as_object()
                    .is_some_and(|servers| servers.iter().any(|(n, e)| entry_matches(n, e, exe)));
            here || has_server_entry(value, exe)
        }),
        Value::Array(items) => items.iter().any(|v| has_server_entry(v, exe)),
        _ => false,
    }
}

/// 설정 파일 검사 결과를 수정 시각으로 기억한다(상태 확인은 몇 초마다 부르고, ~/.claude.json은 클 수 있다)
static CONFIG_CACHE: Mutex<Option<HashMap<PathBuf, (SystemTime, bool)>>> = Mutex::new(None);

/// 설정 파일에 이 앱의 MCP 항목이 있는가. 파일이 없거나 읽지 못하면 false
pub fn config_has_entry(path: &Path, exe: &str) -> bool {
    let Ok(modified) = fs::metadata(path).and_then(|m| m.modified()) else {
        return false;
    };
    let mut guard = CONFIG_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    let cache = guard.get_or_insert_with(HashMap::new);
    if let Some((_, found)) = cache.get(path).filter(|(at, _)| *at == modified) {
        return *found;
    }
    let found = fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
        .is_some_and(|v| has_server_entry(&v, exe));
    cache.insert(path.to_path_buf(), (modified, found));
    found
}

/// Claude Code 사용자 설정 파일 (`CLAUDE_CONFIG_DIR`가 있으면 그 안)
pub fn claude_code_config() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("CLAUDE_CONFIG_DIR") {
        return Some(PathBuf::from(dir).join(".claude.json"));
    }
    dirs::home_dir().map(|h| h.join(".claude.json"))
}

/// Claude Desktop 설정 파일 (macOS ~/Library/Application Support · Windows %APPDATA% · Linux ~/.config)
pub fn claude_desktop_config() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("Claude").join("claude_desktop_config.json"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn register_lists_and_drop_removes() {
        let dir = tempfile::tempdir().unwrap();
        let p = Presence::register(dir.path(), "claude-code").unwrap();
        let live = live_sessions(dir.path());
        assert_eq!(live.len(), 1);
        assert_eq!(live[0].client, "claude-code");
        assert_eq!(live[0].pid, std::process::id());
        drop(p);
        assert!(live_sessions(dir.path()).is_empty());
    }

    #[test]
    fn stale_files_are_dropped_and_removed() {
        let dir = tempfile::tempdir().unwrap();
        let d = super::dir(dir.path());
        fs::create_dir_all(&d).unwrap();
        // 끝난 프로세스(아주 큰 pid)와 같은 pid지만 시작 시각이 다른 기록(재사용된 pid)
        let dead = Session {
            pid: 4_000_000,
            client: "x".into(),
            since: 1,
            started_at: None,
        };
        let reused = Session {
            pid: std::process::id(),
            client: "y".into(),
            since: 2,
            started_at: process_started_at(std::process::id()).map(|t| t + 1),
        };
        fs::write(d.join("4000000.json"), serde_json::to_vec(&dead).unwrap()).unwrap();
        fs::write(d.join("self.json"), serde_json::to_vec(&reused).unwrap()).unwrap();
        fs::write(d.join("broken.json"), "{").unwrap();
        let live = live_sessions(dir.path());
        if reused.started_at.is_some() {
            assert!(live.is_empty());
            assert_eq!(fs::read_dir(&d).unwrap().count(), 0);
        } else {
            // 시작 시각을 못 읽는 플랫폼은 pid만 본다
            assert_eq!(live.len(), 1);
        }
    }

    #[test]
    fn finds_entries_in_claude_configs() {
        let exe = "/Applications/Cetus Note.app/Contents/MacOS/cetusnote";
        // Claude Desktop 형식
        assert!(has_server_entry(
            &json!({ "mcpServers": { "notes": { "command": exe, "args": ["--mcp"] } } }),
            exe
        ));
        // Claude Code: 프로젝트별 항목, 이름이 cetusnote
        assert!(has_server_entry(
            &json!({ "projects": { "/p": { "mcpServers": { "cetusnote": { "command": "/x/y", "args": ["--mcp"] } } } } }),
            exe
        ));
        // --mcp 없이 실행 파일만 같으면 아니다
        assert!(!has_server_entry(
            &json!({ "mcpServers": { "a": { "command": exe, "args": [] } } }),
            exe
        ));
        // 다른 서버만 있으면 아니다
        assert!(!has_server_entry(
            &json!({ "mcpServers": { "github": { "command": "npx", "args": ["--mcp"] } } }),
            exe
        ));
    }

    #[test]
    fn config_check_reads_file_and_missing_is_false() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("c.json");
        assert!(!config_has_entry(&path, ""));
        fs::write(
            &path,
            r#"{"mcpServers":{"cetusnote":{"command":"/a/cetusnote","args":["--mcp"]}}}"#,
        )
        .unwrap();
        assert!(config_has_entry(&path, ""));
    }
}
