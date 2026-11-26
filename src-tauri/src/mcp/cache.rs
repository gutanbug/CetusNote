//! MCP 목록·검색용 페이지 캐시 (SYS-10).
//! 파일마다 지난번에 읽은 결과(`Entry`)를 기억하고, 수정 시각·크기가 같으면 다시 읽지 않는다.
//! 매 호출은 `pages/` 폴더 목록과 파일 상태(stat)만 확인한다. 바뀐 파일만 다시 읽는다.
//! 저장 쪽(쓰기·감시 기억)은 건드리지 않는다. 읽기는 `Workspace::read_page`를 그대로 쓴다.

use super::tools::{Entry, entry_of};
use crate::storage::watch::{Stamp, stamp_of};
use crate::storage::{LoadError, StorageError, Workspace, is_valid_id};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

/// 이 시간 안의 연속 호출은 디스크를 다시 보지 않는다 (외부 편집은 최대 이만큼 늦게 보인다)
const FRESH: Duration = Duration::from_millis(500);

#[derive(Default)]
struct Cache {
    files: HashMap<String, (Stamp, Arc<Entry>)>,
    /// 마지막 전체 확인 시각(확인을 시작한 시점)과 그 결과
    scanned: Option<(Instant, Arc<Loaded>)>,
}

/// 워크스페이스(pages 폴더)마다 따로 기억한다. 한 프로세스에서 여러 워크스페이스를 읽어도 서로 비우지 않는다.
static CACHE: OnceLock<Mutex<HashMap<PathBuf, Cache>>> = OnceLock::new();

/// 캐시에서 꺼낸 페이지들과 읽지 못한 파일 목록
pub struct Loaded {
    pub entries: HashMap<String, Arc<Entry>>,
    pub errors: Vec<LoadError>,
}

/// 이 프로세스가 페이지를 쓴 뒤 호출한다. 다음 `load`는 디스크를 다시 본다 (내 쓰기가 바로 보이게).
pub fn forget(ws: &Workspace) {
    if let Some(m) = CACHE.get() {
        if let Ok(mut all) = m.lock() {
            if let Some(cache) = all.get_mut(&ws.pages_dir()) {
                cache.scanned = None;
            }
        }
    }
}

/// `Workspace::load_all`과 같은 규칙으로 페이지를 모으되, 안 바뀐 파일은 다시 읽지 않는다.
/// 마지막 확인에서 `FRESH` 안이면 디스크를 보지 않고 그 결과를 돌려준다.
pub fn load(ws: &Workspace) -> Result<Arc<Loaded>, StorageError> {
    load_with(ws, FRESH)
}

fn load_with(ws: &Workspace, fresh: Duration) -> Result<Arc<Loaded>, StorageError> {
    let dir = ws.pages_dir();
    let mut all = CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|_| StorageError::new("io", "캐시 잠금 실패"))?;
    let cache = all.entry(dir.clone()).or_default();
    if let Some((at, last)) = &cache.scanned {
        if at.elapsed() < fresh {
            return Ok(last.clone());
        }
    }
    let started = Instant::now();

    let mut seen = HashSet::new();
    let mut entries = HashMap::new();
    let mut errors = Vec::new();
    for dent in fs::read_dir(&dir)? {
        let dent = dent?;
        let name = dent.file_name().to_string_lossy().into_owned();
        let Some(stem) = name.strip_suffix(".json") else {
            continue;
        };
        if name.starts_with('.') {
            continue;
        }
        if dent.file_type()?.is_symlink() {
            errors.push(LoadError {
                file: name,
                message: "링크 파일은 읽지 않아요".into(),
            });
            continue;
        }
        if !is_valid_id(stem) {
            errors.push(LoadError {
                file: name,
                message: "파일 이름이 페이지 id 형식이 아니에요".into(),
            });
            continue;
        }
        let Some(stamp) = stamp_of(&dent.path()) else {
            errors.push(LoadError {
                file: name,
                message: "읽지 못했어요".into(),
            });
            continue;
        };
        let id = stem.to_owned();
        seen.insert(id.clone());
        if let Some((known, entry)) = cache.files.get(&id) {
            if *known == stamp {
                entries.insert(id, entry.clone());
                continue;
            }
        }
        // 상태를 먼저 적어 둔다: 읽는 동안 바뀌면 다음 호출이 다시 읽는다
        match ws.read_page(&id) {
            Ok(Some(page)) => match entry_of(page) {
                Some(entry) => {
                    let entry = Arc::new(entry);
                    cache.files.insert(id.clone(), (stamp, entry.clone()));
                    entries.insert(id, entry);
                }
                None => errors.push(LoadError {
                    file: name,
                    message: "페이지 형식이 올바르지 않아요".into(),
                }),
            },
            Ok(None) => errors.push(LoadError {
                file: name,
                message: "파일을 찾을 수 없어요".into(),
            }),
            Err(e) => errors.push(LoadError {
                file: name,
                message: e.message,
            }),
        }
    }
    cache.files.retain(|id, _| seen.contains(id));
    errors.sort_by(|a, b| a.file.cmp(&b.file));
    let loaded = Arc::new(Loaded { entries, errors });
    cache.scanned = Some((started, loaded.clone()));
    Ok(loaded)
}

