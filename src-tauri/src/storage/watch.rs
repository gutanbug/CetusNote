//! 외부 변경 감지 (DATA-07). 파일 감시 대신 "마지막으로 안 상태"와 디스크를 비교한다.
//! 이 앱이 읽거나 쓸 때마다 그 파일의 상태(수정 시각·크기)를 기억하므로, 자기 저장은 변경으로 잡히지 않는다.

use super::{PAGES_DIR, Result, WORKSPACE_FILE, is_valid_id};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::UNIX_EPOCH;

/// (수정 시각 ns, 크기)
pub(crate) type Stamp = (u128, u64);

pub(crate) fn stamp_of(path: &Path) -> Option<Stamp> {
    let m = fs::symlink_metadata(path).ok()?;
    if !m.is_file() {
        return None;
    }
    let t = m
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_nanos();
    Some((t, m.len()))
}

#[derive(Debug, Default)]
struct Maps {
    /// 이 앱이 마지막으로 읽거나 쓴 상태 — 쓰기 전 비교 기준(compare-and-swap)
    known: HashMap<String, Stamp>,
    /// 마지막 변경 검사(scan)가 보고한 상태
    reported: HashMap<String, Stamp>,
}

#[derive(Debug, Clone, Default)]
pub struct Stamps(Arc<Mutex<Maps>>);

#[derive(Debug, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Changes {
    /// 새로 생기거나 바뀐 페이지 id
    pub changed: Vec<String>,
    /// 사라진 페이지 id
    pub removed: Vec<String>,
    /// workspace.json이 바뀌었다
    pub meta: bool,
}

impl Stamps {
    /// 이 파일의 지금 상태를 기억한다(없으면 잊는다)
    pub fn remember(&self, key: &str, path: &Path) {
        if let Ok(mut m) = self.0.lock() {
            match stamp_of(path) {
                Some(s) => {
                    m.known.insert(key.to_owned(), s);
                    m.reported.insert(key.to_owned(), s);
                }
                None => {
                    m.known.remove(key);
                    m.reported.remove(key);
                }
            }
        }
    }

    /// 디스크 파일이 이 앱이 마지막으로 본 상태 그대로인가. 잠금 실패도 "아니다"로 본다
    pub fn is_known(&self, key: &str, path: &Path) -> bool {
        self.0
            .lock()
            .is_ok_and(|m| m.known.get(key).copied() == stamp_of(path))
    }

    pub fn forget(&self, key: &str) {
        if let Ok(mut m) = self.0.lock() {
            m.known.remove(key);
            m.reported.remove(key);
        }
    }

    /// 디스크와 비교해 바뀐 것을 돌려주고, 기억을 디스크에 맞춘다
    pub fn scan(&self, root: &Path) -> Result<Changes> {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| super::StorageError::new("io", "상태 잠금 실패"))?;
        let map = &mut guard.reported;
        let mut out = Changes::default();
        let mut seen = std::collections::HashSet::new();
        for e in fs::read_dir(root.join(PAGES_DIR))?.filter_map(|e| e.ok()) {
            let name = e.file_name().to_string_lossy().into_owned();
            let Some(id) = name.strip_suffix(".json").filter(|s| is_valid_id(s)) else {
                continue; // 임시 파일·다른 파일
            };
            let key = format!("{PAGES_DIR}/{name}");
            let Some(now) = stamp_of(&e.path()) else {
                continue;
            };
            seen.insert(key.clone());
            if map.get(&key) != Some(&now) {
                map.insert(key, now);
                out.changed.push(id.to_owned());
            }
        }
        let gone: Vec<String> = map
            .keys()
            .filter(|k| k.starts_with(&format!("{PAGES_DIR}/")) && !seen.contains(*k))
            .cloned()
            .collect();
        for k in gone {
            map.remove(&k);
            if let Some(id) = k
                .strip_prefix(&format!("{PAGES_DIR}/"))
                .and_then(|n| n.strip_suffix(".json"))
            {
                out.removed.push(id.to_owned());
            }
        }
        let meta_now = stamp_of(&root.join(WORKSPACE_FILE));
        if map.get(WORKSPACE_FILE).copied() != meta_now {
            match meta_now {
                Some(s) => map.insert(WORKSPACE_FILE.to_owned(), s),
                None => map.remove(WORKSPACE_FILE),
            };
            out.meta = meta_now.is_some();
        }
        out.changed.sort();
        out.removed.sort();
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use crate::storage::Workspace;
    use serde_json::json;
    use std::fs;

    const A: &str = "01JD0000000000000000000000";
    const B: &str = "01JD0000000000000000000001";

    fn page(id: &str, title: &str) -> serde_json::Value {
        json!({ "schemaVersion": 2, "id": id, "title": title, "trashedAt": null })
    }

