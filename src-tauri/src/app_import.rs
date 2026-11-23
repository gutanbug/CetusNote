//! 다른 앱에서 가져오기(DATA-11, ADR-017): zip 또는 폴더의 항목 목록과 항목 바이트 읽기.
//! - 경로는 프런트엔드에 절대 경로로 주지 않는다. 목록의 상대 경로(`/` 구분)로만 주고받는다.
//! - zip 안의 zip은 한 단계만 펼친다(Notion 분할 내보내기). 안의 zip 안에 또 zip이 있으면 건너뛴다.
//! - 글 파일(md·csv·html·txt)은 목록을 만들 때 글자로 함께 돌려주고, 그림 등은 `read_entry`로 필요할 때 읽는다.
//! - 심볼릭 링크·숨김 파일(`.`으로 시작)·`__MACOSX`는 건너뛴다. 이름의 `..`·절대 경로·역슬래시는 거절한다.
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

use zip::ZipArchive;

use crate::storage::{Result, StorageError};

/** 항목 수 · 글 파일 한 개 · 그림 한 개 · zip 한 개(안의 zip 포함) · 목록 전체 합 */
pub const MAX_ENTRIES: usize = 20_000;
pub const MAX_TEXT_BYTES: u64 = 10 * 1024 * 1024;
pub const MAX_ASSET_BYTES: u64 = 25 * 1024 * 1024;
pub const MAX_ZIP_BYTES: u64 = 512 * 1024 * 1024;
pub const MAX_TOTAL_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_DEPTH: usize = 32;
const TEXT_EXTS: [&str; 6] = ["md", "markdown", "csv", "html", "htm", "txt"];

/** 고른 원본. zip 파일 또는 폴더 */
#[derive(Clone, Debug)]
pub enum Source {
    Zip(PathBuf),
    Folder(PathBuf),
}

/** 항목이 어디서 왔는지. zip은 안의 원래 이름(raw)을 그대로 적는다(zip이 찾을 때 쓴다) */
#[derive(Clone, Debug)]
pub enum Origin {
    File(PathBuf),
    Zip {
        member: String,
        inner: Option<String>,
    },
}

#[derive(Clone, Debug)]
pub struct Entry {
    pub path: String,
    pub origin: Origin,
}

#[derive(Debug, Default)]
pub struct Listing {
    pub entries: Vec<Entry>,
    /** 글 파일의 글자 (경로, 글) */
    pub texts: Vec<(String, String)>,
    /** 쓸 수 없거나 너무 큰 항목의 이름 */
    pub skipped: Vec<String>,
}

#[derive(Default)]
struct Builder {
    listing: Listing,
    seen: HashSet<String>,
    total: u64,
}

impl Builder {
    /// 항목 하나를 목록에 넣는다. 안전한 경로면 정리한 경로를 돌려준다. 안 넣으면 None
    fn add(&mut self, raw: &str, size: u64, origin: Origin) -> Result<Option<String>> {
        let Some(path) = safe_path(raw) else {
            self.listing.skipped.push(raw.to_owned());
            return Ok(None);
        };
        if is_hidden(&path) {
            return Ok(None);
        }
        if size > cap_for(&path) {
            self.listing.skipped.push(path);
            return Ok(None);
        }
        if !self.seen.insert(path.clone()) {
            return Ok(None);
        }
        if self.listing.entries.len() >= MAX_ENTRIES {
            return Err(StorageError::new("too_large", "항목이 너무 많아요"));
        }
        self.total += size;
        if self.total > MAX_TOTAL_BYTES {
            return Err(StorageError::new("too_large", "가져올 내용이 너무 커요"));
        }
        self.listing.entries.push(Entry {
            path: path.clone(),
            origin,
        });
        Ok(Some(path))
    }
}

