//! 워크스페이스 전체 Markdown 내보내기(DATA-10, ADR-014).
//! 프런트엔드가 만든 목록(manifest: 상대 경로 → 글 또는 워크스페이스 이미지)을 받아,
//! 사용자가 고른 폴더 안에 **새로 만든** `<이름> Markdown <날짜>` 폴더에만 쓴다.
//! 기존 파일은 덮어쓰지 않고, 이미지는 워크스페이스 `assets/` 안에서만 복사한다.

use super::{ASSET_MAX_BYTES, ASSETS_DIR, Result, StorageError, atomic_write, parse_asset_path};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// 한 번에 쓸 수 있는 파일 수(글 + 이미지 + 색인)
pub const MAX_FILES: usize = 50_000;
/// 폴더·파일 이름 한 조각의 최대 글자 수
const MAX_NAME_CHARS: usize = 100;
/// 같은 이름이 있을 때 붙이는 ` (2)`… 의 상한
const MAX_SUFFIX: usize = 999;

#[derive(Deserialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportFile {
    /// 내보낼 폴더 기준 상대 경로 (`/`로 나눈다)
    pub path: String,
    /// 글(Markdown). asset과 둘 중 하나만
    #[serde(default)]
    pub text: Option<String>,
    /// 워크스페이스 기준 이미지 경로(`assets/<페이지 id>/<파일>`). 그대로 복사한다
    #[serde(default)]
    pub asset: Option<String>,
}

#[derive(Deserialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportManifest {
    /// 만들 폴더 이름(프런트엔드가 `<워크스페이스> Markdown <날짜>`로 준다). 여기서도 한 번 더 거른다
    pub root_name: String,
    pub files: Vec<ExportFile>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExportReport {
    /// 만든 폴더 이름 (실제로 붙은 이름, ` (2)` 포함)
    pub folder: String,
    /// 쓰지 못한 항목의 상대 경로 (덮어쓰기 거절·읽기 실패 포함)
    pub failed: Vec<String>,
    pub written: usize,
    /// 폴더 열기용 전체 경로 — 프런트엔드로 보내지 않는다
    #[serde(skip)]
    pub path: PathBuf,
}

/// 상대 경로를 검사해 조각으로 나눈다. 절대 경로·`..`·`.`·숨김 조각·역슬래시·드라이브 문자는 거절한다.
pub fn check_rel_path(path: &str) -> Result<Vec<&str>> {
    let bad = || StorageError::new("invalid_path", format!("잘못된 내보내기 경로: {path:?}"));
    if path.is_empty() || path.len() > 1024 || path.starts_with('/') {
        return Err(bad());
    }
    if path.contains(['\\', '\0', ':']) {
        return Err(bad());
    }
    let parts: Vec<&str> = path.split('/').collect();
    for part in &parts {
        if part.is_empty() || part.starts_with('.') || part.len() > 255 {
            return Err(bad());
        }
    }
    Ok(parts)
}

/// 폴더·파일 이름 한 조각을 정리한다: 금지 글자·제어 문자 제거, 공백 정리, 앞의 점 제거, 최대 100자.
pub fn sanitize_name(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| {
            if c.is_control() || matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') {
                ' '
            } else {
                c
            }
        })
        .collect();
    let collapsed = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = collapsed.trim_start_matches('.').trim();
    let cut: String = trimmed.chars().take(MAX_NAME_CHARS).collect();
    let cut = cut.trim().to_string();
    if cut.is_empty() {
        "제목 없음".to_string()
    } else if is_windows_reserved(&cut) {
        // Windows는 CON·NUL 같은 장치 이름을 파일 이름으로 쓰지 못한다(SYS-08). 앞에 밑줄을 붙인다
        format!("_{cut}")
    } else {
        cut
    }
}

/// Windows 예약 장치 이름인가(확장자를 떼고, 대소문자 무시). CON, PRN, AUX, NUL, COM1–9, LPT1–9
fn is_windows_reserved(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or(name).trim_end().to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.as_bytes()[3].is_ascii_digit()
            && stem.as_bytes()[3] != b'0')
}

/// `parent` 안에 `base`(없으면 ` (2)`, ` (3)`…)로 새 폴더를 만든다. 만든 경로를 돌려준다.
pub fn create_unique_folder(parent: &Path, base: &str) -> io::Result<PathBuf> {
    for n in 1..=MAX_SUFFIX {
        let name = if n == 1 {
            base.to_string()
        } else {
            format!("{base} ({n})")
        };
        let candidate = parent.join(&name);
        match fs::create_dir(&candidate) {
            Ok(()) => return Ok(candidate),
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e),
        }
    }
    Err(io::Error::other("같은 이름의 폴더가 너무 많아요"))
}

