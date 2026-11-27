mod app_icon;
mod app_import;
mod commands;
mod double_tap;
mod i18n;
mod mcp;
#[cfg(target_os = "macos")]
mod menu;
mod pdf;
mod prefs;
mod quick;
mod quit;
mod shortcut;
mod storage;
mod tray;

use std::time::Instant;
use tauri::{Emitter, Manager};

/// 창 이벤트. 빠른 입력 창은 포커스를 잃으면 숨기고, 상주를 끈 상태에서 메인 창이 사라지면 앱을 끝낸다
fn on_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    match event {
        tauri::WindowEvent::Focused(false) if window.label() == quick::LABEL => {
            let _ = window.hide();
        }
        tauri::WindowEvent::Destroyed if window.label() == "main" && !tray::resident() => {
            window.app_handle().exit(0);
        }
        _ => {}
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    // `--mcp`: 창을 띄우지 않고 stdio MCP 서버로 실행한다 (DATA-12). 아래 Tauri 설정은 건드리지 않는다
    if let Some(code) = mcp::run_from_args(&context.config().identifier) {
        std::process::exit(code);
    }
    #[allow(unused_mut)]
    i18n::init_from_os();
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // 메뉴 막대 아이콘 (SYS-15)
            tray::setup(app.handle())?;
            // 기본 빠른 입력 단축키 (QN-03). 설정 값이 프런트엔드에서 적용되기 전까지 쓴다. 실패해도 앱은 뜬다
            #[cfg(desktop)]
            let _ = shortcut::set(app.handle(), shortcut::DEFAULT_SHORTCUT);
            Ok(())
        })
        .on_window_event(on_window_event)
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            confirm_quit,
            commands::workspace_current,
            commands::workspace_pick,
            commands::workspace_use_default,
            commands::workspace_recent,
            commands::workspace_switch,
            commands::workspace_forget,
            commands::workspace_create,
            commands::workspace_read,
            commands::workspace_write,
            commands::pages_load_all,
            commands::pages_load_meta,
            commands::page_write,
            commands::page_purge,
            commands::history_save,
            commands::history_list,
            commands::history_read,
            commands::history_delete,
            commands::settings_read,
            commands::settings_write,
            commands::app_icon_set,
            commands::export_markdown,
            commands::export_csv,
            commands::document_pick,
            commands::document_bytes,
            commands::document_pdf_text,
            commands::document_image,
            commands::app_import_pick,
            commands::app_import_bytes,
            commands::app_import_enex_pick,
            commands::app_import_enex_read,
            commands::workspace_export_markdown,
            commands::workspace_export_reveal,
            commands::asset_write,
            commands::asset_read,
            commands::asset_pick,
            commands::asset_fetch,
            commands::asset_pick_file,
            commands::asset_import_file,
            commands::asset_import_bytes,
            commands::asset_reveal,
            commands::asset_open,
            commands::asset_save_as,
            commands::asset_src_path,
            commands::backup_export,
            commands::backup_auto,
            commands::backup_list,
            commands::backup_reveal,
            commands::backup_restore,
            commands::pdf_page,
            commands::pdf_finish,
            commands::pdf_preview_page,
            commands::pdf_print_document,
            commands::pdf_export_bytes,
            commands::pdf_save,
            commands::workspace_scan,
            commands::pages_read,
            commands::app_executable_path,
            commands::mcp_status,
            i18n::set_locale,
            commands::reminders_read,
            commands::reminders_write,
            prefs::app_prefs_apply,
            tray::tray_set_status,
            prefs::main_window_close,
        ]);

    // 앱 업데이트 확인·설치 (SYS-07). 데스크톱 전용, 서명은 tauri.conf.json의 pubkey로 검증한다
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    // 로그인할 때 시작 (SYS-15) · 빠른 입력 전역 단축키 (QN-03). 데스크톱 전용
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_autostart::Builder::new().build())
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(|app, _shortcut, event| {
                        if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                            quick::toggle(app);
                        }
                    })
                    .build(),
            );
    }

    // macOS 메뉴: ⌘W = 탭 닫기, ⇧⌘W = 창 닫기 (SHELL-11)
    #[cfg(target_os = "macos")]
    {
        builder = builder
            .menu(menu::build)
            .on_menu_event(|app, event| menu::handle(app, event.id().as_ref()));
    }

    // 개발 자동화 도구 연결 통로. 개발용 빌드에서만, 로컬 접속만 허용한다.
    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(
            tauri_plugin_mcp_bridge::Builder::new()
                .bind_address("127.0.0.1")
                .build(),
        );
    }

    let app = builder
        .build(context)
        .expect("error while building tauri application");
    app.run(|app_handle, event| {
        // Dock 아이콘을 다시 눌렀는데 보이는 창이 없으면 메인 창을 연다 (SYS-15)
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } = &event
        {
            tray::show_main(app_handle);
        }
        // Dock 종료·로그아웃 등 ExitRequested는 저장을 먼저 끝내도록 프론트엔드에 묻고 기다린다.
        // ⌘Q(메뉴)는 request_quit으로 이미 같은 흐름을 탄다.
        if let tauri::RunEvent::ExitRequested { api, .. } = &event {
            let has_windows = !app_handle.webview_windows().is_empty();
            let decision =
                quit::with_gate(|gate| gate.on_exit_requested(has_windows, Instant::now()));
            if decision == quit::ExitDecision::Prevent {
                api.prevent_exit();
                let _ = app_handle.emit(QUIT_REQUESTED_EVENT, ());
            }
        }
    });
}

const QUIT_REQUESTED_EVENT: &str = "app://quit-requested";

/// ⌘Q(메뉴)의 종료 요청. 창이 없으면 바로 끝내고, 있으면 저장을 기다린다.
/// 저장 대기 중 두 번째 요청은 강제 종료한다 (quit.rs)
pub(crate) fn request_quit<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if app.webview_windows().is_empty() {
        app.exit(0);
        return;
    }
    match quit::with_gate(|gate| gate.on_quit_request(Instant::now())) {
        quit::QuitRequest::Force => app.exit(0),
        quit::QuitRequest::Ask => {
            let _ = app.emit(QUIT_REQUESTED_EVENT, ());
        }
    }
}

/// 저장을 마친 뒤 종료한다 (프론트엔드 → Rust). 이 뒤의 ExitRequested는 막지 않는다
#[tauri::command]
fn confirm_quit(app: tauri::AppHandle) {
    quit::with_gate(|gate| gate.confirm());
    app.exit(0);
}
