//! 페이지 버전 기록 (DATA-09, ADR-013). `.history/<pageId>/<버전>.json`에 페이지 전체를 한 파일로 남긴다.
//!
//! - 버전 이름은 UTC 밀리초 시각(`YYYYMMDDTHHMMSSmmmZ`, 19자)이다. 이름 길이가 같아 사전순 = 시간순이다.
//!   같은 밀리초에 또 쓰면 한 밀리초씩 밀어 이름을 비운다(덮어쓰지 않는다).
//! - 페이지마다 최근 `HISTORY_KEEP`개만 남긴다. 저장할 때 가장 오래된 것부터 지운다.
//! - 목록·읽기·삭제는 `pages/`와 무관하다. 페이지 불러오기·외부 변경 감지는 `.history`를 보지 않는다.
//! - 백업 zip에는 넣지 않는다(ADR-013). 버전은 이 기기의 되돌리기용이다.

use super::{Result, StorageError, Workspace, check_id, read_json_opt, validate_page, write_json};
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const HISTORY_DIR: &str = ".history";
/// 페이지 하나에 남기는 버전 수
pub const HISTORY_KEEP: usize = 50;

/// 버전 목록 한 줄. `chars`는 본문 글자 수(목록 행의 "글자 수")
#[derive(Debug, Serialize, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VersionInfo {
    pub id: String,
    pub saved_at: String,
    pub size: u64,
    pub chars: u64,
}

/// 버전 이름 형식 검사: `YYYYMMDDTHHMMSSmmmZ`
pub fn is_valid_version(name: &str) -> bool {
    let b = name.as_bytes();
    b.len() == 19
        && b[8] == b'T'
        && b[18] == b'Z'
        && b.iter()
            .enumerate()
            .all(|(i, c)| i == 8 || i == 18 || c.is_ascii_digit())
}

/// 1970-01-01부터의 날짜 수 → (년, 월, 일). Howard Hinnant의 civil_from_days.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// 유닉스 밀리초 → (버전 이름, ISO 8601 UTC 문자열)
pub fn version_name(unix_ms: u64) -> (String, String) {
    let ms = unix_ms % 1000;
    let secs = unix_ms / 1000;
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let (y, mo, d) = civil_from_days(days);
    let (h, mi, s) = (rem / 3600, rem % 3600 / 60, rem % 60);
    let name = format!("{y:04}{mo:02}{d:02}T{h:02}{mi:02}{s:02}{ms:03}Z");
    let iso = format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}.{ms:03}Z");
    (name, iso)
}

/// 버전 이름 → ISO 8601 UTC 문자열 (형식이 맞을 때만)
fn iso_of(name: &str) -> Option<String> {
    if !is_valid_version(name) {
        return None;
    }
    let p = |a: usize, b: usize| &name[a..b];
    Some(format!(
        "{}-{}-{}T{}:{}:{}.{}Z",
        p(0, 4),
        p(4, 6),
        p(6, 8),
        p(9, 11),
        p(11, 13),
        p(13, 15),
        p(15, 18)
    ))
}

