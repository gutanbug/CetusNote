//! macOS 앱 메뉴 (SHELL-11). 기본 메뉴와 같되 ⌘W를 "탭 닫기"로 쓰고, 창 닫기는 ⇧⌘W로 옮긴다.
//! 탭 항목은 프런트엔드에 `app-menu` 이벤트(항목 id)로 알린다. 메뉴 단축키는 웹뷰보다 먼저 받으므로
//! 여기서 받은 키는 프런트엔드 keydown으로 오지 않는다.

use tauri::{
    AppHandle, Emitter, Manager, Runtime,
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
};

use crate::i18n::{self, Text};

pub const NEW_TAB: &str = "new-tab";
pub const CLOSE_TAB: &str = "close-tab";
pub const ZOOM_IN: &str = "zoom-in";
pub const ZOOM_OUT: &str = "zoom-out";
pub const ZOOM_RESET: &str = "zoom-reset";
pub const FIND: &str = "find";
pub const FIND_REPLACE: &str = "find-replace";
pub const OUTLINE: &str = "outline";
pub const IMPORT_DOCUMENT: &str = "import-document";
pub const IMPORT_APP: &str = "import-app";
pub const EXPORT_WORKSPACE_MARKDOWN: &str = "export-workspace-markdown";
const CLOSE_WINDOW: &str = "close-window";
const QUIT: &str = "quit-app";

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let name = app.package_info().name.clone();
    let about = AboutMetadata {
        name: Some(name.clone()),
        version: Some(app.package_info().version.to_string()),
        ..Default::default()
    };
    let sep = || PredefinedMenuItem::separator(app);

    let app_menu = Submenu::with_items(
        app,
        &name,
        true,
        &[
            &PredefinedMenuItem::about(
                app,
                Some(&i18n::text(Text::About).replace("{name}", &name)),
                Some(about),
            )?,
            &sep()?,
            &PredefinedMenuItem::services(app, Some(i18n::text(Text::Services)))?,
            &sep()?,
            &PredefinedMenuItem::hide(
                app,
                Some(&i18n::text(Text::HideApp).replace("{name}", &name)),
            )?,
            &PredefinedMenuItem::hide_others(app, Some(i18n::text(Text::HideOthers)))?,
            &sep()?,
            // 종료는 직접 처리한다 (DATA-07): 저장을 끝낸 뒤 종료하려고 기본 quit 항목 대신 쓴다
            &MenuItem::with_id(
                app,
                QUIT,
                i18n::text(Text::QuitApp).replace("{name}", &name),
                true,
                Some("CmdOrCtrl+Q"),
            )?,
        ],
    )?;
    let file = Submenu::with_items(
        app,
        i18n::text(Text::FileMenu),
        true,
        &[
            &MenuItem::with_id(
                app,
                NEW_TAB,
                i18n::text(Text::NewTab),
                true,
                Some("CmdOrCtrl+T"),
            )?,
            &MenuItem::with_id(
                app,
                CLOSE_TAB,
                i18n::text(Text::CloseTab),
                true,
                Some("CmdOrCtrl+W"),
            )?,
            &sep()?,
            // 문서 가져오기 (DATA-08) — 프런트엔드가 파일 고르기부터 한다
            &MenuItem::with_id(
                app,
                IMPORT_DOCUMENT,
                i18n::text(Text::ImportDocument),
                true,
                None::<&str>,
            )?,
            // 다른 앱에서 가져오기 (DATA-11) — 프런트엔드가 앱과 zip·폴더 고르기부터 한다
            &MenuItem::with_id(
                app,
                IMPORT_APP,
                i18n::text(Text::ImportApp),
                true,
                None::<&str>,
            )?,
            // 워크스페이스 전체 Markdown 내보내기 (DATA-10) — 프런트엔드가 폴더 고르기부터 한다
            &MenuItem::with_id(
                app,
                EXPORT_WORKSPACE_MARKDOWN,
                i18n::text(Text::ExportWorkspaceMarkdown),
                true,
                None::<&str>,
            )?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        i18n::text(Text::EditMenu),
        true,
        &[
            &PredefinedMenuItem::undo(app, Some(i18n::text(Text::Undo)))?,
            &PredefinedMenuItem::redo(app, Some(i18n::text(Text::Redo)))?,
            &sep()?,
            &PredefinedMenuItem::cut(app, Some(i18n::text(Text::Cut)))?,
            &PredefinedMenuItem::copy(app, Some(i18n::text(Text::Copy)))?,
            &PredefinedMenuItem::paste(app, Some(i18n::text(Text::Paste)))?,
            &PredefinedMenuItem::select_all(app, Some(i18n::text(Text::SelectAll)))?,
            &sep()?,
            // 페이지 안 찾기 (EDIT-25). 막대는 프런트엔드가 연다
            &MenuItem::with_id(app, FIND, i18n::text(Text::Find), true, Some("CmdOrCtrl+F"))?,
            &MenuItem::with_id(
                app,
                FIND_REPLACE,
                i18n::text(Text::FindReplace),
                true,
                Some("CmdOrCtrl+Alt+F"),
            )?,
        ],
    )?;
    let view = Submenu::with_items(
        app,
        i18n::text(Text::ViewMenu),
        true,
        &[
            // 화면 크기 (SHELL-17). 단계·저장은 프런트엔드(lib/zoom.ts)가 한다. ⌘⇧=(⌘+)는 웹뷰 keydown으로 받는다
            &MenuItem::with_id(
                app,
                ZOOM_RESET,
                i18n::text(Text::ActualSize),
                true,
                Some("CmdOrCtrl+0"),
            )?,
            &MenuItem::with_id(
                app,
                ZOOM_IN,
                i18n::text(Text::ZoomIn),
                true,
                Some("CmdOrCtrl+="),
            )?,
            &MenuItem::with_id(
                app,
                ZOOM_OUT,
                i18n::text(Text::ZoomOut),
                true,
                Some("CmdOrCtrl+-"),
            )?,
            &sep()?,
            // 목차 (PAGE-12) — 프런트엔드가 상단 바 목차 메뉴를 연다
            &MenuItem::with_id(
                app,
                OUTLINE,
                i18n::text(Text::Outline),
                true,
                Some("CmdOrCtrl+Alt+O"),
            )?,
            &sep()?,
            &PredefinedMenuItem::fullscreen(app, Some(i18n::text(Text::EnterFullscreen)))?,
        ],
    )?;
    let window = Submenu::with_items(
        app,
        i18n::text(Text::WindowMenu),
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some(i18n::text(Text::Minimize)))?,
            &PredefinedMenuItem::maximize(app, Some(i18n::text(Text::Maximize)))?,
            &sep()?,
            &MenuItem::with_id(
                app,
                CLOSE_WINDOW,
                i18n::text(Text::CloseWindow),
                true,
                Some("CmdOrCtrl+Shift+W"),
            )?,
        ],
    )?;
    Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window])
}

pub fn handle<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        // 저장을 마친 뒤 종료한다 (DATA-07, quit.rs)
        QUIT => crate::request_quit(app),
        // 닫기 요청을 거친다 — 프런트엔드가 저장을 마친 뒤 닫는다 (lifecycle.ts)
        CLOSE_WINDOW => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.close();
            }
        }
        NEW_TAB
        | CLOSE_TAB
        | ZOOM_IN
        | ZOOM_OUT
        | ZOOM_RESET
        | FIND
        | FIND_REPLACE
        | OUTLINE
        | IMPORT_DOCUMENT
        | IMPORT_APP
        | EXPORT_WORKSPACE_MARKDOWN => {
            let _ = app.emit("app-menu", id);
        }
        _ => {}
    }
}
