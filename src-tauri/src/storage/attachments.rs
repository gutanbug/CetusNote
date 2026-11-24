//! 파일 첨부 저장 (EDIT-31~33, ADR-025). 원본을 워크스페이스 `assets/<페이지 id>/<첨부 id>-<정리한 이름>`으로 복사한다.
//!
//! 종류(kind)와 크기 상한은 `src/lib/attachments/limits.ts`와 같아야 한다.
//! 같은 값을 TS 테스트(`attachments-limits.test.ts`)가 이 파일에서 읽어 비교한다.

#[cfg(test)]
use super::Workspace;
#[cfg(test)]
use super::is_valid_id;
use super::{
    ASSET_MAX_BYTES, ASSETS_DIR, Result, StorageError, check_id, parse_asset_path, unique_suffix,
};
use serde::Serialize;
use std::collections::hash_map::RandomState;
use std::fs::{self, File};
use std::hash::{BuildHasher, Hasher};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// 파일 첨부 상한 (사용자 결정 2026-11-24): 25MB
pub const FILE_MAX_BYTES: u64 = 25 * 1024 * 1024;
/// 영상·소리 상한 (사용자 결정 2026-11-24): 200MB
pub const MEDIA_MAX_BYTES: u64 = 200 * 1024 * 1024;
/// `assets/<id>/<파일>`의 파일 이름 최대 길이 (parse_asset_path). 앞의 26자 id와 `-`를 뺀 나머지
const SAFE_NAME_MAX: usize = 100 - 27;
const ATTACHMENT_ID_LEN: usize = 26;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AttachmentKind {
    File,
    Pdf,
    Video,
    Audio,
}

impl AttachmentKind {
    /// 커맨드 인자 `kind`: "file" · "pdf" · "media"(영상·소리). 모르는 값은 None
    pub fn from_arg(arg: &str) -> Option<Option<Self>> {
        match arg {
            "file" => Some(None),
            "pdf" => Some(Some(Self::Pdf)),
            "media" => Some(Some(Self::Video)),
            _ => None,
        }
    }
}

/// 크기 상한 묶음. 테스트에서는 작은 값을 넣으려고 따로 받는다
#[derive(Clone, Copy)]
pub struct Limits {
    pub file: u64,
    pub media: u64,
}

pub const DEFAULT_LIMITS: Limits = Limits {
    file: FILE_MAX_BYTES,
    media: MEDIA_MAX_BYTES,
};

impl Limits {
    fn of(self, kind: AttachmentKind) -> u64 {
        match kind {
            AttachmentKind::Video | AttachmentKind::Audio => self.media,
            AttachmentKind::File | AttachmentKind::Pdf => self.file,
        }
    }
}

/// 프론트엔드가 받는 첨부 정보. `path`는 워크스페이스 기준 상대 경로
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub path: String,
    /// 원본 파일 이름(표시용, 유니코드 가능)
    pub name: String,
    pub size: u64,
    pub mime: String,
    pub kind: AttachmentKind,
}

/// 확장자(소문자, 점 없음). TS `extensionOf`와 같다: 점이 없거나 맨 앞에만 있으면 ""
pub fn extension_of(name: &str) -> String {
    match name.rfind('.') {
        Some(dot) if dot > 0 && dot + 1 < name.len() => name[dot + 1..].to_ascii_lowercase(),
        _ => String::new(),
    }
}

/// MIME이 있으면 먼저 보고, 없으면 확장자로 종류를 정한다 (TS `attachmentKind`와 같은 규칙)
pub fn kind_of(name: &str, mime: Option<&str>) -> AttachmentKind {
    let ext = extension_of(name);
    let ty = mime.unwrap_or("").to_ascii_lowercase();
    let no_mime = ty.is_empty();
    if ty == "application/pdf" || (no_mime && ext == "pdf") {
        AttachmentKind::Pdf
    } else if ty.starts_with("video/")
        || (no_mime && matches!(ext.as_str(), "mp4" | "m4v" | "mov" | "webm" | "mkv" | "avi"))
    {
        AttachmentKind::Video
    } else if ty.starts_with("audio/")
        || (no_mime
            && matches!(
                ext.as_str(),
                "mp3" | "m4a" | "wav" | "ogg" | "oga" | "flac" | "aac" | "opus"
            ))
    {
        AttachmentKind::Audio
    } else {
        AttachmentKind::File
    }
}

