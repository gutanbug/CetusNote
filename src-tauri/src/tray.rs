//! 메뉴 막대 상주 (SYS-15). 메뉴 막대(macOS) · 알림 영역(Windows·Linux) 아이콘과 그 메뉴.
//! 메뉴: 빠른 입력 · CetusNote 열기 · 구분선 · 종료. 문구는 i18n `Text`를 따르고, 언어가 바뀌면 `refresh`로 다시 만든다.
//! 「메뉴 막대에 남기」를 끄면 아이콘을 숨긴다. 창 닫기 동작은 프런트엔드(lifecycle.ts)가 정한다.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    AppHandle, Manager, Runtime,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
};

use crate::i18n::{self, Text};

pub const TRAY_ID: &str = "cetusnote-tray";
const MAIN_LABEL: &str = "main";
const ITEM_QUICK: &str = "tray-quick";
const ITEM_OPEN: &str = "tray-open";
const ITEM_QUIT: &str = "tray-quit";

/// 「메뉴 막대에 남기」 설정 값. 기본은 켬. 창 닫기 때 숨길지 정할 때 읽는다
static RESIDENT: AtomicBool = AtomicBool::new(true);

pub fn resident() -> bool {
    RESIDENT.load(Ordering::Relaxed)
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    Menu::with_items(
        app,
        &[
            &MenuItem::with_id(
                app,
                ITEM_QUICK,
                i18n::text(Text::TrayQuickInput),
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                ITEM_OPEN,
                i18n::text(Text::TrayOpenApp),
                true,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                ITEM_QUIT,
                i18n::text(Text::TrayQuit),
                true,
                None::<&str>,
            )?,
        ],
    )
}

/// 메뉴 막대 아이콘을 만든다 (앱 시작 시 한 번)
pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build_menu(app)?;
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
pub fn refresh<R: Runtime>(app: &AppHandle<R>) {
    if let (Some(tray), Ok(menu)) = (app.tray_by_id(TRAY_ID), build_menu(app)) {
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

/// 트레이 핸들 (테스트·확장용)
#[allow(dead_code)]
pub fn icon<R: Runtime>(app: &AppHandle<R>) -> Option<TrayIcon<R>> {
    app.tray_by_id(TRAY_ID)
}
