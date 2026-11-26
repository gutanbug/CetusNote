//! 워크스페이스 백업·복원 (DATA-05, 2026-11-19 사용자 결정: 수동 + 자동, 복원은 새 폴더로).
//!
//! 백업 zip 안: `cetusnote-backup.json`(표지) · `workspace.json` · `pages/<id>.json` · `assets/<id>/<파일>`.
//! 복원은 이 목록에 맞는 항목만 푼다 — 경로 탈출(`../`), 절대 경로, 숨김 파일, 다른 파일은 받지 않는다.

use super::{
    ASSETS_DIR, PAGES_DIR, Result, StorageError, WORKSPACE_FILE, atomic_write, is_valid_id,
    parse_asset_path,
};
use serde_json::{Value, json};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

/// 백업 표지 파일 — 이 파일이 있어야 CetusNote 백업으로 본다
pub const MANIFEST: &str = "cetusnote-backup.json";
pub const BACKUP_FORMAT: u64 = 1;
/// 자동 백업 폴더(워크스페이스 안)와 남길 개수
pub const AUTO_DIR: &str = ".backups";
pub const AUTO_KEEP: usize = 7;
/// 페이지·workspace.json 한 파일의 최대 크기(풀 때)
const JSON_MAX_BYTES: u64 = 20 * 1024 * 1024;
/// 풀어 쓸 전체 크기 상한 (압축 폭탄 방지)
const TOTAL_MAX_BYTES: u64 = 4 * 1024 * 1024 * 1024;

fn is_symlink(p: &Path) -> bool {
    fs::symlink_metadata(p).is_ok_and(|m| m.file_type().is_symlink())
}

/// 백업에 넣을 파일 (zip 안 이름, 실제 경로). 링크·임시 파일·모르는 파일은 뺀다
fn collect(root: &Path) -> Result<Vec<(String, PathBuf)>> {
    let mut out = Vec::new();
    let meta = root.join(WORKSPACE_FILE);
    if meta.is_file() && !is_symlink(&meta) {
        out.push((WORKSPACE_FILE.to_owned(), meta));
    }
    if let Ok(entries) = fs::read_dir(root.join(PAGES_DIR)) {
        for e in entries.filter_map(|e| e.ok()) {
            let name = e.file_name().to_string_lossy().into_owned();
            let ok = name.strip_suffix(".json").is_some_and(is_valid_id);
            if ok && e.file_type().is_ok_and(|t| t.is_file()) {
                out.push((format!("{PAGES_DIR}/{name}"), e.path()));
            }
        }
    }
    if let Ok(dirs) = fs::read_dir(root.join(ASSETS_DIR)) {
        for d in dirs.filter_map(|e| e.ok()) {
            if !d.file_type().is_ok_and(|t| t.is_dir()) {
                continue; // 링크 폴더는 file_type이 symlink라 여기서 빠진다
            }
            let id = d.file_name().to_string_lossy().into_owned();
            let Ok(files) = fs::read_dir(d.path()) else {
                continue;
            };
            for f in files.filter_map(|e| e.ok()) {
                let rel = format!("{ASSETS_DIR}/{id}/{}", f.file_name().to_string_lossy());
                if parse_asset_path(&rel).is_ok() && f.file_type().is_ok_and(|t| t.is_file()) {
                    out.push((rel, f.path()));
                }
            }
        }
    }
    out.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(out)
}