/// 본문(Tiptap JSON)의 글자 수: 모든 `text` 노드의 글자를 더한다
pub fn char_count(value: &Value) -> u64 {
    match value {
        Value::Object(map) => {
            let own = map
                .get("text")
                .and_then(Value::as_str)
                .map_or(0, |t| t.chars().count() as u64);
            own + map.values().map(char_count).sum::<u64>()
        }
        Value::Array(items) => items.iter().map(char_count).sum(),
        _ => 0,
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn check_version(version: &str) -> Result<()> {
    if is_valid_version(version) {
        Ok(())
    } else {
        Err(StorageError::new(
            "invalid_version",
            format!("잘못된 버전 이름: {version:?}"),
        ))
    }
}

fn is_symlink(p: &Path) -> bool {
    fs::symlink_metadata(p).is_ok_and(|m| m.file_type().is_symlink())
}

impl Workspace {
    fn history_root(&self) -> PathBuf {
        self.root.join(HISTORY_DIR)
    }

    fn history_dir(&self, id: &str) -> PathBuf {
        self.history_root().join(id)
    }

    /// 버전 파일 목록(이름 형식이 맞는 일반 파일만), 오래된 것부터
    fn version_names(dir: &Path) -> Vec<String> {
        let Ok(entries) = fs::read_dir(dir) else {
            return Vec::new();
        };
        let mut names: Vec<String> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
            .filter_map(|e| {
                let name = e.file_name().to_string_lossy().into_owned();
                name.strip_suffix(".json")
                    .filter(|s| is_valid_version(s))
                    .map(str::to_owned)
            })
            .collect();
        names.sort();
        names
    }

    /// 페이지의 버전 하나를 새로 남기고, 오래된 것을 `HISTORY_KEEP`개까지 지운다.
    pub fn save_version(&self, page: &Value) -> Result<VersionInfo> {
        let id = validate_page(page)?;
        let root = self.history_root();
        let dir = self.history_dir(&id);
        if is_symlink(&root) || is_symlink(&dir) {
            return Err(StorageError::new(
                "symlink",
                "버전 기록 폴더가 링크라 쓰지 않아요",
            ));
        }
        fs::create_dir_all(&dir)?;

        let mut ms = now_ms();
        let (name, path) = loop {
            let (name, _) = version_name(ms);
            let path = dir.join(format!("{name}.json"));
            if !path.exists() {
                break (name, path);
            }
            ms += 1;
        };
        write_json(&path, page)?;

        let names = Self::version_names(&dir);
        let extra = names.len().saturating_sub(HISTORY_KEEP);
        for old in names.iter().take(extra) {
            let _ = fs::remove_file(dir.join(format!("{old}.json")));
        }

        let size = fs::metadata(&path)?.len();
        let (_, saved_at) = version_name(ms);
        Ok(VersionInfo {
            id: name,
            saved_at,
            size,
            chars: char_count(&page["content"]),
        })
    }

    /// 페이지의 버전 목록, 최근 것이 앞. 기록이 없으면 빈 목록. 읽을 수 없는 버전은 뺀다.
    pub fn list_versions(&self, id: &str) -> Result<Vec<VersionInfo>> {
        check_id(id)?;
        let dir = self.history_dir(id);
        if is_symlink(&self.history_root()) || is_symlink(&dir) {
            return Err(StorageError::new(
                "symlink",
                "버전 기록 폴더가 링크라 읽지 않아요",
            ));
        }
        let mut out = Vec::new();
        for name in Self::version_names(&dir).into_iter().rev() {
            let path = dir.join(format!("{name}.json"));
            let Ok(Some(page)) = read_json_opt(&path) else {
                continue;
            };
            let Some(saved_at) = iso_of(&name) else {
                continue;
            };
            out.push(VersionInfo {
                id: name,
                saved_at,
                size: fs::metadata(&path).map(|m| m.len()).unwrap_or(0),
                chars: char_count(&page["content"]),
            });
        }
        Ok(out)
    }

    /// 버전 하나의 페이지 내용
    pub fn read_version(&self, id: &str, version: &str) -> Result<Value> {
        check_id(id)?;
        check_version(version)?;
        let dir = self.history_dir(id);
        let path = dir.join(format!("{version}.json"));
        if is_symlink(&self.history_root()) || is_symlink(&dir) || is_symlink(&path) {
            return Err(StorageError::new("symlink", "링크 파일은 읽지 않아요"));
        }
        read_json_opt(&path)?
            .ok_or_else(|| StorageError::new("not_found", format!("버전 없음: {version}")))
    }

    /// 페이지의 버전 기록을 모두 지운다(영구 삭제). 기록이 없으면 아무것도 하지 않는다.
    pub fn delete_history(&self, id: &str) -> Result<()> {
        check_id(id)?;
        let dir = self.history_dir(id);
        match fs::symlink_metadata(&dir) {
            // 링크면 링크만 지운다(가리키는 곳은 건드리지 않음)
            Ok(m) if m.file_type().is_symlink() => fs::remove_file(&dir)?,
            Ok(m) if m.is_dir() => fs::remove_dir_all(&dir)?,
            _ => {}
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const ID: &str = "01JD0000000000000000000000";
    const ID2: &str = "01JD0000000000000000000001";

    fn page(id: &str, text: &str) -> Value {
        json!({
            "schemaVersion": 6, "id": id, "title": "회의록", "content": {
                "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": text }] }]
            }, "trashedAt": null
        })
    }

    fn ws() -> (tempfile::TempDir, Workspace) {
        let dir = tempfile::tempdir().unwrap();
        let ws = Workspace::open(dir.path().to_path_buf()).unwrap();
        (dir, ws)
    }

    #[test]
    fn version_names_are_fixed_width_utc_and_sortable() {
        // 1700000000 s = 2023-11-14T22:13:20Z
        assert_eq!(
            version_name(1_700_000_000_123),
            (
                "20231114T221320123Z".to_owned(),
                "2023-11-14T22:13:20.123Z".to_owned()
            )
        );
        assert_eq!(version_name(0).0, "19700101T000000000Z");
        assert!(version_name(951_782_400_000).0.starts_with("20000229")); // 윤년
        assert!(version_name(1_700_000_000_000).0 < version_name(1_700_000_000_001).0);
    }

    #[test]
    fn version_name_format_is_checked() {
        assert!(is_valid_version("20231114T221320123Z"));
        assert!(!is_valid_version("20231114T221320123"));
        assert!(!is_valid_version("../20231114T221320123Z"));
        assert!(!is_valid_version("20231114X221320123Z"));
        assert!(!is_valid_version("2023111AT221320123Z"));
    }

    #[test]
    fn char_count_sums_text_nodes_only() {
        let v = page(ID, "안녕 world");
        assert_eq!(char_count(&v["content"]), 8);
        assert_eq!(char_count(&json!({ "type": "doc" })), 0);
    }

    #[test]
    fn save_then_list_newest_first_with_chars_and_size() {
        let (_d, ws) = ws();
        let a = ws.save_version(&page(ID, "첫 글")).unwrap();
        let b = ws.save_version(&page(ID, "둘째 글입니다")).unwrap();
        assert!(a.id < b.id, "같은 밀리초여도 이름이 겹치지 않고 커진다");
        let list = ws.list_versions(ID).unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, b.id);
        assert_eq!(list[0].chars, 7);
        assert_eq!(list[1].chars, 3);
        assert!(list[0].size > 0);
        assert!(list[0].saved_at.ends_with('Z') && list[0].saved_at.contains('T'));
        let back = ws.read_version(ID, &a.id).unwrap();
        assert_eq!(back["content"]["content"][0]["content"][0]["text"], "첫 글");
    }

    #[test]
    fn prune_keeps_only_the_newest_fifty() {
        let (_d, ws) = ws();
        let mut ids = Vec::new();
        for i in 0..HISTORY_KEEP + 3 {
            ids.push(ws.save_version(&page(ID, &format!("v{i}"))).unwrap().id);
        }
        let list = ws.list_versions(ID).unwrap();
        assert_eq!(list.len(), HISTORY_KEEP);
        assert_eq!(list[0].id, *ids.last().unwrap());
        assert_eq!(list.last().unwrap().id, ids[3]);
        assert_eq!(ws.read_version(ID, &ids[0]).unwrap_err().code, "not_found");
    }

    #[test]
    fn versions_and_ids_are_validated_and_stay_inside_history() {
        let (_d, ws) = ws();
        ws.save_version(&page(ID, "x")).unwrap();
        assert_eq!(ws.list_versions("../etc").unwrap_err().code, "invalid_id");
        assert_eq!(ws.delete_history("../etc").unwrap_err().code, "invalid_id");
        assert_eq!(
            ws.read_version(ID, "../../pages/x").unwrap_err().code,
            "invalid_version"
        );
        assert_eq!(
            ws.read_version(ID, "20231114T221320123Z/..")
                .unwrap_err()
                .code,
            "invalid_version"
        );
        let mut bad = page(ID, "x");
        bad["id"] = json!("../x");
        assert_eq!(ws.save_version(&bad).unwrap_err().code, "invalid_id");
    }

    #[test]
    fn history_is_removed_with_the_page_and_not_loaded_as_pages() {
        let (_d, ws) = ws();
        ws.write_page(&page(ID, "본문")).unwrap();
        ws.save_version(&page(ID, "본문")).unwrap();
        let loaded = ws.load_all().unwrap();
        assert_eq!(loaded.pages.len(), 1);
        assert!(loaded.errors.is_empty());
        assert!(ws.scan_changes().unwrap().changed.iter().all(|c| c == ID));

        ws.delete_history(ID).unwrap();
        assert!(ws.list_versions(ID).unwrap().is_empty());
        ws.delete_history(ID).unwrap(); // 없어도 오류가 아니다
    }

    #[test]
    fn permanent_delete_removes_history_only_for_trashed_pages() {
        let (_d, ws) = ws();
        let mut trashed = page(ID, "지울 글");
        trashed["trashedAt"] = json!("2026-11-21T00:00:00Z");
        ws.write_page(&trashed).unwrap();
        ws.save_version(&trashed).unwrap();
        ws.write_page(&page(ID2, "살릴 글")).unwrap();
        ws.save_version(&page(ID2, "살릴 글")).unwrap();

        assert_eq!(ws.purge_page(ID2).unwrap_err().code, "not_trashed");
        assert_eq!(ws.list_versions(ID2).unwrap().len(), 1);

        ws.purge_page(ID).unwrap();
        assert!(ws.list_versions(ID).unwrap().is_empty());
    }

    #[test]
    fn symlinked_history_folder_is_refused() {
        let (d, ws) = ws();
        let outside = tempfile::tempdir().unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(outside.path(), d.path().join(HISTORY_DIR)).unwrap();
            assert_eq!(ws.save_version(&page(ID, "x")).unwrap_err().code, "symlink");
            assert_eq!(ws.list_versions(ID).unwrap_err().code, "symlink");
            assert!(fs::read_dir(outside.path()).unwrap().next().is_none());
        }
    }
}
