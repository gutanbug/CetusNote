//! 빠른 입력 전역 단축키 (QN-03). 조합 문자열을 검사하고 OS에 등록한다.
//! 검사(`validate`)는 순수 함수라 단위 테스트로 잡는다. Spotlight(⌘Space)와 한·영 전환에 흔한 ⌥Space는 받지 않는다.

use std::str::FromStr;
use std::sync::Mutex;

use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use crate::storage::{Result, StorageError};

/// 기본 단축키 (설정에서 바꿀 수 있다)
#[cfg_attr(not(test), allow(dead_code))] // 프런트엔드 기본값과 맞춘 기준 값 (테스트에서 검사)
pub const DEFAULT_SHORTCUT: &str = "Alt+Shift+Space";

/// 지금 등록된 단축키 (다시 등록할 때 이전 것을 풀고, 실패하면 되돌린다)
static CURRENT: Mutex<Option<Shortcut>> = Mutex::new(None);

/// 조합 문자열을 검사한다. 통과하면 등록 가능한 `Shortcut`을, 아니면 사유 코드를 돌려준다.
/// 규칙: 수식키가 하나 이상, 키는 마지막 토큰, ⌘Space·⌥Space(수식키가 ⌘ 또는 ⌥ 하나뿐인 Space)는 금지
pub fn validate(combo: &str) -> std::result::Result<Shortcut, &'static str> {
    let tokens: Vec<String> = combo
        .split('+')
        .map(|t| t.trim().to_ascii_lowercase())
        .collect();
    let (key, mods) = tokens.split_last().ok_or("invalid_shortcut")?;
    if key.is_empty() || mods.is_empty() || mods.iter().any(|m| m.is_empty()) {
        return Err("invalid_shortcut");
    }
    let mut has_shift = false;
    let mut has_ctrl = false;
    let mut has_alt = false;
    let mut has_meta = false;
    for m in mods {
        match m.as_str() {
            "shift" => has_shift = true,
            "control" | "ctrl" => has_ctrl = true,
            "alt" | "option" => has_alt = true,
            "super" | "cmd" | "command" | "meta" => has_meta = true,
            "commandorcontrol" | "cmdorctrl" => has_meta = true,
            _ => return Err("invalid_shortcut"),
        }
    }
    let only_space_key = key == "space";
    // ⌘Space(Spotlight)와 ⌥Space(입력기 전환)는 빠른 입력에 쓰지 않는다
    let lone_meta_or_alt = !has_shift && !has_ctrl && (has_meta ^ has_alt);
    if only_space_key && lone_meta_or_alt {
        return Err("shortcut_reserved");
    }
    Shortcut::from_str(combo).map_err(|_| "invalid_shortcut")
}

fn message(code: &str) -> &'static str {
    match code {
        "shortcut_reserved" => "⌘Space와 ⌥Space는 시스템이 쓰므로 고를 수 없어요",
        "shortcut_unavailable" => "이 단축키는 다른 앱이나 시스템이 이미 쓰고 있어요",
        _ => "단축키를 읽지 못했어요",
    }
}

/// 단축키를 (다시) 등록한다. 등록에 실패하면 이전 단축키를 그대로 살린다.
#[cfg(desktop)]
pub fn set(app: &AppHandle, combo: &str) -> Result<()> {
    let next = validate(combo).map_err(|code| StorageError::new(code, message(code)))?;
    let gs = app.global_shortcut();
    let mut current = CURRENT.lock().unwrap_or_else(|e| e.into_inner());
    let previous = current.take();
    if let Some(old) = previous {
        let _ = gs.unregister(old);
    }
    if gs.is_registered(next) {
        let _ = gs.unregister(next);
    }
    match gs.register(next) {
        Ok(()) => {
            *current = Some(next);
            Ok(())
        }
        Err(_) => {
            // 실패하면 이전 단축키를 다시 건다
            if let Some(old) = previous.filter(|old| gs.register(*old).is_ok()) {
                *current = Some(old);
            }
            Err(StorageError::new(
                "shortcut_unavailable",
                message("shortcut_unavailable"),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_shortcut_is_valid() {
        assert!(validate(DEFAULT_SHORTCUT).is_ok());
    }

    #[test]
    fn rejects_command_space_and_option_space() {
        assert_eq!(validate("Super+Space"), Err("shortcut_reserved"));
        assert_eq!(validate("Cmd+Space"), Err("shortcut_reserved"));
        assert_eq!(validate("Alt+Space"), Err("shortcut_reserved"));
        assert_eq!(validate("Option+Space"), Err("shortcut_reserved"));
    }

    #[test]
    fn allows_combos_with_more_modifiers() {
        assert!(validate("Super+Shift+Space").is_ok());
        assert!(validate("Control+Alt+Space").is_ok());
        assert!(validate("Alt+Shift+Space").is_ok());
    }

    #[test]
    fn requires_a_modifier_and_a_key() {
        assert_eq!(validate("Space"), Err("invalid_shortcut"));
        assert_eq!(validate("Alt+"), Err("invalid_shortcut"));
        assert_eq!(validate(""), Err("invalid_shortcut"));
        assert_eq!(validate("+Alt+Space"), Err("invalid_shortcut"));
    }

    #[test]
    fn rejects_unknown_modifiers() {
        assert_eq!(validate("Hyper+Space"), Err("invalid_shortcut"));
    }
}