/// 확장자로 MIME을 정한다. 모르면 일반 바이너리
pub fn mime_of(name: &str) -> &'static str {
    match extension_of(name).as_str() {
        "pdf" => "application/pdf",
        "mp4" => "video/mp4",
        "m4v" => "video/x-m4v",
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "avi" => "video/x-msvideo",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "wav" => "audio/wav",
        "ogg" | "oga" => "audio/ogg",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        "opus" => "audio/opus",
        "txt" => "text/plain",
        "md" => "text/markdown",
        "csv" => "text/csv",
        "json" => "application/json",
        "zip" => "application/zip",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        _ => "application/octet-stream",
    }
}

/// 파일 이름을 `assets` 안에서 안전한 이름으로 바꾼다: ASCII 영문·숫자·`-_.`만, 점으로 시작하지 않음, 길이 상한.
/// 다른 글자는 `_`로 바꾸고 확장자는 보존한다. 원본 이름은 호출한 쪽이 따로 들고 있다.
pub fn safe_name(name: &str) -> String {
    // 경로 조각은 버린다 (`../` · `C:\` 포함)
    let base = name.rsplit(['/', '\\']).next().unwrap_or("");
    let mut out = String::new();
    for c in base.chars() {
        if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.') {
            out.push(c);
        } else {
            out.push('_');
        }
    }
    let out = out.trim_start_matches('.').to_string();
    if !out.chars().any(|c| c.is_ascii_alphanumeric()) {
        return "file".to_string();
    }
    if out.len() <= SAFE_NAME_MAX {
        return out;
    }
    let ext = extension_of(&out);
    let keep_ext = !ext.is_empty() && ext.len() <= 10;
    let (stem, suffix) = if keep_ext {
        let cut = out.len() - ext.len() - 1;
        (&out[..cut], format!(".{ext}"))
    } else {
        (out.as_str(), String::new())
    };
    let room = SAFE_NAME_MAX - suffix.len();
    format!("{}{suffix}", &stem[..room.min(stem.len())])
}

/// 첨부 id: 페이지 id와 같은 ULID 형식(26자 Crockford base32). 시각 + 임의 80비트
pub fn new_attachment_id() -> String {
    const ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0) as u128;
    let mut rnd_lo = RandomState::new().build_hasher();
    rnd_lo.write(unique_suffix().as_bytes());
    let lo = rnd_lo.finish() as u128;
    let mut rnd_hi = RandomState::new().build_hasher();
    rnd_hi.write_u128(ms);
    let hi = (rnd_hi.finish() & 0xFFFF) as u128;
    let value = ((ms & ((1u128 << 48) - 1)) << 80) | (hi << 64) | lo;
    (0..ATTACHMENT_ID_LEN)
        .rev()
        .map(|i| ALPHABET[((value >> (5 * i)) & 31) as usize] as char)
        .collect()
}

/// `assets/` 파일 하나의 최대 크기. 이미지(`img-…`)는 25MB, 그 밖의 첨부는 영상 상한까지
pub fn max_bytes_for_asset(name: &str) -> u64 {
    if name.starts_with("img-") {
        ASSET_MAX_BYTES as u64
    } else {
        MEDIA_MAX_BYTES
    }
}

fn too_large(kind: AttachmentKind) -> StorageError {
    let msg = match kind {
        AttachmentKind::Video | AttachmentKind::Audio => "영상·소리 파일이 너무 커요 (최대 200MB)",
        _ => "파일이 너무 커요 (최대 25MB)",
    };
    StorageError::new("too_large", msg)
}

/// 테스트용 메서드 형태 (커맨드는 `import_at`·`attachment_file_at`을 직접 부른다)
#[cfg(test)]
impl Workspace {
    /// 원본 파일을 그 페이지의 assets에 복사한다 (기본 상한).
    /// `want`가 있으면 종류가 맞아야 한다: pdf는 PDF만, media는 영상·소리만.
    pub fn import_attachment(
        &self,
        page_id: &str,
        src: &Path,
        want: Option<AttachmentKind>,
    ) -> Result<Attachment> {
        self.import_attachment_with(page_id, src, want, DEFAULT_LIMITS)
    }

