//! macOS 앱 메뉴 (SHELL-11). 기본 메뉴와 같되 ⌘W를 "탭 닫기"로 쓰고, 창 닫기는 ⇧⌘W로 옮긴다.
//! 탭 항목은 프런트엔드에 `app-menu` 이벤트(항목 id)로 알린다. 메뉴 단축키는 웹뷰보다 먼저 받으므로
//! 여기서 받은 키는 프런트엔드 keydown으로 오지 않는다.

use tauri::{
    AppHandle, Emitter, Manager, Runtime,
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
};

pub const NEW_TAB: &str = "new-tab";
pub const CLOSE_TAB: &str = "close-tab";
pub const ZOOM_IN: &str = "zoom-in";
pub const ZOOM_OUT: &str = "zoom-out";
pub const ZOOM_RESET: &str = "zoom-reset";
pub const FIND: &str = "find";
pub const FIND_REPLACE: &str = "find-replace";
pub const OUTLINE: &str = "outline";
pub const IMPORT_MARKDOWN: &str = "import-markdown";
pub const EXPORT_WORKSPACE_MARKDOWN: &str = "export-workspace-markdown";
const CLOSE_WINDOW: &str = "close-window";

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
            &PredefinedMenuItem::about(app, Some(&format!("{name}에 관하여")), Some(about))?,
            &sep()?,
            &PredefinedMenuItem::services(app, Some("서비스"))?,
            &sep()?,
            &PredefinedMenuItem::hide(app, Some(&format!("{name} 가리기")))?,
            &PredefinedMenuItem::hide_others(app, Some("기타 가리기"))?,
            &sep()?,
            &PredefinedMenuItem::quit(app, Some(&format!("{name} 종료")))?,
        ],
    )?;
    let file = Submenu::with_items(
        app,
        "파일",
        true,
        &[
            &MenuItem::with_id(app, NEW_TAB, "새 탭", true, Some("CmdOrCtrl+T"))?,
            &MenuItem::with_id(app, CLOSE_TAB, "탭 닫기", true, Some("CmdOrCtrl+W"))?,
            &sep()?,
            // Markdown 가져오기 (DATA-08) — 프런트엔드가 파일 고르기부터 한다
            &MenuItem::with_id(
                app,
                IMPORT_MARKDOWN,
                "Markdown 가져오기…",
                true,
                None::<&str>,
            )?,
            // 워크스페이스 전체 Markdown 내보내기 (DATA-10) — 프런트엔드가 폴더 고르기부터 한다
            &MenuItem::with_id(
                app,
                EXPORT_WORKSPACE_MARKDOWN,
                "워크스페이스를 Markdown으로 내보내기…",
                true,
                None::<&str>,
            )?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        "편집",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("실행 취소"))?,
            &PredefinedMenuItem::redo(app, Some("실행 복귀"))?,
            &sep()?,
            &PredefinedMenuItem::cut(app, Some("오려두기"))?,
            &PredefinedMenuItem::copy(app, Some("복사하기"))?,
            &PredefinedMenuItem::paste(app, Some("붙여넣기"))?,
            &PredefinedMenuItem::select_all(app, Some("전체 선택"))?,
            &sep()?,
            // 페이지 안 찾기 (EDIT-25). 막대는 프런트엔드가 연다
            &MenuItem::with_id(app, FIND, "찾기", true, Some("CmdOrCtrl+F"))?,
            &MenuItem::with_id(
                app,
                FIND_REPLACE,
                "찾아 바꾸기",
                true,
                Some("CmdOrCtrl+Alt+F"),
            )?,
        ],
    )?;
    let view = Submenu::with_items(
        app,
        "보기",
        true,
        &[
            // 화면 크기 (SHELL-17). 단계·저장은 프런트엔드(lib/zoom.ts)가 한다. ⌘⇧=(⌘+)는 웹뷰 keydown으로 받는다
            &MenuItem::with_id(app, ZOOM_RESET, "실제 크기", true, Some("CmdOrCtrl+0"))?,
            &MenuItem::with_id(app, ZOOM_IN, "확대", true, Some("CmdOrCtrl+="))?,
            &MenuItem::with_id(app, ZOOM_OUT, "축소", true, Some("CmdOrCtrl+-"))?,
            &sep()?,
            // 목차 (PAGE-12) — 프런트엔드가 상단 바 목차 메뉴를 연다
            &MenuItem::with_id(app, OUTLINE, "목차", true, Some("CmdOrCtrl+Alt+O"))?,
            &sep()?,
            &PredefinedMenuItem::fullscreen(app, Some("전체 화면으로 전환"))?,
        ],
    )?;
    let window = Submenu::with_items(
        app,
        "윈도우",
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some("최소화"))?,
            &PredefinedMenuItem::maximize(app, Some("확대/축소"))?,
            &sep()?,
            &MenuItem::with_id(
                app,
                CLOSE_WINDOW,
                "창 닫기",
                true,
                Some("CmdOrCtrl+Shift+W"),
            )?,
        ],
    )?;
    Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window])
}

pub fn handle<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
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
        | IMPORT_MARKDOWN
        | EXPORT_WORKSPACE_MARKDOWN => {
            let _ = app.emit("app-menu", id);
        }
        _ => {}
    }
}
