//! 수식키 두 번 누르기로 빠른 입력 열기 (QN-03 선택 기능, macOS).
//! 상태 기계(`DoubleTapDetector`)는 순수 계산이라 시각을 인자로 받아 테스트한다.
//! 조건: 같은 수식키만 짧게(기본 350ms 안) 두 번 눌렀다 떼고, 그 사이에 다른 키나 수식키를 누르지 않았을 때.
//! Option(⌥)은 받지 않는다(입력 문자와 겹친다).
//! 감시(`monitor`, macOS): 설정이 켜져 있고 손쉬운 사용 권한이 있을 때만 NSEvent 모니터(전역 + 로컬)를 단다.
//! 끄면 모니터를 떼고 상태를 비운다.

// 다른 플랫폼에서는 감시가 없어 상태 기계가 테스트에서만 쓰인다
#![allow(dead_code)]

use std::sync::Mutex;

use tauri::AppHandle;

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
    pub const fn new() -> Self {
        Self {
            down: false,
            tainted: false,
            first_release: None,
            pressed_at: 0,
            fired: false,
        }
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

/// 설정에서 고른 수식키 (None이면 기능 끔)
static SELECTED: Mutex<Option<ModifierKey>> = Mutex::new(None);

/// 모니터 콜백이 함께 쓰는 상태 기계
static DETECTOR: Mutex<DoubleTapDetector> = Mutex::new(DoubleTapDetector::new());

pub fn selected() -> Option<ModifierKey> {
    *SELECTED.lock().unwrap_or_else(|e| e.into_inner())
}

pub fn select(key: Option<ModifierKey>) {
    *SELECTED.lock().unwrap_or_else(|e| e.into_inner()) = key;
}

/// 감시를 켜거나 끈다. 켜면 전역·로컬 NSEvent 모니터를 단다 (macOS 외에는 아무것도 하지 않는다)
pub fn set_monitoring(app: &AppHandle, on: bool) {
    #[cfg(target_os = "macos")]
    if on {
        monitor::install(app);
    } else {
        monitor::remove();
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, on);
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

/// 손쉬운 사용 권한 요청 창을 띄운다 (시스템 설정 안내). 권한이 있으면 아무 일도 없다
#[cfg(target_os = "macos")]
pub fn accessibility_prompt() {
    use objc2::runtime::AnyObject;
    use objc2_foundation::{NSDictionary, NSNumber, NSString};
    #[link(name = "ApplicationServices", kind = "framework")]
    unsafe extern "C" {
        fn AXIsProcessTrustedWithOptions(options: *const AnyObject) -> bool;
    }
    // kAXTrustedCheckOptionPrompt = "AXTrustedCheckOptionPrompt" (CFDictionary와 NSDictionary는 toll-free bridge)
    let key = NSString::from_str("AXTrustedCheckOptionPrompt");
    let value = NSNumber::new_bool(true);
    let value: &AnyObject = &value;
    let options = NSDictionary::from_slices(&[&*key], &[value]);
    // SAFETY: 유효한 딕셔너리 포인터를 넘긴다. 반환값(현재 권한)은 쓰지 않는다
    unsafe {
        AXIsProcessTrustedWithOptions(
            (&*options as *const NSDictionary<NSString, AnyObject>).cast(),
        );
    }
}

#[cfg(not(target_os = "macos"))]
pub fn accessibility_prompt() {}

/// 전역·로컬 키 감시 (macOS). 수식키 변화(FlagsChanged)는 상태 기계에, 일반 키 누름(KeyDown)은 진행 중인 탭을 버리는 데 쓴다.
#[cfg(target_os = "macos")]
mod monitor {
    use std::ptr::NonNull;
    use std::sync::{Mutex, OnceLock};
    use std::time::Instant;

    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{NSEvent, NSEventMask, NSEventModifierFlags};
    use tauri::AppHandle;

    use super::{DETECTOR, DoubleTapDetector, ModifierKey, selected};

    /// NSEvent 모니터 토큰. 시스템이 관리하는 객체라 메인 스레드에서만 다룬다
    struct Monitor(Retained<AnyObject>);
    // SAFETY: 모니터 토큰은 install·remove에서만 만지고, 두 곳 모두 메인 스레드 설정 경로에서 불린다
    unsafe impl Send for Monitor {}

    static MONITORS: Mutex<Vec<Monitor>> = Mutex::new(Vec::new());
    static START: OnceLock<Instant> = OnceLock::new();

    fn now_ms() -> u64 {
        START.get_or_init(Instant::now).elapsed().as_millis() as u64
    }

    fn flag_of(key: ModifierKey) -> NSEventModifierFlags {
        match key {
            ModifierKey::Control => NSEventModifierFlags::Control,
            ModifierKey::Shift => NSEventModifierFlags::Shift,
            ModifierKey::Command => NSEventModifierFlags::Command,
        }
    }

    fn on_flags_changed(app: &AppHandle, event: &NSEvent) {
        let Some(key) = selected() else { return };
        let flags = event.modifierFlags();
        let mine = flag_of(key);
        let pressed = flags.contains(mine);
        let others = [
            NSEventModifierFlags::Control,
            NSEventModifierFlags::Shift,
            NSEventModifierFlags::Command,
            NSEventModifierFlags::Option,
        ]
        .into_iter()
        .any(|f| f != mine && flags.contains(f));
        let fired = DETECTOR
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .on_modifier(pressed, others, now_ms());
        if fired {
            crate::quick::toggle(app);
        }
    }

    fn on_other_key() {
        DETECTOR
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .on_other_key();
    }

    /// 감시를 붙인다. 이미 붙어 있으면 다시 붙인다
    pub fn install(app: &AppHandle) {
        remove();
        *DETECTOR.lock().unwrap_or_else(|e| e.into_inner()) = DoubleTapDetector::new();

        let app_global = app.clone();
        let flags_global = RcBlock::new(move |event: NonNull<NSEvent>| {
            // SAFETY: 시스템이 살아 있는 이벤트 포인터를 넘긴다
            on_flags_changed(&app_global, unsafe { event.as_ref() });
        });
        let app_local = app.clone();
        let flags_local = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
            // SAFETY: 시스템이 살아 있는 이벤트 포인터를 넘긴다
            on_flags_changed(&app_local, unsafe { event.as_ref() });
            event.as_ptr()
        });
        let keys_global = RcBlock::new(move |_event: NonNull<NSEvent>| on_other_key());
        let keys_local = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
            on_other_key();
            event.as_ptr()
        });

        let mut list = Vec::new();
        // SAFETY: 모니터 블록은 시스템이 복사해 가진다. 토큰은 remove에서 푼다
        unsafe {
            if let Some(m) = NSEvent::addGlobalMonitorForEventsMatchingMask_handler(
                NSEventMask::FlagsChanged,
                &flags_global,
            ) {
                list.push(Monitor(m));
            }
            if let Some(m) = NSEvent::addLocalMonitorForEventsMatchingMask_handler(
                NSEventMask::FlagsChanged,
                &flags_local,
            ) {
                list.push(Monitor(m));
            }
            if let Some(m) = NSEvent::addGlobalMonitorForEventsMatchingMask_handler(
                NSEventMask::KeyDown,
                &keys_global,
            ) {
                list.push(Monitor(m));
            }
            if let Some(m) = NSEvent::addLocalMonitorForEventsMatchingMask_handler(
                NSEventMask::KeyDown,
                &keys_local,
            ) {
                list.push(Monitor(m));
            }
        }
        *MONITORS.lock().unwrap_or_else(|e| e.into_inner()) = list;
    }

    /// 붙인 모니터를 모두 뗀다
    pub fn remove() {
        let list = std::mem::take(&mut *MONITORS.lock().unwrap_or_else(|e| e.into_inner()));
        for monitor in list {
            // SAFETY: install이 만든 토큰이다
            unsafe { NSEvent::removeMonitor(&monitor.0) };
        }
    }
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
