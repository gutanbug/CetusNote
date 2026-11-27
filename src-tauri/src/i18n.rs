//! 앱 언어 (SYS-14). 네이티브 메뉴·대화상자와 프론트엔드로 가는 저장 오류 문구를 고른 언어로 준다.
//! 기본값은 OS 환경 변수(LC_ALL → LC_MESSAGES → LANG)에서 읽고, 화면 언어를 바꾸면 프론트엔드가 `set_locale`로 알려준다.
//! 문구는 `Text`에 한국어·영어를 함께 적는다. 두 언어 모두 `match`로 강제되므로 빠진 문구는 컴파일되지 않는다.
//! MCP 서버(`--mcp`)는 이 모듈을 부르지 않으므로 기본값(한국어) 문구를 그대로 낸다.

use std::borrow::Cow;
use std::sync::atomic::{AtomicU8, Ordering};

use serde::Serialize;
use tauri::AppHandle;

use crate::storage::{Result, StorageError};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Locale {
    Ko,
    En,
}

impl Locale {
    /// "ko", "ko-KR", "en_US.UTF-8"처럼 시작하는 언어 코드를 고른다. 지원하지 않으면 None
    pub fn parse(tag: &str) -> Option<Locale> {
        let lower = tag.trim().to_ascii_lowercase();
        match lower.split(['-', '_', '.']).next().unwrap_or("") {
            "ko" => Some(Locale::Ko),
            "en" => Some(Locale::En),
            _ => None,
        }
    }
}

/// 현재 언어. 0 = 한국어, 1 = 영어
static CURRENT: AtomicU8 = AtomicU8::new(0);

fn encode(l: Locale) -> u8 {
    match l {
        Locale::Ko => 0,
        Locale::En => 1,
    }
}

/// OS 언어: 한국어로 시작하면 한국어, 그 밖은 영어
fn os_locale() -> Locale {
    ["LC_ALL", "LC_MESSAGES", "LANG"]
        .iter()
        .filter_map(|key| std::env::var(key).ok())
        .find(|value| !value.is_empty())
        .and_then(|value| Locale::parse(&value))
        .unwrap_or(Locale::En)
}

/// 앱 시작 시 한 번 — OS 언어를 기본값으로 둔다 (프론트엔드가 곧 `set_locale`로 맞춘다)
pub fn init_from_os() {
    set(os_locale());
}

pub fn current() -> Locale {
    match CURRENT.load(Ordering::Relaxed) {
        1 => Locale::En,
        _ => Locale::Ko,
    }
}

fn set(l: Locale) {
    CURRENT.store(encode(l), Ordering::Relaxed);
}

/// 네이티브 문구. 메뉴 항목·대화상자 제목·필터 이름에 쓴다. `{name}`은 호출하는 쪽이 바꾼다
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Text {
    About,
    Services,
    HideApp,
    HideOthers,
    QuitApp,
    FileMenu,
    NewTab,
    CloseTab,
    ImportDocument,
    ImportApp,
    ExportWorkspaceMarkdown,
    EditMenu,
    Undo,
    Redo,
    Cut,
    Copy,
    Paste,
    SelectAll,
    Find,
    FindReplace,
    ViewMenu,
    ActualSize,
    ZoomIn,
    ZoomOut,
    Outline,
    EnterFullscreen,
    WindowMenu,
    Minimize,
    Maximize,
    CloseWindow,
    PickNotesFolder,
    PickWorkspaceLocation,
    ExportMarkdown,
    ExportCsv,
    ExportAllMarkdown,
    PickDocument,
    DocumentFilter,
    ImportOtherApps,
    ImportEnex,
    PickImage,
    ImageFilter,
    AttachFile,
    VideoAudioFilter,
    SaveAs,
    BackupExport,
    BackupFilter,
    BackupPick,
    BackupRestoreFolder,
    SavePdf,
    PdfNoScreen,
    PdfNotMainThread,
    PdfEmpty,
    PdfPageFailed,
    PdfPartRead,
    PdfPartOpen,
    PdfNoPages,
    PdfMergeFailed,
    PdfPreviewRead,
    PdfPreviewOpen,
    PdfPreviewNoPage,
    PdfPageSize,
    PdfPageImage,
    PdfPageImageRead,
    PdfPageImagePng,
    #[cfg_attr(target_os = "macos", allow(dead_code))] // Windows·Linux 인쇄 경로에서만 쓴다
    PdfExportMacOnly,
    #[cfg_attr(target_os = "macos", allow(dead_code))] // Windows·Linux 인쇄 경로에서만 쓴다
    PdfEngine,
    #[cfg_attr(target_os = "macos", allow(dead_code))] // Windows·Linux 인쇄 경로에서만 쓴다
    PdfPrintSetup,
    #[cfg_attr(target_os = "macos", allow(dead_code))] // Windows·Linux 인쇄 경로에서만 쓴다
    PdfMake,
    #[cfg_attr(target_os = "macos", allow(dead_code))] // Windows·Linux 인쇄 경로에서만 쓴다
    PdfSaveLocation,
    PdfOsUnsupported,
    PdfOpen,
    #[cfg_attr(target_os = "macos", allow(dead_code))] // Windows·Linux 인쇄 경로에서만 쓴다
    PdfImportMacOnly,
    TrayQuickInput,
    TrayOpenApp,
    TrayQuit,
}