/** 목록의 상대 경로 검사: 빈 경로·절대 경로·역슬래시·드라이브 문자·`..`는 거절 */
pub fn safe_path(raw: &str) -> Option<String> {
    if raw.is_empty() || raw.starts_with('/') || raw.contains('\\') || raw.contains('\0') {
        return None;
    }
    let b = raw.as_bytes();
    if b.len() >= 2 && b[1] == b':' && b[0].is_ascii_alphabetic() {
        return None;
    }
    let parts: Vec<&str> = raw
        .split('/')
        .filter(|p| !p.is_empty() && *p != ".")
        .collect();
    if parts.is_empty() || parts.iter().any(|p| *p == "..") {
        return None;
    }
    Some(parts.join("/"))
}

fn is_hidden(path: &str) -> bool {
    path.split('/')
        .any(|p| p.starts_with('.') || p == "__MACOSX")
}

fn ext_of(path: &str) -> String {
    let name = path.rsplit('/').next().unwrap_or(path);
    match name.rfind('.') {
        Some(i) if i > 0 => name[i + 1..].to_ascii_lowercase(),
        _ => String::new(),
    }
}

fn is_text(path: &str) -> bool {
    TEXT_EXTS.contains(&ext_of(path).as_str())
}

fn cap_for(path: &str) -> u64 {
    if is_text(path) {
        MAX_TEXT_BYTES
    } else {
        MAX_ASSET_BYTES
    }
}

fn zip_err(e: zip::result::ZipError) -> StorageError {
    match e {
        zip::result::ZipError::Io(io) => io.into(),
        _ => StorageError::new("invalid_archive", "zip 파일을 읽지 못했어요"),
    }
}

/** 최대 `cap` 바이트까지 읽는다. 넘으면 too_large */
fn read_capped<R: Read>(r: R, cap: u64) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    r.take(cap + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > cap {
        return Err(StorageError::new("too_large", "파일이 너무 커요"));
    }
    Ok(bytes)
}

fn is_symlink_mode(mode: Option<u32>) -> bool {
    mode.is_some_and(|m| m & 0o170000 == 0o120000)
}

/** zip 파일 목록. 안의 zip은 한 단계만 펼친다 */
pub fn list_zip(path: &Path) -> Result<Listing> {
    let mut zip = ZipArchive::new(File::open(path)?).map_err(zip_err)?;
    let mut b = Builder::default();
    let mut nested: Vec<(String, u64)> = Vec::new();
    for i in 0..zip.len() {
        let mut f = zip.by_index(i).map_err(zip_err)?;
        if f.is_dir() {
            continue;
        }
        let raw = f.name().to_owned();
        let size = f.size();
        if is_symlink_mode(f.unix_mode()) {
            b.listing.skipped.push(raw);
            continue;
        }
        if raw.to_ascii_lowercase().ends_with(".zip") {
            nested.push((raw, size));
            continue;
        }
        let origin = Origin::Zip {
            member: raw.clone(),
            inner: None,
        };
        if let Some(p) = b.add(&raw, size, origin)? {
            if is_text(&p) {
                let text =
                    String::from_utf8_lossy(&read_capped(&mut f, MAX_TEXT_BYTES)?).into_owned();
                b.listing.texts.push((p, text));
            }
        }
    }
    for (name, size) in nested {
        let Some(outer) = safe_path(&name) else {
            b.listing.skipped.push(name);
            continue;
        };
        if size > MAX_ZIP_BYTES || is_hidden(&outer) {
            b.listing.skipped.push(outer);
            continue;
        }
        let bytes = read_capped(zip.by_name(&name).map_err(zip_err)?, MAX_ZIP_BYTES);
        let Ok(bytes) = bytes else {
            b.listing.skipped.push(outer);
            continue;
        };
        let Ok(mut inner) = ZipArchive::new(Cursor::new(bytes)) else {
            b.listing.skipped.push(outer);
            continue;
        };
        for j in 0..inner.len() {
            let mut f = inner.by_index(j).map_err(zip_err)?;
            if f.is_dir() {
                continue;
            }
            let raw = f.name().to_owned();
            let size = f.size();
            if is_symlink_mode(f.unix_mode()) || raw.to_ascii_lowercase().ends_with(".zip") {
                b.listing.skipped.push(raw);
                continue;
            }
            let origin = Origin::Zip {
                member: name.clone(),
                inner: Some(raw.clone()),
            };
            if let Some(p) = b.add(&raw, size, origin)? {
                if is_text(&p) {
                    let text =
                        String::from_utf8_lossy(&read_capped(&mut f, MAX_TEXT_BYTES)?).into_owned();
                    b.listing.texts.push((p, text));
                }
            }
        }
    }
    Ok(b.listing)
}

