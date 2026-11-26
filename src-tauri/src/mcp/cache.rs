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

#[derive(Default)]
struct Cache {
    root: Option<PathBuf>,
    files: HashMap<String, (Stamp, Arc<Entry>)>,
}

static CACHE: OnceLock<Mutex<Cache>> = OnceLock::new();

/// 캐시에서 꺼낸 페이지들과 읽지 못한 파일 목록
pub struct Loaded {
    pub entries: HashMap<String, Arc<Entry>>,
    pub errors: Vec<LoadError>,
}

/// `Workspace::load_all`과 같은 규칙으로 페이지를 모으되, 안 바뀐 파일은 다시 읽지 않는다.
pub fn load(ws: &Workspace) -> Result<Loaded, StorageError> {
    let dir = ws.pages_dir();
    let mut cache = CACHE
        .get_or_init(|| Mutex::new(Cache::default()))
        .lock()
        .map_err(|_| StorageError::new("io", "캐시 잠금 실패"))?;
    if cache.root.as_deref() != Some(dir.as_path()) {
        cache.root = Some(dir.clone());
        cache.files.clear();
    }

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
    Ok(Loaded { entries, errors })
}

#[cfg(test)]
mod tests {
    use super::load;
    use crate::storage::Workspace;
    use serde_json::{Value, json};

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

        let first = load(&ws).unwrap();
        assert_eq!(first.entries.len(), 2);
        assert_eq!(first.entries[A].title, "짧음");

        // 내용 길이가 바뀌면 상태가 달라져 다시 읽는다
        ws.write_page(&page(A, "조금 더 긴 제목")).unwrap();
        let second = load(&ws).unwrap();
        assert_eq!(second.entries[A].title, "조금 더 긴 제목");
        assert_eq!(second.entries[A].title_lc, "조금 더 긴 제목");

        // 지운 파일은 목록에서 사라진다
        std::fs::remove_file(&file_b).unwrap();
        let third = load(&ws).unwrap();
        assert!(!third.entries.contains_key(B));

        // 깨진 파일은 건너뛰고 오류로 모은다
        std::fs::write(&file_b, "{not json").unwrap();
        let fourth = load(&ws).unwrap();
        assert_eq!(fourth.entries.len(), 1);
        assert_eq!(fourth.errors.len(), 1);
        assert_eq!(fourth.errors[0].file, format!("{B}.json"));
    }
}