    #[test]
    fn own_reads_and_writes_are_not_changes() {
        let d = tempfile::tempdir().unwrap();
        let ws = Workspace::open(d.path().to_path_buf()).unwrap();
        ws.write_meta(&json!({ "schemaVersion": 1 })).unwrap();
        ws.write_page(&page(A, "가")).unwrap();
        ws.load_all().unwrap();
        assert_eq!(ws.scan_changes().unwrap(), Default::default());
        ws.write_page(&page(A, "가 고침")).unwrap();
        assert_eq!(ws.scan_changes().unwrap(), Default::default());
    }

    #[test]
    fn external_add_change_remove_and_meta() {
        let d = tempfile::tempdir().unwrap();
        let ws = Workspace::open(d.path().to_path_buf()).unwrap();
        ws.write_page(&page(A, "가")).unwrap();
        ws.write_meta(&json!({ "schemaVersion": 1 })).unwrap();
        ws.scan_changes().unwrap();
        let pages = d.path().join("pages");
        // 바깥에서: A 고침(크기가 달라짐), B 추가, workspace.json 고침
        fs::write(
            pages.join(format!("{A}.json")),
            page(A, "바깥에서 고친 제목").to_string(),
        )
        .unwrap();
        fs::write(
            pages.join(format!("{B}.json")),
            page(B, "새 페이지").to_string(),
        )
        .unwrap();
        fs::write(
            d.path().join("workspace.json"),
            r#"{"schemaVersion":1,"name":"바뀜"}"#,
        )
        .unwrap();
        fs::write(pages.join(".x.tmp"), "임시").unwrap();
        let c = ws.scan_changes().unwrap();
        assert_eq!(c.changed, vec![A.to_owned(), B.to_owned()]);
        assert!(c.meta && c.removed.is_empty());
        assert_eq!(ws.read_page(B).unwrap().unwrap()["title"], "새 페이지");
        // 바깥에서 지움
        fs::remove_file(pages.join(format!("{A}.json"))).unwrap();
        let c = ws.scan_changes().unwrap();
        assert_eq!(c.removed, vec![A.to_owned()]);
        assert_eq!(ws.scan_changes().unwrap(), Default::default());
        assert!(ws.read_page(A).unwrap().is_none());
    }

    #[test]
    fn external_change_is_kept_in_history_before_app_overwrites() {
        let d = tempfile::tempdir().unwrap();
        let ws = Workspace::open(d.path().to_path_buf()).unwrap();
        ws.write_page(&page(A, "가")).unwrap();
        ws.write_meta(&json!({ "schemaVersion": 1 })).unwrap();
        ws.scan_changes().unwrap();
        fs::write(
            d.path().join("pages").join(format!("{A}.json")),
            page(A, "바깥 내용").to_string(),
        )
        .unwrap();
        assert_eq!(ws.scan_changes().unwrap().changed, vec![A.to_owned()]);
        // 앱이 덮기 전에 바깥 내용이 버전 기록에 남는다 (scan이 기준을 옮겼어도)
        ws.write_page(&page(A, "앱 내용")).unwrap();
        let kept = ws
            .list_versions(A)
            .unwrap()
            .iter()
            .any(|v| ws.read_version(A, &v.id).unwrap()["title"] == "바깥 내용");
        assert!(kept, "바깥 내용이 버전 기록에 없어요");
        assert_eq!(ws.read_page(A).unwrap().unwrap()["title"], "앱 내용");
    }

    #[test]
    fn reopening_the_same_folder_keeps_the_baseline() {
        let d = tempfile::tempdir().unwrap();
        let ws = Workspace::open(d.path().to_path_buf()).unwrap();
        ws.write_meta(&json!({ "schemaVersion": 1 })).unwrap();
        ws.write_page(&page(A, "가")).unwrap();
        ws.write_page(&page(B, "나")).unwrap();
        ws.load_all().unwrap();
        // 새 인스턴스는 기준이 비어 있어 읽힌 페이지 전부를 바뀐 것으로 보고한다 (재현)
        let bare = Workspace::open(d.path().to_path_buf()).unwrap();
        assert_eq!(bare.scan_changes().unwrap().changed.len(), 2);
        // 같은 폴더를 다시 열 때 기준을 이어받으면 바뀐 것이 없다
        let mut again = Workspace::open(d.path().to_path_buf()).unwrap();
        again.inherit_stamps(&ws);
        assert_eq!(again.scan_changes().unwrap(), Default::default());
        // 이어받은 뒤의 진짜 바깥 변경은 여전히 잡힌다
        std::fs::write(
            d.path().join("pages").join(format!("{A}.json")),
            page(A, "바깥").to_string(),
        )
        .unwrap();
        let c = again.scan_changes().unwrap();
        assert_eq!(c.changed, vec![A.to_string()]);
    }
}