/** 폴더 목록. 심볼릭 링크와 숨김 파일은 따라가지 않는다 */
pub fn list_folder(root: &Path) -> Result<Listing> {
    let mut b = Builder::default();
    walk(root, "", 0, &mut b)?;
    Ok(b.listing)
}

fn walk(dir: &Path, rel: &str, depth: usize, b: &mut Builder) -> Result<()> {
    if depth > MAX_DEPTH {
        return Ok(());
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let raw = if rel.is_empty() {
            name
        } else {
            format!("{rel}/{name}")
        };
        let meta = fs::symlink_metadata(entry.path())?;
        if meta.file_type().is_symlink() {
            b.listing.skipped.push(raw);
            continue;
        }
        if meta.is_dir() {
            if !is_hidden(&raw) {
                walk(&entry.path(), &raw, depth + 1, b)?;
            }
            continue;
        }
        if !meta.is_file() {
            continue;
        }
        let size = meta.len();
        if let Some(p) = b.add(&raw, size, Origin::File(entry.path()))? {
            if is_text(&p) && size <= MAX_TEXT_BYTES {
                let text = String::from_utf8_lossy(&fs::read(entry.path())?).into_owned();
                b.listing.texts.push((p, text));
            }
        }
    }
    Ok(())
}

/** 항목 하나의 바이트. 원본을 다시 열어 읽는다 */
pub fn read_entry(source: &Source, entry: &Entry) -> Result<Vec<u8>> {
    let cap = cap_for(&entry.path);
    match (source, &entry.origin) {
        (Source::Folder(root), Origin::File(p)) => {
            if !p.starts_with(root) {
                return Err(StorageError::new(
                    "invalid_path",
                    "가져올 수 없는 파일이에요",
                ));
            }
            read_capped(File::open(p)?, cap)
        }
        (
            Source::Zip(zp),
            Origin::Zip {
                member,
                inner: None,
            },
        ) => {
            let mut zip = ZipArchive::new(File::open(zp)?).map_err(zip_err)?;
            read_capped(zip.by_name(member).map_err(zip_err)?, cap)
        }
        (
            Source::Zip(zp),
            Origin::Zip {
                member,
                inner: Some(name),
            },
        ) => {
            let mut zip = ZipArchive::new(File::open(zp)?).map_err(zip_err)?;
            let outer = read_capped(zip.by_name(member).map_err(zip_err)?, MAX_ZIP_BYTES)?;
            let mut inner = ZipArchive::new(Cursor::new(outer)).map_err(zip_err)?;
            read_capped(inner.by_name(name).map_err(zip_err)?, cap)
        }
        _ => Err(StorageError::new(
            "invalid_path",
            "가져올 수 없는 파일이에요",
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    fn make_zip(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut w = zip::ZipWriter::new(Cursor::new(Vec::new()));
        for (name, bytes) in entries {
            w.start_file(*name, SimpleFileOptions::default()).unwrap();
            w.write_all(bytes).unwrap();
        }
        w.finish().unwrap().into_inner()
    }

    fn tmp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cn-app-import-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn safe_path_rejects_escapes() {
        assert_eq!(safe_path("../a.md"), None);
        assert_eq!(safe_path("/etc/a.md"), None);
        assert_eq!(safe_path("a\\..\\b.md"), None);
        assert_eq!(safe_path("C:/a.md"), None);
        assert_eq!(safe_path(""), None);
        assert_eq!(safe_path("a/./b.md").as_deref(), Some("a/b.md"));
    }

    #[test]
    fn zip_lists_text_skips_hidden_and_flattens_one_nested_zip() {
        let inner = make_zip(&[
            ("Part/본문.md", "# 본문".as_bytes()),
            ("Part/그림.png", &[1, 2, 3]),
        ]);
        let outer_bytes = make_zip(&[
            ("내보내기-Part-1.zip", &inner),
            ("루트.md", "루트 글".as_bytes()),
            (".DS_Store", b"x"),
            ("__MACOSX/a", b"x"),
            ("../밖.md", b"x"),
        ]);
        let dir = tmp("zip");
        let path = dir.join("export.zip");
        fs::write(&path, &outer_bytes).unwrap();
        let listing = list_zip(&path).unwrap();
        let mut paths: Vec<&str> = listing.entries.iter().map(|e| e.path.as_str()).collect();
        paths.sort();
        assert_eq!(paths, vec!["Part/그림.png", "Part/본문.md", "루트.md"]);
        assert!(listing.skipped.contains(&"../밖.md".to_owned()));
        let texts: Vec<&str> = listing.texts.iter().map(|(p, _)| p.as_str()).collect();
        assert!(texts.contains(&"루트.md") && texts.contains(&"Part/본문.md"));

        let source = Source::Zip(path.clone());
        let img = listing
            .entries
            .iter()
            .find(|e| e.path == "Part/그림.png")
            .unwrap();
        assert_eq!(read_entry(&source, img).unwrap(), vec![1, 2, 3]);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn zip_skips_second_level_nested_zip() {
        let deepest = make_zip(&[("x.md", b"x")]);
        let inner = make_zip(&[("deep.zip", &deepest), ("y.md", b"y")]);
        let dir = tmp("deep");
        let path = dir.join("e.zip");
        fs::write(&path, make_zip(&[("p.zip", &inner)])).unwrap();
        let listing = list_zip(&path).unwrap();
        let paths: Vec<&str> = listing.entries.iter().map(|e| e.path.as_str()).collect();
        assert_eq!(paths, vec!["y.md"]);
        assert!(listing.skipped.contains(&"deep.zip".to_owned()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn folder_lists_text_and_reads_bytes() {
        let dir = tmp("folder");
        fs::create_dir_all(dir.join("하위")).unwrap();
        fs::write(dir.join("하위/글.md"), "안녕".as_bytes()).unwrap();
        fs::write(dir.join("그림.png"), [9u8, 8]).unwrap();
        fs::write(dir.join(".hidden.md"), b"x").unwrap();
        let listing = list_folder(&dir).unwrap();
        let mut paths: Vec<&str> = listing.entries.iter().map(|e| e.path.as_str()).collect();
        paths.sort();
        assert_eq!(paths, vec!["그림.png", "하위/글.md"]);
        assert_eq!(listing.texts.len(), 1);
        assert_eq!(listing.texts[0].1, "안녕");
        let source = Source::Folder(dir.clone());
        let png = listing
            .entries
            .iter()
            .find(|e| e.path == "그림.png")
            .unwrap();
        assert_eq!(read_entry(&source, png).unwrap(), vec![9, 8]);
        let _ = fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn folder_skips_symlinks() {
        let dir = tmp("link");
        fs::write(dir.join("real.md"), b"r").unwrap();
        std::os::unix::fs::symlink(dir.join("real.md"), dir.join("alias.md")).unwrap();
        let listing = list_folder(&dir).unwrap();
        let paths: Vec<&str> = listing.entries.iter().map(|e| e.path.as_str()).collect();
        assert_eq!(paths, vec!["real.md"]);
        assert_eq!(listing.skipped, vec!["alias.md".to_owned()]);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn oversized_text_is_skipped() {
        let dir = tmp("big");
        let big = vec![b'a'; (MAX_TEXT_BYTES + 1) as usize];
        fs::write(dir.join("big.md"), &big).unwrap();
        let listing = list_folder(&dir).unwrap();
        assert!(listing.entries.is_empty());
        assert_eq!(listing.skipped, vec!["big.md".to_owned()]);
        let _ = fs::remove_dir_all(&dir);
    }
}