/// 워크스페이스를 zip 하나로. 같은 폴더의 임시 파일에 다 쓴 뒤 rename한다(반쯤 쓴 백업이 남지 않게)
pub fn create_backup(root: &Path, dest: &Path, created_at: &str) -> Result<usize> {
    let files = collect(root)?;
    let pages = files
        .iter()
        .filter(|(n, _)| n.starts_with(PAGES_DIR))
        .count();
    let mut buf = std::io::Cursor::new(Vec::new());
    {
        let mut zip = ZipWriter::new(&mut buf);
        let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        // 이미지는 이미 압축돼 있어 그대로 담는다
        let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        let manifest = json!({ "app": "CetusNote", "format": BACKUP_FORMAT, "createdAt": created_at, "pages": pages });
        zip.start_file(MANIFEST, opts).map_err(zip_err)?;
        zip.write_all(&serde_json::to_vec_pretty(&manifest)?)?;
        for (name, path) in &files {
            zip.start_file(
                name,
                if name.starts_with(ASSETS_DIR) {
                    stored
                } else {
                    opts
                },
            )
            .map_err(zip_err)?;
            let mut f = File::open(path)?;
            std::io::copy(&mut f, &mut zip)?;
        }
        zip.finish().map_err(zip_err)?;
    }
    atomic_write(dest, buf.get_ref())?;
    Ok(pages)
}

fn zip_err(e: zip::result::ZipError) -> StorageError {
    match e {
        zip::result::ZipError::Io(io) => io.into(),
        other => StorageError::new("invalid_backup", other.to_string()),
    }
}

/// zip 안 이름이 풀어도 되는 것인지. 되면 최대 크기를 돌려준다
fn allowed(name: &str) -> Option<u64> {
    if name == MANIFEST || name == WORKSPACE_FILE {
        return Some(JSON_MAX_BYTES);
    }
    if let Some(file) = name.strip_prefix("pages/") {
        return file
            .strip_suffix(".json")
            .is_some_and(is_valid_id)
            .then_some(JSON_MAX_BYTES);
    }
    parse_asset_path(name)
        .ok()
        .map(|(_, file)| super::attachments::max_bytes_for_asset(file))
}

/// 백업 표지 읽기 — CetusNote 백업이 아니거나 더 새 형식이면 오류
fn read_manifest<R: Read + std::io::Seek>(zip: &mut ZipArchive<R>) -> Result<Value> {
    let not_backup = || StorageError::new("invalid_backup", "Cetus Note 백업 파일이 아니에요");
    let mut f = zip.by_name(MANIFEST).map_err(|_| not_backup())?;
    let mut s = String::new();
    f.by_ref()
        .take(JSON_MAX_BYTES)
        .read_to_string(&mut s)
        .map_err(|_| not_backup())?;
    let v: Value = serde_json::from_str(&s).map_err(|_| not_backup())?;
    match v.get("format").and_then(Value::as_u64) {
        Some(n) if n <= BACKUP_FORMAT => Ok(v),
        Some(_) => Err(StorageError::new(
            "invalid_backup",
            "더 새 버전의 앱에서 만든 백업이에요",
        )),
        None => Err(not_backup()),
    }
}