    pub fn import_attachment_with(
        &self,
        page_id: &str,
        src: &Path,
        want: Option<AttachmentKind>,
        limits: Limits,
    ) -> Result<Attachment> {
        import_at(&self.root, page_id, src, want, limits)
    }

    /// `attachment_file_at(&self.root, path)`의 메서드 형태
    pub fn attachment_file(&self, path: &str) -> Result<PathBuf> {
        attachment_file_at(&self.root, path)
    }
}

/// 원본 파일을 `root`의 assets에 복사한다. 커맨드는 잠금을 풀고 이 함수를 부른다(큰 파일 복사 동안 잠그지 않는다).
pub fn import_at(
    root: &Path,
    page_id: &str,
    src: &Path,
    want: Option<AttachmentKind>,
    limits: Limits,
) -> Result<Attachment> {
    check_id(page_id)?;
    let name = src
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or_else(|| StorageError::new("invalid_asset", "파일 이름이 없어요"))?;
    let meta = fs::metadata(src).map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => StorageError::new("not_found", "파일이 없어요"),
        _ => e.into(),
    })?;
    if !meta.is_file() {
        return Err(StorageError::new("invalid_asset", "파일만 넣을 수 있어요"));
    }
    let mime = mime_of(&name);
    let kind = kind_of(&name, Some(mime));
    match want {
        Some(AttachmentKind::Pdf) if kind != AttachmentKind::Pdf => {
            return Err(StorageError::new("wrong_kind", "PDF 파일만 넣을 수 있어요"));
        }
        Some(AttachmentKind::Video)
            if !matches!(kind, AttachmentKind::Video | AttachmentKind::Audio) =>
        {
            return Err(StorageError::new(
                "wrong_kind",
                "영상·소리 파일만 넣을 수 있어요",
            ));
        }
        _ => {}
    }
    let max = limits.of(kind);
    if meta.len() > max {
        return Err(too_large(kind));
    }
    let dir = root.join(ASSETS_DIR).join(page_id);
    if fs::symlink_metadata(&dir).is_ok_and(|m| m.file_type().is_symlink()) {
        return Err(StorageError::new("symlink", "링크 폴더에는 쓰지 않아요"));
    }
    fs::create_dir_all(&dir)?;
    let file_name = format!("{}-{}", new_attachment_id(), safe_name(&name));
    let dest = dir.join(&file_name);
    let tmp = dir.join(format!(".{file_name}.{}.tmp", unique_suffix()));
    // 크기는 복사하면서도 다시 잰다(복사 중 파일이 커질 수 있다)
    let copied = (|| -> io::Result<u64> {
        let mut input = File::open(src)?;
        let mut out = File::create(&tmp)?;
        let n = io::copy(&mut (&mut input).take(max + 1), &mut out)?;
        out.sync_all()?;
        Ok(n)
    })();
    let size = match copied {
        Ok(n) if n <= max => n,
        Ok(_) => {
            let _ = fs::remove_file(&tmp);
            return Err(too_large(kind));
        }
        Err(e) => {
            let _ = fs::remove_file(&tmp);
            return Err(e.into());
        }
    };
    if let Err(e) = fs::rename(&tmp, &dest) {
        let _ = fs::remove_file(&tmp);
        return Err(e.into());
    }
    #[cfg(unix)]
    if let Ok(d) = File::open(&dir) {
        let _ = d.sync_all();
    }
    Ok(Attachment {
        path: format!("{ASSETS_DIR}/{page_id}/{file_name}"),
        name,
        size,
        mime: mime.to_string(),
        kind,
    })
}