/// 워크스페이스 이미지를 `dest`로 복사한다. 링크(폴더·파일)는 따라가지 않고, `assets/<id>/<파일>` 형식만 받는다.
pub fn copy_asset(ws_root: &Path, src: &str, dest: &Path) -> Result<()> {
    let (id, name) = parse_asset_path(src)?;
    let assets = ws_root.join(ASSETS_DIR);
    let dir = assets.join(id);
    let file = dir.join(name);
    for p in [&assets, &dir, &file] {
        if fs::symlink_metadata(p).is_ok_and(|m| m.file_type().is_symlink()) {
            return Err(StorageError::new("symlink", "링크는 내보내지 않아요"));
        }
    }
    let meta = fs::metadata(&file)?;
    if !meta.is_file() {
        return Err(StorageError::new("not_found", "이미지 파일이 없어요"));
    }
    if meta.len() > ASSET_MAX_BYTES as u64 {
        return Err(StorageError::new("too_large", "이미지가 25MB보다 커요"));
    }
    fs::copy(&file, dest)?;
    Ok(())
}

fn write_one(ws_root: &Path, root: &Path, file: &ExportFile) -> Result<()> {
    let parts = check_rel_path(&file.path)?;
    let (name, dirs) = parts
        .split_last()
        .ok_or_else(|| StorageError::new("invalid_path", "잘못된 내보내기 경로"))?;
    let mut dir = root.to_path_buf();
    for part in dirs {
        dir.push(part);
        match fs::symlink_metadata(&dir) {
            Ok(m) if m.is_dir() => {}
            Ok(_) => {
                return Err(StorageError::new(
                    "invalid_path",
                    "폴더 자리에 파일이 있어요",
                ));
            }
            Err(_) => fs::create_dir(&dir)?,
        }
    }
    let target = dir.join(name);
    if fs::symlink_metadata(&target).is_ok() {
        return Err(StorageError::new(
            "exists",
            "같은 이름의 파일이 이미 있어요",
        ));
    }
    match (&file.text, &file.asset) {
        (Some(text), None) => atomic_write(&target, text.as_bytes())?,
        (None, Some(src)) => copy_asset(ws_root, src, &target)?,
        _ => {
            return Err(StorageError::new(
                "invalid_path",
                "글이나 이미지 중 하나만 있어야 해요",
            ));
        }
    }
    Ok(())
}