/// 백업을 빈 폴더(없으면 만든다)에 푼다. 실패하면 푼 것을 지워 원래대로 둔다. 풀린 페이지 수를 돌려준다
pub fn restore_backup(zip_path: &Path, dest: &Path) -> Result<usize> {
    // 숨김 파일(.DS_Store 등)만 있으면 빈 폴더로 본다
    let has_files = dest.exists()
        && fs::read_dir(dest)?
            .filter_map(|e| e.ok())
            .any(|e| !e.file_name().to_string_lossy().starts_with('.'));
    if has_files {
        return Err(StorageError::new("not_empty", "빈 폴더에만 풀 수 있어요"));
    }
    let created_dir = !dest.exists();
    let result = (|| {
        let mut zip = ZipArchive::new(File::open(zip_path)?).map_err(zip_err)?;
        read_manifest(&mut zip)?;
        // 먼저 모든 이름·크기를 검사한다 — 하나라도 어긋나면 아무것도 쓰지 않는다
        let mut total = 0u64;
        for i in 0..zip.len() {
            let f = zip.by_index(i).map_err(zip_err)?;
            if f.is_dir() {
                continue;
            }
            let max = allowed(f.name()).ok_or_else(|| {
                StorageError::new(
                    "invalid_backup",
                    format!("백업에 모르는 파일이 있어요: {:?}", f.name()),
                )
            })?;
            if f.size() > max {
                return Err(StorageError::new(
                    "too_large",
                    format!("너무 큰 파일: {}", f.name()),
                ));
            }
            total += f.size();
        }
        if total > TOTAL_MAX_BYTES {
            return Err(StorageError::new("too_large", "백업이 너무 커요"));
        }
        fs::create_dir_all(dest.join(PAGES_DIR))?;
        fs::create_dir_all(dest.join(ASSETS_DIR))?;
        let mut pages = 0;
        for i in 0..zip.len() {
            let mut f = zip.by_index(i).map_err(zip_err)?;
            let name = f.name().to_owned();
            if f.is_dir() || name == MANIFEST {
                continue;
            }
            let max = allowed(&name).unwrap_or(0);
            let mut bytes = Vec::new();
            // 표시된 크기를 믿지 않고 읽으면서도 자른다
            f.by_ref().take(max + 1).read_to_end(&mut bytes)?;
            if bytes.len() as u64 > max {
                return Err(StorageError::new(
                    "too_large",
                    format!("너무 큰 파일: {name}"),
                ));
            }
            if name.starts_with(PAGES_DIR) {
                pages += 1;
            }
            let path = dest.join(&name);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)?;
            }
            atomic_write(&path, &bytes)?;
        }
        Ok(pages)
    })();
    if result.is_err() {
        // 이 함수가 만든 것만 지운다(빈 폴더였으니 안에 있는 것은 모두 이번에 쓴 것)
        if created_dir {
            let _ = fs::remove_dir_all(dest);
        } else if let Ok(entries) = fs::read_dir(dest) {
            for e in entries.filter_map(|e| e.ok()) {
                if e.file_name().to_string_lossy().starts_with('.') {
                    continue; // 원래 있던 숨김 파일
                }
                let p = e.path();
                let _ = if p.is_dir() {
                    fs::remove_dir_all(p)
                } else {
                    fs::remove_file(p)
                };
            }
        }
    }
    result
}

/// 고른 폴더가 (숨김 파일 말고) 비어 있으면 그대로, 아니면 그 안의 새 폴더 `CetusNote 복원`(겹치면 번호)
pub fn restore_dir(chosen: &Path) -> Result<PathBuf> {
    let empty = fs::read_dir(chosen)?
        .filter_map(|e| e.ok())
        .all(|e| e.file_name().to_string_lossy().starts_with('.'));
    if empty {
        return Ok(chosen.to_path_buf());
    }
    (1..1000)
        .map(|n| {
            chosen.join(if n == 1 {
                "CetusNote 복원".to_owned()
            } else {
                format!("CetusNote 복원 {n}")
            })
        })
        .find(|p| !p.exists())
        .ok_or_else(|| StorageError::new("io", "풀 폴더를 만들 수 없어요"))
}

/// 자동 백업 이름 (`CetusNote-2026-11-19.zip`). 날짜는 프론트엔드가 지역 시각으로 준다
pub fn auto_name(today: &str) -> Result<String> {
    let b = today.as_bytes();
    let ok = b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit());
    if !ok {
        return Err(StorageError::new(
            "invalid_date",
            format!("잘못된 날짜: {today:?}"),
        ));
    }
    Ok(format!("CetusNote-{today}.zip"))
}

/// 하루 한 번 자동 백업. 오늘 것이 있으면 None. 만든 뒤 오래된 자동 백업은 AUTO_KEEP개만 남긴다
pub fn auto_backup(root: &Path, today: &str, created_at: &str) -> Result<Option<String>> {
    let name = auto_name(today)?;
    let dir = root.join(AUTO_DIR);
    if is_symlink(&dir) {
        return Err(StorageError::new("symlink", "링크 폴더에는 쓰지 않아요"));
    }
    fs::create_dir_all(&dir)?;
    if dir.join(&name).exists() {
        return Ok(None);
    }
    create_backup(root, &dir.join(&name), created_at)?;
    prune(&dir)?;
    Ok(Some(name))
}