/// 워크스페이스 기준 경로(`assets/<id>/<파일>`)를 절대 경로로 바꾼다. 링크·경로 이탈은 거절한다.
pub fn attachment_file_at(root: &Path, path: &str) -> Result<PathBuf> {
    let (id, name) = parse_asset_path(path)?;
    let dir = root.join(ASSETS_DIR).join(id);
    let file = dir.join(name);
    for p in [&dir, &file] {
        if fs::symlink_metadata(p).is_ok_and(|m| m.file_type().is_symlink()) {
            return Err(StorageError::new("symlink", "링크는 열지 않아요"));
        }
    }
    let meta = fs::metadata(&file).map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => StorageError::new("not_found", "파일이 없어요"),
        _ => e.into(),
    })?;
    if !meta.is_file() {
        return Err(StorageError::new("not_found", "파일이 없어요"));
    }
    Ok(file)
}

/// 워크스페이스 `assets/` 폴더 (asset 프로토콜 허용 범위)
pub fn assets_dir(root: &Path) -> PathBuf {
    root.join(ASSETS_DIR)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    const ID: &str = "01JD0000000000000000000000";

    fn ws() -> (TempDir, Workspace) {
        let dir = tempfile::tempdir().unwrap();
        let ws = Workspace::open(dir.path().to_path_buf()).unwrap();
        (dir, ws)
    }

    /// 원본 파일을 `in/<이름>`으로 만든다 (원본 이름 그대로)
    fn src(dir: &TempDir, name: &str, bytes: usize) -> PathBuf {
        let sub = dir.path().join("in");
        fs::create_dir_all(&sub).unwrap();
        let target = sub.join(name);
        fs::write(&target, vec![7u8; bytes]).unwrap();
        target
    }

    #[test]
    fn kind_follows_mime_then_extension() {
        assert_eq!(kind_of("a.PDF", None), AttachmentKind::Pdf);
        assert_eq!(kind_of("clip.MOV", None), AttachmentKind::Video);
        assert_eq!(kind_of("song.flac", None), AttachmentKind::Audio);
        assert_eq!(kind_of("data.zip", None), AttachmentKind::File);
        assert_eq!(kind_of("noext", None), AttachmentKind::File);
        assert_eq!(
            kind_of(".pdf", None),
            AttachmentKind::File,
            "숨김 파일은 확장자 없음"
        );
        // MIME이 있으면 확장자보다 먼저 본다
        assert_eq!(
            kind_of("weird.bin", Some("video/mp4")),
            AttachmentKind::Video
        );
        assert_eq!(
            kind_of("doc.pdf", Some("application/octet-stream")),
            AttachmentKind::File
        );
    }

    #[test]
    fn mime_from_extension() {
        assert_eq!(mime_of("a.pdf"), "application/pdf");
        assert_eq!(mime_of("a.MP4"), "video/mp4");
        assert_eq!(mime_of("a.unknownext"), "application/octet-stream");
        assert_eq!(mime_of("a"), "application/octet-stream");
    }

    #[test]
    fn safe_name_strips_paths_and_unsafe_chars() {
        assert_eq!(safe_name("../../etc/passwd"), "passwd");
        assert_eq!(safe_name("a\\b:c.txt"), "b_c.txt");
        assert_eq!(safe_name(".hidden"), "hidden");
        assert_eq!(safe_name("한글 보고서.pdf"), "______.pdf");
        assert_eq!(safe_name("???"), "file");
        assert_eq!(safe_name(""), "file");
    }

    #[test]
    fn safe_name_is_length_capped_and_keeps_extension() {
        let long = format!("{}.pdf", "a".repeat(300));
        let s = safe_name(&long);
        assert!(s.len() <= SAFE_NAME_MAX, "{}", s.len());
        assert!(s.ends_with(".pdf"));
        assert!(!s.starts_with('.'));
    }

    #[test]
    fn attachment_id_is_a_valid_page_style_id() {
        for _ in 0..50 {
            let id = new_attachment_id();
            assert!(is_valid_id(&id), "{id}");
        }
        assert_ne!(new_attachment_id(), new_attachment_id());
    }

    #[test]
    fn import_copies_into_page_assets_with_metadata() {
        let (dir, ws) = ws();
        let p = src(&dir, "Report 2026.pdf", 2048);
        let a = ws.import_attachment(ID, &p, None).unwrap();
        assert_eq!(a.kind, AttachmentKind::Pdf);
        assert_eq!(a.name, "Report 2026.pdf");
        assert_eq!(a.size, 2048);
        assert_eq!(a.mime, "application/pdf");
        assert!(a.path.starts_with(&format!("assets/{ID}/")));
        assert!(a.path.ends_with("-Report_2026.pdf"));
        // 저장 경로는 다시 읽을 수 있어야 한다
        let abs = ws.attachment_file(&a.path).unwrap();
        assert_eq!(fs::metadata(abs).unwrap().len(), 2048);
        // 임시 파일이 남지 않는다
        let left: Vec<_> = fs::read_dir(ws.root.join(ASSETS_DIR).join(ID))
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|n| n.starts_with('.'))
            .collect();
        assert!(left.is_empty(), "{left:?}");
    }

    #[test]
    fn too_large_is_rejected_and_leaves_no_file() {
        let (dir, ws) = ws();
        let p = src(&dir, "big.zip", 2000);
        let small = Limits {
            file: 1024,
            media: 4096,
        };
        let err = ws.import_attachment_with(ID, &p, None, small).unwrap_err();
        assert_eq!(err.code, "too_large");
        // 거절하면 페이지 폴더도 만들지 않는다
        assert!(!ws.root.join(ASSETS_DIR).join(ID).exists());
    }

    #[test]
    fn media_uses_its_own_larger_limit() {
        let (dir, ws) = ws();
        let p = src(&dir, "clip.mp4", 2000);
        let small = Limits {
            file: 1024,
            media: 4096,
        };
        let a = ws.import_attachment_with(ID, &p, None, small).unwrap();
        assert_eq!(a.kind, AttachmentKind::Video);
    }

    #[test]
    fn wrong_kind_is_rejected() {
        let (dir, ws) = ws();
        let p = src(&dir, "note.txt", 10);
        assert_eq!(
            ws.import_attachment(ID, &p, Some(AttachmentKind::Pdf))
                .unwrap_err()
                .code,
            "wrong_kind"
        );
        assert_eq!(
            ws.import_attachment(ID, &p, Some(AttachmentKind::Video))
                .unwrap_err()
                .code,
            "wrong_kind"
        );
    }

    #[test]
    fn directory_and_missing_sources_fail() {
        let (dir, ws) = ws();
        assert_eq!(
            ws.import_attachment(ID, dir.path(), None).unwrap_err().code,
            "invalid_asset"
        );
        let missing = dir.path().join("nope.pdf");
        assert_eq!(
            ws.import_attachment(ID, &missing, None).unwrap_err().code,
            "not_found"
        );
    }

    #[test]
    fn attachment_file_rejects_traversal_and_bad_ids() {
        let (_dir, ws) = ws();
        assert!(
            ws.attachment_file(&format!("assets/{ID}/../../workspace.json"))
                .is_err()
        );
        assert!(ws.attachment_file("assets/../x.pdf").is_err());
        assert!(ws.attachment_file(&format!("assets/{ID}/.hidden")).is_err());
        assert!(ws.attachment_file("pages/x.json").is_err());
        assert_eq!(
            ws.attachment_file(&format!("assets/{ID}/missing.pdf"))
                .unwrap_err()
                .code,
            "not_found"
        );
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_attachment_is_not_followed() {
        let (dir, ws) = ws();
        let outside = dir.path().join("secret.txt");
        fs::write(&outside, b"x").unwrap();
        let d = ws.root.join(ASSETS_DIR).join(ID);
        fs::create_dir_all(&d).unwrap();
        std::os::unix::fs::symlink(&outside, d.join("link.txt")).unwrap();
        assert_eq!(
            ws.attachment_file(&format!("assets/{ID}/link.txt"))
                .unwrap_err()
                .code,
            "symlink"
        );
    }

    #[test]
    fn max_bytes_by_asset_name() {
        assert_eq!(max_bytes_for_asset("img-1.png"), ASSET_MAX_BYTES as u64);
        assert_eq!(max_bytes_for_asset(&format!("{ID}-a.mp4")), MEDIA_MAX_BYTES);
    }
}