/// 목록을 `parent` 안의 새 폴더에 쓴다. 한 항목이 실패해도 나머지는 쓰고, 실패한 경로를 돌려준다.
/// 폴더를 만들지 못하면 오류다(아무것도 쓰지 않는다).
pub fn write_export(
    ws_root: &Path,
    parent: &Path,
    manifest: &ExportManifest,
) -> Result<ExportReport> {
    if manifest.files.len() > MAX_FILES {
        return Err(StorageError::new("too_large", "내보낼 파일이 너무 많아요"));
    }
    let root = create_unique_folder(parent, &sanitize_name(&manifest.root_name))?;
    let mut written = 0;
    let mut failed = Vec::new();
    for file in &manifest.files {
        match write_one(ws_root, &root, file) {
            Ok(()) => written += 1,
            Err(_) => failed.push(file.path.clone()),
        }
    }
    let folder = root
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(ExportReport {
        folder,
        failed,
        written,
        path: root,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR";
    const ID: &str = "01JD0000000000000000000000";

    /// 워크스페이스 폴더 하나와 내보낼 상위 폴더 하나
    fn dirs() -> (tempfile::TempDir, PathBuf, PathBuf) {
        let t = tempfile::tempdir().unwrap();
        let ws = t.path().join("ws");
        let out = t.path().join("out");
        fs::create_dir_all(ws.join("assets").join(ID)).unwrap();
        fs::create_dir_all(&out).unwrap();
        fs::write(ws.join("assets").join(ID).join("img-1.png"), PNG).unwrap();
        fs::write(ws.join("workspace.json"), b"{}").unwrap();
        (t, ws, out)
    }

    fn text(path: &str, body: &str) -> ExportFile {
        ExportFile {
            path: path.into(),
            text: Some(body.into()),
            asset: None,
        }
    }

    fn asset(path: &str, src: &str) -> ExportFile {
        ExportFile {
            path: path.into(),
            text: None,
            asset: Some(src.into()),
        }
    }

    fn manifest(files: Vec<ExportFile>) -> ExportManifest {
        ExportManifest {
            root_name: "내 노트 Markdown 2026-11-21".into(),
            files,
        }
    }

    #[test]
    fn rel_path_accepts_plain_and_korean_paths() {
        assert_eq!(check_rel_path("a/b (2).md").unwrap(), vec!["a", "b (2).md"]);
        assert!(check_rel_path("회의/주간 회의.md").is_ok());
        assert!(check_rel_path("assets/01J/img-1.png").is_ok());
    }

    #[test]
    fn rel_path_rejects_escapes_and_hidden_parts() {
        for bad in [
            "",
            "/etc/passwd",
            "../x.md",
            "a/../../x.md",
            "a//b.md",
            "./a.md",
            "a/./b.md",
            "a\\b.md",
            "C:x.md",
            ".hidden.md",
            "a/.git/config",
            "trail/",
            "nul\0.md",
        ] {
            assert!(check_rel_path(bad).is_err(), "should reject {bad:?}");
        }
    }

    #[test]
    fn sanitize_strips_forbidden_chars_and_caps_length() {
        assert_eq!(
            sanitize_name("a/b:c*d?e\"f<g>h|i\\j"),
            "a b c d e f g h i j"
        );
        assert_eq!(sanitize_name("  ..hidden  "), "hidden");
        assert_eq!(sanitize_name("   "), "제목 없음");
        assert_eq!(sanitize_name("CON"), "_CON");
        assert_eq!(sanitize_name("nul.txt"), "_nul.txt");
        assert_eq!(sanitize_name("com1"), "_com1");
        assert_eq!(sanitize_name("COM0"), "COM0");
        assert_eq!(sanitize_name("console"), "console");
        assert_eq!(sanitize_name("x\u{7}y"), "x y");
        assert_eq!(
            sanitize_name(&"가".repeat(300)).chars().count(),
            MAX_NAME_CHARS
        );
    }

    #[test]
    fn unique_folder_adds_numbered_suffix() {
        let (_t, _ws, out) = dirs();
        let a = create_unique_folder(&out, "노트").unwrap();
        let b = create_unique_folder(&out, "노트").unwrap();
        let c = create_unique_folder(&out, "노트").unwrap();
        assert_eq!(a.file_name().unwrap(), "노트");
        assert_eq!(b.file_name().unwrap(), "노트 (2)");
        assert_eq!(c.file_name().unwrap(), "노트 (3)");
    }

    #[test]
    fn write_creates_nested_files_in_new_folder_only() {
        let (_t, ws, out) = dirs();
        let report = write_export(
            &ws,
            &out,
            &manifest(vec![
                text("회의/주간.md", "# 주간\n"),
                text("index.md", "table"),
            ]),
        )
        .unwrap();
        assert_eq!(report.written, 2);
        assert!(report.failed.is_empty());
        assert_eq!(report.folder, "내 노트 Markdown 2026-11-21");
        let root = out.join(&report.folder);
        assert_eq!(report.path, root);
        assert_eq!(
            fs::read_to_string(root.join("회의/주간.md")).unwrap(),
            "# 주간\n"
        );
        assert_eq!(fs::read_to_string(root.join("index.md")).unwrap(), "table");
        // 상위 폴더에는 새 폴더 하나만 생긴다
        assert_eq!(fs::read_dir(&out).unwrap().count(), 1);
    }

    #[test]
    fn second_export_gets_new_folder_and_never_overwrites() {
        let (_t, ws, out) = dirs();
        let first = write_export(&ws, &out, &manifest(vec![text("a.md", "first")])).unwrap();
        let second = write_export(&ws, &out, &manifest(vec![text("a.md", "second")])).unwrap();
        assert_eq!(second.folder, "내 노트 Markdown 2026-11-21 (2)");
        assert_eq!(
            fs::read_to_string(first.path.join("a.md")).unwrap(),
            "first"
        );
        assert_eq!(
            fs::read_to_string(second.path.join("a.md")).unwrap(),
            "second"
        );
    }

    #[test]
    fn existing_target_is_reported_not_overwritten() {
        let (_t, ws, out) = dirs();
        // 같은 실행 안에서 같은 경로가 두 번 오면 두 번째는 실패로 남는다
        let report = write_export(
            &ws,
            &out,
            &manifest(vec![text("a.md", "one"), text("a.md", "two")]),
        )
        .unwrap();
        assert_eq!(report.written, 1);
        assert_eq!(report.failed, vec!["a.md".to_string()]);
        assert_eq!(fs::read_to_string(report.path.join("a.md")).unwrap(), "one");
    }

    #[test]
    fn file_blocking_a_directory_path_fails_that_entry_only() {
        let (_t, ws, out) = dirs();
        let report = write_export(
            &ws,
            &out,
            &manifest(vec![
                text("a", "file"),
                text("a/b.md", "child"),
                text("c.md", "ok"),
            ]),
        )
        .unwrap();
        assert_eq!(report.written, 2);
        assert_eq!(report.failed, vec!["a/b.md".to_string()]);
        assert_eq!(fs::read_to_string(report.path.join("c.md")).unwrap(), "ok");
    }

    #[test]
    fn asset_is_copied_from_workspace_assets() {
        let (_t, ws, out) = dirs();
        let src = format!("assets/{ID}/img-1.png");
        let report = write_export(
            &ws,
            &out,
            &manifest(vec![asset(&src, &src), text("p.md", "![](x)")]),
        )
        .unwrap();
        assert_eq!(report.written, 2);
        assert_eq!(fs::read(report.path.join(&src)).unwrap(), PNG);
    }

    #[test]
    fn asset_copy_is_restricted_to_workspace_assets() {
        let (_t, ws, out) = dirs();
        // 워크스페이스 밖 파일, 자산 형식이 아닌 경로, 조각 밖으로 나가는 경로는 모두 거절
        fs::write(out.join("secret.png"), PNG).unwrap();
        for src in [
            "../out/secret.png".to_string(),
            "workspace.json".to_string(),
            format!("pages/{ID}.json"),
            format!("assets/{ID}/../../workspace.json"),
            format!("assets/{ID}/missing.png"),
            format!("assets/../{ID}/img-1.png"),
        ] {
            let report = write_export(&ws, &out, &manifest(vec![asset("img.png", &src)])).unwrap();
            assert_eq!(report.written, 0, "should not copy {src}");
            assert_eq!(report.failed, vec!["img.png".to_string()]);
            assert!(!report.path.join("img.png").exists());
        }
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_asset_is_not_followed() {
        let (t, ws, out) = dirs();
        let outside = t.path().join("outside.png");
        fs::write(&outside, PNG).unwrap();
        let link_dir = ws.join("assets").join("01JD0000000000000000000001");
        fs::create_dir_all(&link_dir).unwrap();
        std::os::unix::fs::symlink(&outside, link_dir.join("img-2.png")).unwrap();
        let src = "assets/01JD0000000000000000000001/img-2.png";
        let report = write_export(&ws, &out, &manifest(vec![asset("x.png", src)])).unwrap();
        assert_eq!(report.written, 0);
        assert_eq!(report.failed, vec!["x.png".to_string()]);
    }

    #[test]
    fn entry_with_both_or_neither_body_is_rejected() {
        let (_t, ws, out) = dirs();
        let both = ExportFile {
            path: "a.md".into(),
            text: Some("x".into()),
            asset: Some(format!("assets/{ID}/img-1.png")),
        };
        let neither = ExportFile {
            path: "b.md".into(),
            text: None,
            asset: None,
        };
        let report = write_export(&ws, &out, &manifest(vec![both, neither])).unwrap();
        assert_eq!(report.written, 0);
        assert_eq!(report.failed.len(), 2);
    }

    #[test]
    fn traversal_in_manifest_paths_writes_nothing_outside() {
        let (t, ws, out) = dirs();
        let report = write_export(
            &ws,
            &out,
            &manifest(vec![text("../escape.md", "x"), text("/abs.md", "y")]),
        )
        .unwrap();
        assert_eq!(report.written, 0);
        assert!(!t.path().join("escape.md").exists());
        assert!(!Path::new("/abs.md").exists());
    }

    #[test]
    fn too_many_files_is_refused_before_creating_folder() {
        let (_t, ws, out) = dirs();
        let files = (0..=MAX_FILES)
            .map(|i| text(&format!("{i}.md"), ""))
            .collect();
        assert!(write_export(&ws, &out, &manifest(files)).is_err());
        assert_eq!(fs::read_dir(&out).unwrap().count(), 0);
    }
}