impl Text {
    /// 문구 목록 전체 (테스트가 빠짐과 빈 문구를 잡는다)
    #[cfg(test)]
    pub const ALL: &'static [Text] = &[
        Text::About,
        Text::Services,
        Text::HideApp,
        Text::HideOthers,
        Text::QuitApp,
        Text::FileMenu,
        Text::NewTab,
        Text::CloseTab,
        Text::ImportDocument,
        Text::ImportApp,
        Text::ExportWorkspaceMarkdown,
        Text::EditMenu,
        Text::Undo,
        Text::Redo,
        Text::Cut,
        Text::Copy,
        Text::Paste,
        Text::SelectAll,
        Text::Find,
        Text::FindReplace,
        Text::ViewMenu,
        Text::ActualSize,
        Text::ZoomIn,
        Text::ZoomOut,
        Text::Outline,
        Text::EnterFullscreen,
        Text::WindowMenu,
        Text::Minimize,
        Text::Maximize,
        Text::CloseWindow,
        Text::PickNotesFolder,
        Text::PickWorkspaceLocation,
        Text::ExportMarkdown,
        Text::ExportCsv,
        Text::ExportAllMarkdown,
        Text::PickDocument,
        Text::DocumentFilter,
        Text::ImportOtherApps,
        Text::ImportEnex,
        Text::PickImage,
        Text::ImageFilter,
        Text::AttachFile,
        Text::VideoAudioFilter,
        Text::SaveAs,
        Text::BackupExport,
        Text::BackupFilter,
        Text::BackupPick,
        Text::BackupRestoreFolder,
        Text::SavePdf,
        Text::PdfNoScreen,
        Text::PdfNotMainThread,
        Text::PdfEmpty,
        Text::PdfPageFailed,
        Text::PdfPartRead,
        Text::PdfPartOpen,
        Text::PdfNoPages,
        Text::PdfMergeFailed,
        Text::PdfPreviewRead,
        Text::PdfPreviewOpen,
        Text::PdfPreviewNoPage,
        Text::PdfPageSize,
        Text::PdfPageImage,
        Text::PdfPageImageRead,
        Text::PdfPageImagePng,
        Text::PdfExportMacOnly,
        Text::PdfEngine,
        Text::PdfPrintSetup,
        Text::PdfMake,
        Text::PdfSaveLocation,
        Text::PdfOsUnsupported,
        Text::PdfOpen,
        Text::PdfImportMacOnly,
        Text::TrayQuickInput,
        Text::TrayOpenApp,
        Text::TrayQuit,
    ];

    /// (한국어, 영어)
    fn pair(self) -> (&'static str, &'static str) {
        match self {
            Text::About => ("{name}에 관하여", "About {name}"),
            Text::Services => ("서비스", "Services"),
            Text::HideApp => ("{name} 가리기", "Hide {name}"),
            Text::HideOthers => ("기타 가리기", "Hide Others"),
            Text::QuitApp => ("{name} 종료", "Quit {name}"),
            Text::FileMenu => ("파일", "File"),
            Text::NewTab => ("새 탭", "New Tab"),
            Text::CloseTab => ("탭 닫기", "Close Tab"),
            Text::ImportDocument => ("문서 가져오기…", "Import Document…"),
            Text::ImportApp => ("다른 앱에서 가져오기…", "Import from Other Apps…"),
            Text::ExportWorkspaceMarkdown => (
                "워크스페이스를 Markdown으로 내보내기…",
                "Export Workspace as Markdown…",
            ),
            Text::EditMenu => ("편집", "Edit"),
            Text::Undo => ("실행 취소", "Undo"),
            Text::Redo => ("실행 복귀", "Redo"),
            Text::Cut => ("오려두기", "Cut"),
            Text::Copy => ("복사하기", "Copy"),
            Text::Paste => ("붙여넣기", "Paste"),
            Text::SelectAll => ("전체 선택", "Select All"),
            Text::Find => ("찾기", "Find"),
            Text::FindReplace => ("찾아 바꾸기", "Find and Replace"),
            Text::ViewMenu => ("보기", "View"),
            Text::ActualSize => ("실제 크기", "Actual Size"),
            Text::ZoomIn => ("확대", "Zoom In"),
            Text::ZoomOut => ("축소", "Zoom Out"),
            Text::Outline => ("목차", "Outline"),
            Text::EnterFullscreen => ("전체 화면으로 전환", "Enter Full Screen"),
            Text::WindowMenu => ("윈도우", "Window"),
            Text::Minimize => ("최소화", "Minimize"),
            Text::Maximize => ("확대/축소", "Zoom"),
            Text::CloseWindow => ("창 닫기", "Close Window"),
            Text::PickNotesFolder => ("노트를 저장할 폴더 선택", "Choose a Folder for Your Notes"),
            Text::PickWorkspaceLocation => (
                "“{name}” 워크스페이스를 만들 위치 선택",
                "Choose Where to Create “{name}”",
            ),
            Text::ExportMarkdown => ("Markdown으로 내보내기", "Export as Markdown"),
            Text::ExportCsv => ("CSV로 내보내기", "Export as CSV"),
            Text::ExportAllMarkdown => ("Markdown으로 모두 내보내기", "Export All as Markdown"),
            Text::PickDocument => ("문서 가져오기", "Import Document"),
            Text::DocumentFilter => ("문서", "Documents"),
            Text::ImportOtherApps => ("다른 앱에서 가져오기", "Import from Other Apps"),
            Text::ImportEnex => ("Evernote 파일 가져오기", "Import Evernote File"),
            Text::PickImage => ("이미지 선택", "Choose Image"),
            Text::ImageFilter => ("이미지", "Images"),
            Text::AttachFile => ("파일 첨부", "Attach File"),
            Text::VideoAudioFilter => ("영상·소리", "Video and Audio"),
            Text::SaveAs => ("다른 이름으로 저장", "Save As"),
            Text::BackupExport => ("백업 내보내기", "Export Backup"),
            Text::BackupFilter => ("Cetus Note 백업", "Cetus Note Backup"),
            Text::BackupPick => ("불러올 백업 선택", "Choose Backup to Restore"),
            Text::BackupRestoreFolder => ("백업을 풀 폴더 선택", "Choose Folder for Backup"),
            Text::SavePdf => ("PDF로 저장", "Save as PDF"),
            Text::PdfNoScreen => (
                "미리보기를 만들 화면이 없어요",
                "There is no view to make the preview from.",
            ),
            Text::PdfNotMainThread => (
                "메인 스레드가 아니에요",
                "This must run on the main thread.",
            ),
            Text::PdfEmpty => ("빈 PDF가 만들어졌어요", "The PDF came out empty."),
            Text::PdfPageFailed => ("PDF 쪽을 만들지 못했어요", "Could not make a PDF page."),
            Text::PdfPartRead => ("쪽 PDF를 읽지 못했어요", "Could not read a PDF page."),
            Text::PdfPartOpen => ("쪽 PDF를 열지 못했어요", "Could not open a PDF page."),
            Text::PdfNoPages => ("쪽 PDF에 쪽이 없어요", "The page PDF has no pages."),
            Text::PdfMergeFailed => ("PDF를 합치지 못했어요", "Could not merge the PDF."),
            Text::PdfPreviewOpen => (
                "미리보기 PDF를 열지 못했어요",
                "Could not open the preview PDF.",
            ),
            Text::PdfPreviewNoPage => ("미리보기 쪽이 없어요", "The preview page is missing."),
            Text::PdfPageImage => ("쪽 그림을 만들지 못했어요", "Could not make a page image."),
            Text::PdfPageImageRead => ("쪽 그림을 읽지 못했어요", "Could not read a page image."),
            Text::PdfPageImagePng => (
                "쪽 그림을 PNG로 바꾸지 못했어요",
                "Could not convert a page image to PNG.",
            ),
            Text::PdfExportMacOnly => (
                "PDF 내보내기는 macOS 앱에서만 지원해요",
                "PDF export is only supported in the macOS app.",
            ),
            Text::PdfEngine => (
                "인쇄 엔진을 찾지 못했어요",
                "Could not find the print engine.",
            ),
            Text::PdfPrintSetup => ("인쇄 설정을 만들지 못했어요", "Could not set up printing."),
            Text::PdfMake => ("PDF를 만들지 못했어요", "Could not make the PDF."),
            Text::PdfSaveLocation => (
                "PDF 저장 위치를 만들지 못했어요",
                "Could not create the PDF save location.",
            ),
            Text::PdfOsUnsupported => (
                "이 운영체제는 문서 인쇄를 쓰지 않아요",
                "Document printing is not used on this OS.",
            ),
            Text::PdfOpen => ("PDF를 열지 못했어요", "Could not open the PDF."),
            Text::PdfImportMacOnly => (
                "PDF 가져오기는 macOS 앱에서만 돼요",
                "PDF import is only available in the macOS app.",
            ),
            Text::PdfPageSize => ("쪽 크기를 알 수 없어요", "Could not read the page size."),
            Text::PdfPreviewRead => (
                "미리보기 PDF를 읽지 못했어요",
                "Could not read the preview PDF.",
            ),
            Text::TrayQuickInput => ("빠른 입력", "Quick Input"),
            Text::TrayOpenApp => ("CetusNote 열기", "Open CetusNote"),
            Text::TrayQuit => ("종료", "Quit"),
        }
    }
}