#[cfg(test)]
mod tests {
    use super::{FRESH, forget, load_with};
    use crate::storage::Workspace;
    use serde_json::{Value, json};
    use std::time::Duration;

    const A: &str = "0123456789ABCDEFGHJKMNPQRS";
    const B: &str = "0123456789ABCDEFGHJKMNPQRT";

    fn page(id: &str, title: &str) -> Value {
        json!({
            "id": id, "schemaVersion": 7, "kind": "page", "title": title,
            "content": {"type": "doc", "content": []},
            "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z"
        })
    }

    #[test]
    fn cache_follows_writes_removals_and_broken_files() {
        let dir = tempfile::tempdir().unwrap();
        let ws = Workspace::open(dir.path().to_path_buf()).unwrap();
        let file_b = dir.path().join("pages").join(format!("{B}.json"));
        ws.write_page(&page(A, "짧음")).unwrap();
        ws.write_page(&page(B, "둘째")).unwrap();

        let first = load_with(&ws, Duration::ZERO).unwrap();
        assert_eq!(first.entries.len(), 2);
        assert_eq!(first.entries[A].title, "짧음");

        // 내용 길이가 바뀌면 상태가 달라져 다시 읽는다
        ws.write_page(&page(A, "조금 더 긴 제목")).unwrap();
        let second = load_with(&ws, Duration::ZERO).unwrap();
        assert_eq!(second.entries[A].title, "조금 더 긴 제목");
        assert_eq!(second.entries[A].title_lc, "조금 더 긴 제목");

        // 지운 파일은 목록에서 사라진다
        std::fs::remove_file(&file_b).unwrap();
        let third = load_with(&ws, Duration::ZERO).unwrap();
        assert!(!third.entries.contains_key(B));

        // 깨진 파일은 건너뛰고 오류로 모은다
        std::fs::write(&file_b, "{not json").unwrap();
        let fourth = load_with(&ws, Duration::ZERO).unwrap();
        assert_eq!(fourth.entries.len(), 1);
        assert_eq!(fourth.errors.len(), 1);
        assert_eq!(fourth.errors[0].file, format!("{B}.json"));
    }

    #[test]
    fn fresh_window_skips_disk_until_forgotten_or_expired() {
        let dir = tempfile::tempdir().unwrap();
        let ws = Workspace::open(dir.path().to_path_buf()).unwrap();
        ws.write_page(&page(A, "처음")).unwrap();
        let long = Duration::from_secs(3600);
        assert_eq!(load_with(&ws, long).unwrap().entries[A].title, "처음");

        // 창 안에서는 바깥 변경이 보이지 않는다 (디스크를 보지 않음)
        ws.write_page(&page(A, "바뀜")).unwrap();
        ws.write_page(&page(B, "새 페이지")).unwrap();
        assert_eq!(load_with(&ws, long).unwrap().entries[A].title, "처음");
        assert!(!load_with(&ws, long).unwrap().entries.contains_key(B));

        // 이 프로세스의 쓰기 뒤 forget이면 바로 다시 본다
        forget(&ws);
        let after = load_with(&ws, long).unwrap();
        assert_eq!(after.entries[A].title, "바뀜");
        assert!(after.entries.contains_key(B));
    }

    #[test]
    fn default_window_is_short_enough_to_bound_staleness() {
        assert!(FRESH <= Duration::from_secs(1));
    }
}
