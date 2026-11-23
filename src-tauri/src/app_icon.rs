//! 앱 아이콘 바꾸기 (SET-07). 설정 > 외형에서 고른 아이콘을 Dock(macOS)과 창 아이콘(Windows·Linux)에 건다.
//! 번들 아이콘(icons/icon.icns·icon.ico)은 라이트 테마용이고, 런타임 전환용 PNG는 icons/themes/에 둔다.

use crate::storage::{Result, StorageError};
use tauri::AppHandle;

const LIGHT_PNG: &[u8] = include_bytes!("../icons/themes/light/icon-512.png");
const DARK_PNG: &[u8] = include_bytes!("../icons/themes/dark/icon-512.png");

/// 테마 이름("light" = 화이트, "dark" = 블랙)에 맞는 아이콘 PNG. 다른 이름이면 None.
pub fn png_for(theme: &str) -> Option<&'static [u8]> {
    match theme {
        "light" => Some(LIGHT_PNG),
        "dark" => Some(DARK_PNG),
        _ => None,
    }
}

/// 아이콘을 메인 스레드에서 바꾼다. 아이콘은 꾸밈이라 실패해도 앱 동작에는 영향이 없다.
pub fn apply(app: &AppHandle, bytes: &'static [u8]) -> Result<()> {
    #[cfg(target_os = "macos")]
    let queued = app.run_on_main_thread(move || set_dock_icon(bytes));

    #[cfg(not(target_os = "macos"))]
    let queued = {
        use tauri::Manager;
        let handle = app.clone();
        app.run_on_main_thread(move || {
            if let Some(window) = handle.get_webview_window("main")
                && let Ok(icon) = tauri::image::Image::from_bytes(bytes)
            {
                let _ = window.set_icon(icon);
            }
        })
    };

    queued.map_err(|e| StorageError::new("io", e.to_string()))
}

/// NSApplication에 Dock 아이콘 이미지를 건다. 메인 스레드가 아니면 아무 일도 하지 않는다.
#[cfg(target_os = "macos")]
fn set_dock_icon(bytes: &[u8]) {
    use objc2::{AnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let data = NSData::with_bytes(bytes);
    let Some(image) = NSImage::initWithData(NSImage::alloc(), &data) else {
        return;
    };
    let app = NSApplication::sharedApplication(mtm);
    unsafe { app.setApplicationIconImage(Some(&image)) };
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG_SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];

    #[test]
    fn maps_light_and_dark_to_their_png_files() {
        assert_eq!(png_for("light").map(|b| &b[..8]), Some(&PNG_SIGNATURE[..]));
        assert_eq!(png_for("dark").map(|b| &b[..8]), Some(&PNG_SIGNATURE[..]));
        assert_ne!(png_for("light"), png_for("dark"));
    }

    #[test]
    fn rejects_anything_else() {
        assert!(png_for("system").is_none());
        assert!(png_for("").is_none());
        assert!(png_for("Dark").is_none());
    }
}
