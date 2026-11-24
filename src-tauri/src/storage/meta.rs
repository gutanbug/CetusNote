//! 페이지 구조만 읽기 (SYS-10, ADR-022).
//!
//! 시작할 때 `pages/*.json` 전체를 파싱하지 않으려고, 파일마다 "수정 시각·크기 → 본문을 뺀 페이지"를
//! `.cache/pages-index.json`에 둔다. 파일 상태가 그대로면 색인 값을 쓰고, 다르거나 색인에 없으면 파일을 읽어 색인을 고친다.
//! 색인은 지워도 되는 캐시다. 깨졌거나 형식이 다르면 처음부터 다시 만든다.

use super::{
    CACHE_DIR, LoadError, LoadedPages, PAGES_DIR, Result, StorageError, Workspace, atomic_write,
    is_valid_id, read_json_opt, validate_page,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

const INDEX_FILE: &str = "pages-index.json";
/// 색인 형식 번호. 저장 방식이 바뀌면 올린다(옛 색인은 버리고 다시 만든다)
const INDEX_FORMAT: u32 = 1;

#[derive(Debug, Default, Serialize, Deserialize)]
struct IndexFile {
    format: u32,
    /// 파일 이름(`<id>.json`) → 항목
    entries: HashMap<String, Entry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Entry {
    /// 수정 시각 (ns)
    mtime: u64,
    size: u64,
    /// 본문(`content`)을 뺀 페이지
    page: Value,
}

/// (수정 시각 ns, 크기). 심볼릭 링크와 폴더는 None
fn file_state(path: &Path) -> Option<(u64, u64)> {
    let m = fs::symlink_metadata(path).ok()?;
    if !m.is_file() {
        return None;
    }
    let t = m
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_nanos() as u64;
    Some((t, m.len()))
}

/// 색인을 읽는다. 없거나 깨졌거나 형식이 다르면 빈 색인
fn read_index(path: &Path) -> IndexFile {
    fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<IndexFile>(&bytes).ok())
        .filter(|idx| idx.format == INDEX_FORMAT)
        .unwrap_or_default()
}

fn strip_content(mut page: Value) -> Value {
    if let Some(obj) = page.as_object_mut() {
        obj.remove("content");
    }
    page
}

impl Workspace {
    /// `pages/*.json`의 구조만 읽는다(본문 `content`는 뺀다). `load_all`과 같은 파일을 같은 규칙으로 거르고,
    /// 깨진 파일은 `errors`에 모은다. 색인을 고쳤으면 `.cache/pages-index.json`을 다시 쓴다(실패해도 무시).
    pub fn load_meta(&self) -> Result<LoadedPages> {
        let index_path = self.root.join(CACHE_DIR).join(INDEX_FILE);
        let old = read_index(&index_path);
        let mut next: HashMap<String, Entry> = HashMap::new();
        let mut pages = Vec::new();
        let mut errors: Vec<LoadError> = Vec::new();
        let mut changed = false;

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
            if entry.file_type()?.is_symlink() {
                errors.push(fail("링크 파일은 읽지 않아요".into()));
                continue;
            }
            if !is_valid_id(stem) {
                errors.push(fail("파일 이름이 페이지 id 형식이 아니에요".into()));
                continue;
            }
            let path = entry.path();
            // 바깥 변경 감지(DATA-07)의 기준은 본문을 읽었든 색인에서 얻었든 같은 파일 상태여야 한다
            self.stamps.remember(&format!("{PAGES_DIR}/{name}"), &path);
            let Some((mtime, size)) = file_state(&path) else {
                errors.push(fail("페이지 파일을 읽지 못했어요".into()));
                continue;
            };

            let cached = old.entries.get(&name).filter(|e| {
                e.mtime == mtime
                    && e.size == size
                    && e.page.get("id").and_then(Value::as_str) == Some(stem)
            });
            let page = if let Some(hit) = cached {
                hit.page.clone()
            } else {
                changed = true;
                let parsed = read_json_opt(&path)
                    .and_then(|v| v.ok_or_else(|| StorageError::new("not_found", "")));
                match parsed {
                    Ok(page) => match validate_page(&page) {
                        Ok(id) if id == stem => strip_content(page),
                        Ok(id) => {
                            errors.push(fail(format!("파일 이름과 id({id})가 달라요")));
                            continue;
                        }
                        Err(e) => {
                            errors.push(fail(e.message));
                            continue;
                        }
                    },
                    Err(e) => {
                        errors.push(fail(e.message));
                        continue;
                    }
                }
            };
            next.insert(
                name,
                Entry {
                    mtime,
                    size,
                    page: page.clone(),
                },
            );
            pages.push(page);
        }

        // 지워졌거나 깨져서 빠진 항목이 있으면 색인도 고친다
        changed |= next.len() != old.entries.len();
        if changed {
            let index = IndexFile {
                format: INDEX_FORMAT,
                entries: next,
            };
            if let Ok(bytes) = serde_json::to_vec(&index) {
                if let Some(dir) = index_path.parent() {
                    let _ = fs::create_dir_all(dir);
                }
                let _ = atomic_write(&index_path, &bytes);
            }
        }
        errors.sort_by(|a, b| a.file.cmp(&b.file));
        Ok(LoadedPages { pages, errors })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::{Duration, SystemTime};

    const ID: &str = "01JD0000000000000000000000";
    const ID2: &str = "01JD0000000000000000000001";

    fn ws() -> (tempfile::TempDir, Workspace) {
        let dir = tempfile::tempdir().unwrap();
        let ws = Workspace::open(dir.path().to_path_buf()).unwrap();
        (dir, ws)
    }

    fn page(id: &str, title: &str, body: &str) -> Value {
        json!({
            "schemaVersion": 6,
            "id": id,
            "kind": "page",
            "title": title,
            "content": { "type": "doc", "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": body }] }
            ]},
        })
    }

    fn index_path(ws: &Workspace) -> std::path::PathBuf {
        ws.root.join(CACHE_DIR).join(INDEX_FILE)
    }

    fn cached_title(ws: &Workspace, name: &str) -> Option<String> {
        let idx = read_index(&index_path(ws));
        idx.entries
            .get(name)
            .and_then(|e| e.page.get("title"))
            .and_then(Value::as_str)
            .map(str::to_owned)
    }

    #[test]
    fn meta_omits_content_and_matches_full_load() {
        let (_d, ws) = ws();
        ws.write_page(&page(ID, "하나", "본문 하나")).unwrap();
        ws.write_page(&page(ID2, "둘", "본문 둘")).unwrap();
        // 깨진 JSON, 파일 이름과 id가 다른 페이지
        fs::write(ws.pages_dir().join(format!("{ID}x.json")), "{").unwrap();
        fs::write(
            ws.pages_dir().join("01JD0000000000000000000009.json"),
            serde_json::to_vec(&page(ID, "엇갈림", "x")).unwrap(),
        )
        .unwrap();

        let full = ws.load_all().unwrap();
        let meta = ws.load_meta().unwrap();
        let ids = |v: &[Value]| {
            let mut ids: Vec<String> = v
                .iter()
                .map(|p| p["id"].as_str().unwrap().to_owned())
                .collect();
            ids.sort();
            ids
        };
        assert_eq!(ids(&meta.pages), ids(&full.pages));
        assert_eq!(meta.errors, full.errors);
        assert_eq!(meta.errors.len(), 2);
        for p in &meta.pages {
            assert!(p.get("content").is_none(), "본문은 빠져야 한다");
            assert!(p.get("title").is_some());
        }
    }

    #[test]
    fn unchanged_files_are_served_from_the_index() {
        let (_d, ws) = ws();
        ws.write_page(&page(ID, "원래", "본문")).unwrap();
        ws.load_meta().unwrap();
        assert_eq!(
            cached_title(&ws, &format!("{ID}.json")).as_deref(),
            Some("원래")
        );

        // 색인의 값만 바꾼다(파일 상태는 그대로) → 다음 읽기가 색인을 쓰면 바뀐 값이 나온다
        let mut idx = read_index(&index_path(&ws));
        idx.entries.get_mut(&format!("{ID}.json")).unwrap().page["title"] = json!("색인");
        fs::write(index_path(&ws), serde_json::to_vec(&idx).unwrap()).unwrap();
        let meta = ws.load_meta().unwrap();
        assert_eq!(meta.pages[0]["title"], "색인");
    }

    #[test]
    fn changed_file_is_read_again_even_with_same_size() {
        let (_d, ws) = ws();
        ws.write_page(&page(ID, "가나다", "본문")).unwrap();
        ws.load_meta().unwrap();
        let file = ws.page_path(ID);

        // 같은 크기로 내용을 바꾸고 수정 시각을 옮긴다 → 색인을 버리고 새로 읽는다
        let before = fs::read_to_string(&file).unwrap();
        let after = before.replace("가나다", "라마바");
        assert_eq!(before.len(), after.len());
        fs::write(&file, &after).unwrap();
        let f = fs::OpenOptions::new().write(true).open(&file).unwrap();
        f.set_modified(SystemTime::now() + Duration::from_secs(3600))
            .unwrap();
        drop(f);
        let meta = ws.load_meta().unwrap();
        assert_eq!(meta.pages[0]["title"], "라마바");
    }

    #[test]
    fn external_edit_with_new_size_is_picked_up_and_stamped() {
        let (_d, ws) = ws();
        ws.write_page(&page(ID, "짧은", "본문")).unwrap();
        ws.load_meta().unwrap();
        ws.write_page(&page(ID, "훨씬 더 긴 제목", "본문")).unwrap();
        let meta = ws.load_meta().unwrap();
        assert_eq!(meta.pages[0]["title"], "훨씬 더 긴 제목");
        // 이 앱이 쓴 뒤 읽은 상태라 바깥 변경으로 잡히지 않는다 (DATA-07)
        assert!(ws.scan_changes().unwrap().changed.is_empty());
    }

    #[test]
    fn corrupt_index_is_rebuilt_and_deleted_pages_leave_it() {
        let (_d, ws) = ws();
        ws.write_page(&page(ID, "하나", "본문")).unwrap();
        ws.write_page(&page(ID2, "둘", "본문")).unwrap();
        fs::create_dir_all(index_path(&ws).parent().unwrap()).unwrap();
        fs::write(index_path(&ws), b"not json").unwrap();

        let meta = ws.load_meta().unwrap();
        assert_eq!(meta.pages.len(), 2);
        assert_eq!(read_index(&index_path(&ws)).entries.len(), 2);

        fs::remove_file(ws.page_path(ID2)).unwrap();
        let meta = ws.load_meta().unwrap();
        assert_eq!(meta.pages.len(), 1);
        let idx = read_index(&index_path(&ws));
        assert!(!idx.entries.contains_key(&format!("{ID2}.json")));
    }

    #[test]
    fn index_with_other_format_is_ignored() {
        let (_d, ws) = ws();
        ws.write_page(&page(ID, "하나", "본문")).unwrap();
        fs::create_dir_all(index_path(&ws).parent().unwrap()).unwrap();
        fs::write(index_path(&ws), br#"{"format":99,"entries":{}}"#).unwrap();
        let meta = ws.load_meta().unwrap();
        assert_eq!(meta.pages.len(), 1);
        assert_eq!(read_index(&index_path(&ws)).format, INDEX_FORMAT);
    }

    /// 측정 (SYS-10): `CETUS_PERF_WS=<워크스페이스> cargo test --release bench_ -- --ignored --nocapture`.
    /// 전체 읽기(이전 경로), 색인 없는 첫 구조 읽기, 색인이 있는 두 번째 구조 읽기, 본문 한 페이지를 잰다.
    /// 직렬화 크기는 프런트엔드로 넘어가는 IPC 양의 근사다.
    #[test]
    #[ignore = "측정용: CETUS_PERF_WS 환경 변수가 필요하다"]
    fn bench_load_all_vs_meta() {
        let Some(dir) = std::env::var_os("CETUS_PERF_WS") else {
            return;
        };
        let ws = Workspace::open(std::path::PathBuf::from(dir)).unwrap();
        let ms = |t: std::time::Instant| t.elapsed().as_secs_f64() * 1000.0;

        let t = std::time::Instant::now();
        let all = ws.load_all().unwrap();
        let all_ms = ms(t);
        let t = std::time::Instant::now();
        let all_json = serde_json::to_vec(&all).unwrap();
        let all_ser_ms = ms(t);

        let _ = fs::remove_dir_all(ws.root.join(CACHE_DIR));
        let t = std::time::Instant::now();
        let cold = ws.load_meta().unwrap();
        let cold_ms = ms(t);

        let t = std::time::Instant::now();
        let warm = ws.load_meta().unwrap();
        let warm_ms = ms(t);
        let t = std::time::Instant::now();
        let meta_json = serde_json::to_vec(&warm).unwrap();
        let meta_ser_ms = ms(t);

        let id = warm.pages[0]["id"].as_str().unwrap().to_owned();
        let t = std::time::Instant::now();
        let one = ws.read_page(&id).unwrap().unwrap();
        let one_ms = ms(t);

        assert_eq!(all.pages.len(), warm.pages.len());
        assert_eq!(cold.pages.len(), warm.pages.len());
        assert!(one.get("content").is_some());
        eprintln!("PERF pages={} ", all.pages.len());
        eprintln!(
            "PERF load_all_ms={all_ms:.1} ser_all_ms={all_ser_ms:.1} ipc_all_bytes={}",
            all_json.len()
        );
        eprintln!(
            "PERF load_meta_cold_ms={cold_ms:.1} load_meta_warm_ms={warm_ms:.1} ser_meta_ms={meta_ser_ms:.1} ipc_meta_bytes={}",
            meta_json.len()
        );
        eprintln!(
            "PERF read_page_ms={one_ms:.2} read_page_bytes={}",
            serde_json::to_vec(&one).unwrap().len()
        );
    }
}