/// 지금 언어의 네이티브 문구
pub fn text(t: Text) -> &'static str {
    text_in(current(), t)
}

pub fn text_in(l: Locale, t: Text) -> &'static str {
    let (ko, en) = t.pair();
    match l {
        Locale::Ko => ko,
        Locale::En => en,
    }
}

/// 프론트엔드로 나가는 저장 오류 문구. 한국어는 원문을 그대로 두고, 영어는 코드별 영어 문구를 쓴다
pub fn error_message<'a>(code: &str, message: &'a str) -> Cow<'a, str> {
    error_message_in(current(), code, message)
}

pub fn error_message_in<'a>(l: Locale, code: &str, message: &'a str) -> Cow<'a, str> {
    match l {
        Locale::Ko => Cow::Borrowed(message),
        Locale::En => Cow::Borrowed(en_error(code)),
    }
}

fn en_error(code: &str) -> &'static str {
    match code {
        "no_workspace" => "No workspace is open.",
        "not_found" => "The file or page could not be found.",
        "io" => "Could not read or write the file.",
        "permission_denied" => "Permission denied.",
        "disk_full" => "The disk is full.",
        "invalid_json" => "The file is damaged and could not be read.",
        "invalid_page" => "This page could not be read.",
        "invalid_id" => "This ID is not valid.",
        "invalid_path" => "This path is not allowed.",
        "invalid_asset" => "This file cannot be used.",
        "invalid_backup" => "This is not a Cetus Note backup.",
        "invalid_archive" => "This archive could not be opened.",
        "fetch_failed" => "The image could not be downloaded.",
        "not_empty" => "Choose an empty folder.",
        "symlink" => "Links are not allowed here.",
        "too_large" => "This file is too large.",
        "wrong_kind" => "This kind of file cannot be added here.",
        "invalid_shortcut" => "This shortcut cannot be read.",
        "shortcut_reserved" => "Command+Space and Option+Space are reserved by macOS.",
        "shortcut_unavailable" => "Another app or the system is already using this shortcut.",
        "accessibility_required" => "Double-tap needs Accessibility permission.",
        "autostart_failed" => "Could not change the launch-at-login setting.",
        _ => "Something went wrong.",
    }
}

