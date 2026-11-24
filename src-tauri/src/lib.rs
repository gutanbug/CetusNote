mod app_icon;
mod app_import;
mod commands;
#[cfg(target_os = "macos")]
mod menu;
mod pdf;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
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
            commands::document_pick,
            commands::document_bytes,
            commands::document_pdf_text,
            commands::document_image,
            commands::app_import_pick,
            commands::app_import_bytes,
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
        ]);

    // 앱 업데이트 확인·설치 (SYS-07). 데스크톱 전용, 서명은 tauri.conf.json의 pubkey로 검증한다
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
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

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
