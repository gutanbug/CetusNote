//! 메뉴 막대·로그인 시작·빠른 입력 단축키·두 번 누르기 설정을 Rust 쪽에 적용한다 (SYS-15, QN-03).
//! 값의 원본은 프런트엔드 설정(settings.json)이다. 앱이 열릴 때와 설정을 바꿀 때 `app_prefs_apply`로 넘긴다.

use serde::Deserialize;
use tauri::AppHandle;

use crate::double_tap::{self, ModifierKey};
use crate::storage::{Result, StorageError};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPrefs {
    /// 「메뉴 막대에 남기」: 창을 닫아도 메뉴 막대에 남는다
    pub menu_bar_resident: bool,
    /// 「로그인할 때 시작」
    pub launch_at_login: bool,
    /// 빠른 입력 단축키 조합 (예 "Alt+Shift+Space")
    pub quick_shortcut: String,
    /// 두 번 누르기 수식키: "off" · "control" · "shift" · "command"
    pub double_tap: String,
}

/// 설정을 적용한다. 단축키 등록이나 권한이 안 되면 사유 코드와 함께 실패한다
#[tauri::command]
pub fn app_prefs_apply(app: AppHandle, prefs: AppPrefs) -> Result<()> {
    #[cfg(desktop)]
    {
        crate::shortcut::set(&app, &prefs.quick_shortcut)?;
        apply_autostart(&app, prefs.launch_at_login)?;
    }
    crate::tray::set_resident(&app, prefs.menu_bar_resident);
    apply_double_tap(&app, &prefs.double_tap)
}

/// 메인 창 닫기 마무리 (프런트엔드가 저장을 끝낸 뒤 부른다). 메뉴 막대에 남기면 숨기고, 아니면 닫는다.
/// 닫으면 `on_window_event`가 앱을 끝낸다 (tray 상주 꺼짐)
#[tauri::command]
pub fn main_window_close(app: AppHandle) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        if crate::tray::resident() {
            let _ = window.hide();
        } else {
            let _ = window.destroy();
        }
    }
}

#[cfg(desktop)]
fn apply_autostart(app: &AppHandle, on: bool) -> Result<()> {
    use tauri_plugin_autostart::ManagerExt;
    let launcher = app.autolaunch();
    let result = if on {
        launcher.enable()
    } else {
        launcher.disable()
    };
    result.map_err(|_| StorageError::new("autostart_failed", "로그인 시작 설정을 바꾸지 못했어요"))
}

/// 두 번 누르기 설정 값을 고른 수식키로 바꾼다 ("off"는 None)
fn parse_double_tap(value: &str) -> Result<Option<ModifierKey>> {
    if value == "off" {
        return Ok(None);
    }
    ModifierKey::parse(value)
        .map(Some)
        .ok_or_else(|| StorageError::new("invalid_double_tap", "지원하지 않는 수식키예요"))
}

/// 두 번 누르기 설정. 켜려면 손쉬운 사용 권한이 필요하다 (macOS).
/// 권한이 없으면 감시를 붙이지 않고 권한 요청 창을 띄운 뒤 `accessibility_required`로 알린다.
fn apply_double_tap(app: &AppHandle, value: &str) -> Result<()> {
    let key = parse_double_tap(value)?;
    double_tap::select(key);
    if key.is_none() {
        double_tap::set_monitoring(app, false);
        return Ok(());
    }
    if !double_tap::accessibility_trusted() {
        double_tap::set_monitoring(app, false);
        double_tap::accessibility_prompt();
        return Err(StorageError::new(
            "accessibility_required",
            "두 번 누르기는 손쉬운 사용 권한이 있어야 해요",
        ));
    }
    double_tap::set_monitoring(app, true);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefs_deserialize_from_camel_case() {
        let json = r#"{"menuBarResident":true,"launchAtLogin":false,"quickShortcut":"Alt+Shift+Space","doubleTap":"off"}"#;
        let prefs: AppPrefs = serde_json::from_str(json).expect("parse");
        assert!(prefs.menu_bar_resident);
        assert!(!prefs.launch_at_login);
        assert_eq!(prefs.quick_shortcut, "Alt+Shift+Space");
        assert_eq!(prefs.double_tap, "off");
    }

    #[test]
    fn double_tap_parses_off_and_allowed_keys() {
        assert_eq!(parse_double_tap("off").expect("off"), None);
        assert_eq!(
            parse_double_tap("shift").expect("shift"),
            Some(ModifierKey::Shift)
        );
    }

    #[test]
    fn double_tap_rejects_option_key() {
        let err = parse_double_tap("option").expect_err("option is not allowed");
        let _ = err;
    }
}