/// 앱 언어를 바꾼다 (SYS-14). 네이티브 메뉴를 새 언어로 다시 만든다
#[tauri::command]
pub fn set_locale(app: AppHandle, locale: String) -> Result<()> {
    let next = Locale::parse(&locale)
        .ok_or_else(|| StorageError::new("invalid_locale", "unsupported locale"))?;
    set(next);
    #[cfg(target_os = "macos")]
    {
        let menu = crate::menu::build(&app).map_err(|e| StorageError::new("io", e.to_string()))?;
        app.set_menu(menu)
            .map_err(|e| StorageError::new("io", e.to_string()))?;
    }
    // 메뉴 막대 메뉴도 같은 언어로 다시 만든다 (SYS-15)
    crate::tray::refresh(&app);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_text_has_korean_and_english() {
        for &t in Text::ALL {
            let (ko, en) = t.pair();
            assert!(!ko.is_empty(), "{t:?} ko");
            assert!(!en.is_empty(), "{t:?} en");
        }
    }

    #[test]
    fn english_texts_have_no_hangul() {
        for &t in Text::ALL {
            let en = text_in(Locale::En, t);
            assert!(!en.chars().any(is_hangul), "{t:?} still Korean: {en}");
        }
    }

    #[test]
    fn english_menu_labels() {
        assert_eq!(text_in(Locale::En, Text::FileMenu), "File");
        assert_eq!(text_in(Locale::En, Text::NewTab), "New Tab");
        assert_eq!(text_in(Locale::En, Text::CloseTab), "Close Tab");
        assert_eq!(text_in(Locale::En, Text::EditMenu), "Edit");
        assert_eq!(text_in(Locale::En, Text::ViewMenu), "View");
        assert_eq!(text_in(Locale::En, Text::WindowMenu), "Window");
        assert_eq!(text_in(Locale::En, Text::CloseWindow), "Close Window");
        assert_eq!(text_in(Locale::En, Text::About), "About {name}");
        assert_eq!(text_in(Locale::Ko, Text::NewTab), "새 탭");
    }

    #[test]
    fn locale_from_os_tags() {
        assert_eq!(Locale::parse("ko_KR.UTF-8"), Some(Locale::Ko));
        assert_eq!(Locale::parse("ko-KR"), Some(Locale::Ko));
        assert_eq!(Locale::parse("en_US.UTF-8"), Some(Locale::En));
        assert_eq!(Locale::parse("fr"), None);
        assert_eq!(Locale::parse("C"), None);
    }

    #[test]
    fn error_text_follows_locale() {
        let raw = "파일이 없어요";
        assert_eq!(error_message_in(Locale::Ko, "not_found", raw), raw);
        assert_eq!(
            error_message_in(Locale::En, "not_found", raw),
            "The file or page could not be found."
        );
        // 목록에 없는 코드도 영어에서는 한국어 원문을 내지 않는다
        assert_eq!(
            error_message_in(Locale::En, "unknown_code", raw),
            "Something went wrong."
        );
    }

    fn is_hangul(c: char) -> bool {
        ('\u{AC00}'..='\u{D7A3}').contains(&c) || ('\u{3131}'..='\u{318E}').contains(&c)
    }
}
