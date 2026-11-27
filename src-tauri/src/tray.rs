//! 메뉴 막대 상주 (SYS-15). 메뉴 막대(macOS) · 알림 영역(Windows·Linux) 아이콘과 그 메뉴.
//! 메뉴: [타이머 상태 줄 (있을 때)] · 빠른 입력 · CetusNote 열기 · 구분선 · 종료. 문구는 i18n `Text`를 따르고, 언어가 바뀌면 `refresh`로 다시 만든다.
//! 「메뉴 막대에 남기」를 끄면 아이콘을 숨긴다. 창 닫기 동작은 프런트엔드(lifecycle.ts)가 정한다.
//! 타이머 상태(`tray_set_status`): 메뉴 막대 글자(macOS 제목)와 메뉴 맨 위 흐린 줄에 남은 시간을 보인다.

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    AppHandle, Manager, Runtime, Wry,
    menu::{Menu, MenuItem, MenuItemKind, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
};

use crate::i18n::{self, Text};

pub const TRAY_ID: &str = "cetusnote-tray";
const MAIN_LABEL: &str = "main";
const ITEM_STATUS: &str = "tray-status";
const ITEM_QUICK: &str = "tray-quick";
const ITEM_OPEN: &str = "tray-open";
const ITEM_QUIT: &str = "tray-quit";

/// 「메뉴 막대에 남기」 설정 값. 기본은 켬. 창 닫기 때 숨길지 정할 때 읽는다
static RESIDENT: AtomicBool = AtomicBool::new(true);

/// 타이머 상태 글자 (없으면 None). 메뉴를 다시 만들 때 읽는다
static STATUS: Mutex<Option<String>> = Mutex::new(None);

pub fn resident() -> bool {
    RESIDENT.load(Ordering::Relaxed)
}

fn status_text() -> Option<String> {
    STATUS.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

/// 지금 트레이에 단 메뉴 (타이머 줄 글자를 바꿀 때 항목을 찾는다). 앱은 Wry 런타임만 쓴다
static MENU: Mutex<Option<Menu<Wry>>> = Mutex::new(None);

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;
    if let Some(text) = status_text() {
        menu.append(&MenuItem::with_id(
            app,
            ITEM_STATUS,
            text,
            false,
            None::<&str>,
        )?)?;
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }
    menu.append(&MenuItem::with_id(
        app,
        ITEM_QUICK,
        i18n::text(Text::TrayQuickInput),
        true,
        None::<&str>,
    )?)?;
    menu.append(&MenuItem::with_id(
        app,
        ITEM_OPEN,
        i18n::text(Text::TrayOpenApp),
        true,
        None::<&str>,
    )?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(
        app,
        ITEM_QUIT,
        i18n::text(Text::TrayQuit),
        true,
        None::<&str>,
    )?)?;
    Ok(menu)
}

/// 메뉴 막대 아이콘을 만든다 (앱 시작 시 한 번)
pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app)?;
    *MENU.lock().unwrap_or_else(|e| e.into_inner()) = Some(menu.clone());
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Cetus Note")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_menu(app, event.id().as_ref()))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// 언어가 바뀌면 메뉴 문구를 다시 만든다 (SYS-14)
pub fn refresh(app: &AppHandle) {
    if let (Some(tray), Ok(menu)) = (app.tray_by_id(TRAY_ID), build_menu(app)) {
        *MENU.lock().unwrap_or_else(|e| e.into_inner()) = Some(menu.clone());
        let _ = tray.set_menu(Some(menu));
    }
}

/// 「메뉴 막대에 남기」를 바꾼다. 끄면 아이콘을 숨기고, 켜면 다시 보인다
pub fn set_resident<R: Runtime>(app: &AppHandle<R>, on: bool) {
    RESIDENT.store(on, Ordering::Relaxed);
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_visible(on);
    }
}

/// 타이머 상태를 메뉴 막대 글자와 메뉴 맨 위 줄에 보인다. None이면 둘 다 지운다.
/// 줄이 생기거나 없어질 때만 메뉴를 다시 만들고, 그 밖에는 줄 글자만 바꾼다 (매초 호출돼도 가볍다)
#[tauri::command]
pub fn tray_set_status(app: AppHandle, text: Option<String>) {
    let text = text.map(|t| t.trim().to_string()).filter(|t| !t.is_empty());
    let line_changed = status_text().is_some() != text.is_some();
    *STATUS.lock().unwrap_or_else(|e| e.into_inner()) = text.clone();
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    let _ = tray.set_title(text.as_deref());
    if line_changed {
        refresh(&app);
    } else if let Some(text) = text {
        let menu = MENU.lock().unwrap_or_else(|e| e.into_inner()).clone();
        if let Some(MenuItemKind::MenuItem(item)) = menu.and_then(|m| m.get(ITEM_STATUS)) {
            let _ = item.set_text(text);
        }
    }
}

fn handle_menu<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        ITEM_QUICK => crate::quick::show(app),
        ITEM_OPEN => show_main(app),
        ITEM_QUIT => crate::request_quit(app),
        _ => {}
    }
}

/// 메인 창을 앞으로 가져온다. 숨겨졌거나 최소화돼 있으면 연다 (Dock 클릭·재실행·메뉴)
pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// 메인 창을 연다 (QN-03·SYS-16). 빠른 입력 창이 페이지를 열 때, 알림 「열기」를 누를 때 부른다.
/// 메뉴 막대에 숨어 있어도 창을 보이게 하고 앞으로 가져온다
#[tauri::command]
pub fn main_window_show(app: AppHandle) {
    show_main(&app);
}

/// 트레이 핸들 (테스트·확장용)
#[allow(dead_code)]
pub fn icon<R: Runtime>(app: &AppHandle<R>) -> Option<TrayIcon<R>> {
    app.tray_by_id(TRAY_ID)
}