/// 자동 백업 목록(최근 것이 앞). 폴더가 없으면 빈 목록
pub fn auto_list(root: &Path) -> Result<Vec<String>> {
    let dir = root.join(AUTO_DIR);
    if !dir.is_dir() || is_symlink(&dir) {
        return Ok(Vec::new());
    }
    let mut autos = autos_in(&dir)?;
    autos.reverse();
    Ok(autos)
}

fn autos_in(dir: &Path) -> Result<Vec<String>> {
    let mut autos: Vec<String> = fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| {
            n.strip_prefix("CetusNote-")
                .and_then(|r| r.strip_suffix(".zip"))
                .is_some_and(|d| auto_name(d).is_ok())
        })
        .collect();
    autos.sort();
    Ok(autos)
}

/// 자동 백업 이름 형식인 파일만 날짜순으로 보고 오래된 것을 지운다(사용자가 둔 다른 파일은 건드리지 않음)
fn prune(dir: &Path) -> Result<()> {
    let autos = autos_in(dir)?;
    let extra = autos.len().saturating_sub(AUTO_KEEP);
    for n in &autos[..extra] {
        fs::remove_file(dir.join(n))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::Workspace;

    const ID: &str = "01JD0000000000000000000000";
    const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR";

    fn sample() -> (tempfile::TempDir, Workspace) {
        let d = tempfile::tempdir().unwrap();
        let ws = Workspace::open(d.path().join("ws")).unwrap();
        ws.write_meta(&json!({ "schemaVersion": 1, "name": "내 노트" }))
            .unwrap();
        ws.write_page(
            &json!({ "schemaVersion": 2, "id": ID, "title": "회의록", "trashedAt": null }),
        )
        .unwrap();
        ws.write_asset(ID, PNG).unwrap();
        (d, ws)
    }

    #[test]
    fn backup_leaves_out_the_app_lock_file() {
        let (d, ws) = sample();
        crate::storage::acquire_app_lock(&ws.root, std::process::id(), |_| false).unwrap();
        let zip = d.path().join("lock.zip");
        create_backup(&ws.root, &zip, "2026-11-19T00:00:00Z").unwrap();
        let mut archive = ZipArchive::new(std::fs::File::open(&zip).unwrap()).unwrap();
        let names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_owned())
            .collect();
        assert!(
            !names
                .iter()
                .any(|n| n.contains(crate::storage::APP_LOCK_FILE))
        );
        // 잠금 파일이 있어도 복원 폴더는 빈 것으로 보고 풀린다
        let out = d.path().join("restored-lock");
        assert_eq!(restore_backup(&zip, &out).unwrap(), 1);
        assert!(!out.join(crate::storage::APP_LOCK_FILE).exists());
    }

    #[test]
    fn backup_then_restore_roundtrip() {
        let (d, ws) = sample();
        let zip = d.path().join("b.zip");
        assert_eq!(
            create_backup(&ws.root, &zip, "2026-11-19T00:00:00Z").unwrap(),
            1
        );
        let out = d.path().join("restored");
        assert_eq!(restore_backup(&zip, &out).unwrap(), 1);
        let back = Workspace::open(out).unwrap();
        assert_eq!(back.load_all().unwrap().pages[0]["title"], "회의록");
        assert_eq!(back.read_meta().unwrap().unwrap()["name"], "내 노트");
        let asset = fs::read_dir(back.root.join(ASSETS_DIR).join(ID))
            .unwrap()
            .next()
            .unwrap()
            .unwrap();
        assert_eq!(fs::read(asset.path()).unwrap(), PNG);
    }

    #[test]
    fn restore_dir_picks_new_subfolder_when_busy() {
        let d = tempfile::tempdir().unwrap();
        assert_eq!(restore_dir(d.path()).unwrap(), d.path());
        fs::write(d.path().join("문서.txt"), b"x").unwrap();
        assert_eq!(
            restore_dir(d.path()).unwrap(),
            d.path().join("CetusNote 복원")
        );
        fs::create_dir(d.path().join("CetusNote 복원")).unwrap();
        assert_eq!(
            restore_dir(d.path()).unwrap(),
            d.path().join("CetusNote 복원 2")
        );
    }

    #[test]
    fn restore_refuses_non_empty_folder() {
        let (d, ws) = sample();
        let zip = d.path().join("b.zip");
        create_backup(&ws.root, &zip, "t").unwrap();
        assert_eq!(
            restore_backup(&zip, &ws.root).unwrap_err().code,
            "not_empty"
        );
        // 숨김 파일만 있는 폴더는 비어 있는 것으로 본다
        let only_dot = d.path().join("dot");
        fs::create_dir_all(&only_dot).unwrap();
        fs::write(only_dot.join(".DS_Store"), b"x").unwrap();
        assert_eq!(restore_backup(&zip, &only_dot).unwrap(), 1);
    }

    fn handmade(d: &Path, entries: &[(&str, &[u8])]) -> PathBuf {
        let path = d.join("hand.zip");
        let mut zip = ZipWriter::new(File::create(&path).unwrap());
        for (name, bytes) in entries {
            zip.start_file(*name, SimpleFileOptions::default()).unwrap();
            zip.write_all(bytes).unwrap();
        }
        zip.finish().unwrap();
        path
    }

    #[test]
    fn restore_rejects_unknown_or_escaping_entries_and_writes_nothing() {
        let d = tempfile::tempdir().unwrap();
        let manifest = br#"{"app":"CetusNote","format":1}"#;
        for bad in [
            "../evil.txt",
            "/etc/passwd",
            "pages/../../x.json",
            ".hidden",
            "notes.txt",
        ] {
            let zip = handmade(d.path(), &[(MANIFEST, manifest), (bad, b"x")]);
            let out = d.path().join("out");
            assert_eq!(
                restore_backup(&zip, &out).unwrap_err().code,
                "invalid_backup",
                "{bad}"
            );
            assert!(!out.exists(), "{bad}: 아무것도 남지 않는다");
        }
    }

    #[test]
    fn restore_needs_manifest_and_known_format() {
        let d = tempfile::tempdir().unwrap();
        let plain = handmade(d.path(), &[("workspace.json", b"{}")]);
        assert_eq!(
            restore_backup(&plain, &d.path().join("a"))
                .unwrap_err()
                .code,
            "invalid_backup"
        );
        let newer = handmade(
            d.path(),
            &[(MANIFEST, br#"{"app":"CetusNote","format":99}"#)],
        );
        assert_eq!(
            restore_backup(&newer, &d.path().join("b"))
                .unwrap_err()
                .code,
            "invalid_backup"
        );
    }

    #[test]
    fn auto_backup_once_a_day_and_keeps_seven() {
        let (_d, ws) = sample();
        assert!(auto_backup(&ws.root, "2026-11-01", "t").unwrap().is_some());
        assert!(auto_backup(&ws.root, "2026-11-01", "t").unwrap().is_none());
        let dir = ws.root.join(AUTO_DIR);
        fs::write(dir.join("내가 둔 파일.zip"), b"x").unwrap();
        for day in 2..=9 {
            auto_backup(&ws.root, &format!("2026-11-{day:02}"), "t").unwrap();
        }
        let mut names: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        assert_eq!(names.len(), AUTO_KEEP + 1);
        assert_eq!(names[0], "CetusNote-2026-11-03.zip");
        assert!(names.contains(&"내가 둔 파일.zip".to_owned()));
        assert_eq!(auto_list(&ws.root).unwrap()[0], "CetusNote-2026-11-09.zip");
        assert_eq!(
            auto_backup(&ws.root, "../x", "t").unwrap_err().code,
            "invalid_date"
        );
    }
}
