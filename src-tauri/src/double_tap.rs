//! 수식키 두 번 누르기로 빠른 입력 열기 (QN-03 선택 기능, macOS).
//! 상태 기계(`DoubleTapDetector`)는 순수 계산이라 시각을 인자로 받아 테스트한다.
//! 조건: 같은 수식키만 짧게(기본 350ms 안) 두 번 눌렀다 떼고, 그 사이에 다른 키나 수식키를 누르지 않았을 때.
//! Option(⌥)은 받지 않는다(입력 문자와 겹친다).
//! 전역 키 감시(NSEvent 모니터)는 아직 붙이지 않았다 — prefs.rs의 `TODO`. 설정·권한 확인·상태 기계만 준비돼 있다.

// 감시 스레드가 붙기 전까지 상태 기계는 테스트에서만 쓰인다
#![allow(dead_code)]

use std::sync::Mutex;

/// 두 번째 누름 전까지 허용하는 간격 (ms)
pub const WINDOW_MS: u64 = 350;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModifierKey {
    Control,
    Shift,
    Command,
}

impl ModifierKey {
    /// 설정 값("control" · "shift" · "command")을 고른다. "off"나 Option은 None
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "control" => Some(Self::Control),
            "shift" => Some(Self::Shift),
            "command" => Some(Self::Command),
            _ => None,
        }
    }
}

/// 한 수식키의 두 번 누르기를 알아본다
#[derive(Debug, Default)]
pub struct DoubleTapDetector {
    down: bool,
    /// 이번 누름 동안 다른 키·수식키가 함께 눌렸다 (두 번 누르기가 아니다)
    tainted: bool,
    /// 첫 번째 짧은 누름을 뗀 시각
    first_release: Option<u64>,
    /// 이번 누름을 시작한 시각
    pressed_at: u64,
    /// 직전 누름에서 발동했다 (그 뒤 떼기는 새 첫 번째 누름이 아니다)
    fired: bool,
}

impl DoubleTapDetector {
    pub fn new() -> Self {
        Self::default()
    }

    /// 감시 중인 수식키의 눌림 상태가 바뀌었다.
    /// `others_down`: 이 수식키 말고 다른 수식키가 눌려 있다. 돌아온 값은 두 번 누르기가 완성됐는지
    pub fn on_modifier(&mut self, pressed: bool, others_down: bool, now_ms: u64) -> bool {
        if pressed && !self.down {
            // 누르기 시작
            self.down = true;
            self.pressed_at = now_ms;
            self.tainted = others_down;
            let within = self
                .first_release
                .is_some_and(|t| now_ms.saturating_sub(t) <= WINDOW_MS);
            if within && !self.tainted {
                // 두 번째 누름에서 발동한다. 이어서 떼는 것은 새 사이클의 시작이 아니다
                self.first_release = None;
                self.fired = true;
                return true;
            }
            if !within {
                self.first_release = None;
            }
            return false;
        }
        if !pressed && self.down {
            // 떼기: 깨끗한 짧은 누름이면 첫 번째 누름으로 기록한다
            self.down = false;
            let held = now_ms.saturating_sub(self.pressed_at);
            if std::mem::take(&mut self.fired) || self.tainted || held > WINDOW_MS {
                // 길게 누른 것은 탭이 아니다
                self.first_release = None;
            } else {
                self.first_release = Some(now_ms);
            }
            return false;
        }
        if pressed && self.down && others_down {
            self.tainted = true;
        }
        false
    }

    /// 다른 일반 키가 눌렸다. 진행 중인 두 번 누르기를 버린다
    pub fn on_other_key(&mut self) {
        self.tainted = true;
        self.first_release = None;
    }
}

/// 설정에서 고른 수식키 (None이면 기능 끔). 감시 스레드가 생기면 이 값을 본다
static SELECTED: Mutex<Option<ModifierKey>> = Mutex::new(None);

pub fn selected() -> Option<ModifierKey> {
    *SELECTED.lock().unwrap_or_else(|e| e.into_inner())
}

pub fn select(key: Option<ModifierKey>) {
    *SELECTED.lock().unwrap_or_else(|e| e.into_inner()) = key;
}

/// 손쉬운 사용 권한이 있는지. 권한이 없으면 전역 키를 볼 수 없다 (macOS만 실제로 묻는다)
#[cfg(target_os = "macos")]
pub fn accessibility_trusted() -> bool {
    #[link(name = "ApplicationServices", kind = "framework")]
    unsafe extern "C" {
        fn AXIsProcessTrusted() -> bool;
    }
    // SAFETY: 인자 없이 권한 상태만 읽는 C 함수다
    unsafe { AXIsProcessTrusted() }
}

#[cfg(not(target_os = "macos"))]
pub fn accessibility_trusted() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_quick_taps_fire_once() {
        let mut d = DoubleTapDetector::new();
        assert!(!d.on_modifier(true, false, 0));
        assert!(!d.on_modifier(false, false, 80));
        assert!(d.on_modifier(true, false, 200));
    }

    #[test]
    fn second_tap_after_window_does_not_fire() {
        let mut d = DoubleTapDetector::new();
        d.on_modifier(true, false, 0);
        d.on_modifier(false, false, 80);
        assert!(!d.on_modifier(true, false, 80 + WINDOW_MS + 1));
    }

    #[test]
    fn holding_the_key_is_not_a_tap() {
        let mut d = DoubleTapDetector::new();
        d.on_modifier(true, false, 0);
        assert!(!d.on_modifier(true, false, 100));
        assert!(!d.on_modifier(false, false, 400));
        assert!(!d.on_modifier(true, false, 500));
    }

    #[test]
    fn other_key_between_taps_cancels() {
        let mut d = DoubleTapDetector::new();
        d.on_modifier(true, false, 0);
        d.on_modifier(false, false, 50);
        d.on_other_key();
        assert!(!d.on_modifier(true, false, 150));
    }

    #[test]
    fn other_modifier_during_press_cancels() {
        let mut d = DoubleTapDetector::new();
        d.on_modifier(true, true, 0);
        d.on_modifier(false, false, 50);
        assert!(!d.on_modifier(true, false, 150));
    }

    #[test]
    fn third_tap_starts_a_new_cycle() {
        let mut d = DoubleTapDetector::new();
        d.on_modifier(true, false, 0);
        d.on_modifier(false, false, 50);
        assert!(d.on_modifier(true, false, 100));
        d.on_modifier(false, false, 150);
        assert!(!d.on_modifier(true, false, 200));
    }

    #[test]
    fn parses_only_allowed_modifiers() {
        assert_eq!(ModifierKey::parse("control"), Some(ModifierKey::Control));
        assert_eq!(ModifierKey::parse("shift"), Some(ModifierKey::Shift));
        assert_eq!(ModifierKey::parse("command"), Some(ModifierKey::Command));
        assert_eq!(ModifierKey::parse("option"), None);
        assert_eq!(ModifierKey::parse("off"), None);
    }
}
