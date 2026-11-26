//! 종료 흐름 (DATA-07). Cmd+Q·Dock 종료는 프런트엔드가 저장을 끝내고 `confirm_quit`을 부를 때까지 막는다.
//! 저장이 끝나지 않으면 `FORCE_WINDOW` 안의 두 번째 종료 요청은 저장을 기다리지 않고 바로 종료한다(갇히지 않게).
//! 순수 상태 계산만 둔다. Tauri 호출은 lib.rs가 한다.

use std::sync::Mutex;
use std::time::{Duration, Instant};

/// 첫 요청 뒤 이 시간 안의 두 번째 요청은 강제 종료다
pub const FORCE_WINDOW: Duration = Duration::from_secs(5);

/// 종료 요청 한 번에 대한 결과
#[derive(Debug, PartialEq, Eq)]
pub enum QuitRequest {
    /// 프런트엔드에 저장 후 종료를 묻는다
    Ask,
    /// 저장을 기다리지 않고 종료한다
    Force,
}

/// `RunEvent::ExitRequested` 한 번에 대한 결과
#[derive(Debug, PartialEq, Eq)]
pub enum ExitDecision {
    Allow,
    Prevent,
}

#[derive(Debug)]
pub struct QuitGate {
    /// `confirm_quit`이나 강제 종료로 종료가 허락됐다. 그 뒤의 종료 요청은 막지 않는다
    confirmed: bool,
    /// 저장 확인을 기다리는 첫 요청의 시각
    pending_since: Option<Instant>,
}

impl QuitGate {
    pub const fn new() -> Self {
        Self {
            confirmed: false,
            pending_since: None,
        }
    }

    /// 사용자가 ⌘Q(메뉴)나 Dock 종료를 요청했다
    pub fn on_quit_request(&mut self, now: Instant) -> QuitRequest {
        match self.pending_since {
            Some(since) if now.duration_since(since) < FORCE_WINDOW => {
                self.confirmed = true;
                QuitRequest::Force
            }
            _ => {
                self.pending_since = Some(now);
                QuitRequest::Ask
            }
        }
    }

    /// `RunEvent::ExitRequested`: 허락됐거나 열린 창이 없으면 막지 않는다.
    /// 그 밖의 종료(Dock·로그아웃)는 종료 요청과 같게 처리한다
    pub fn on_exit_requested(&mut self, has_windows: bool, now: Instant) -> ExitDecision {
        if self.confirmed || !has_windows {
            return ExitDecision::Allow;
        }
        match self.on_quit_request(now) {
            QuitRequest::Force => ExitDecision::Allow,
            QuitRequest::Ask => ExitDecision::Prevent,
        }
    }

    /// 프런트엔드가 저장을 마치고 `confirm_quit`을 불렀다
    pub fn confirm(&mut self) {
        self.confirmed = true;
        self.pending_since = None;
    }
}

/// 앱 전체의 종료 상태. 잠금은 짧게만 잡고, `app.exit`은 잠금을 푼 뒤 부른다
pub static QUIT: Mutex<QuitGate> = Mutex::new(QuitGate::new());

pub fn with_gate<T>(f: impl FnOnce(&mut QuitGate) -> T) -> T {
    // 잠금이 독살돼도 상태 값은 그대로 쓸 수 있다
    let mut guard = QUIT.lock().unwrap_or_else(|e| e.into_inner());
    f(&mut guard)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_request_asks_and_second_within_window_forces() {
        let mut gate = QuitGate::new();
        let t0 = Instant::now();
        assert_eq!(gate.on_quit_request(t0), QuitRequest::Ask);
        assert_eq!(
            gate.on_quit_request(t0 + Duration::from_secs(1)),
            QuitRequest::Force
        );
    }

    #[test]
    fn request_after_window_asks_again() {
        let mut gate = QuitGate::new();
        let t0 = Instant::now();
        assert_eq!(gate.on_quit_request(t0), QuitRequest::Ask);
        assert_eq!(
            gate.on_quit_request(t0 + FORCE_WINDOW + Duration::from_millis(1)),
            QuitRequest::Ask
        );
    }

    #[test]
    fn exit_is_prevented_until_confirmed() {
        let mut gate = QuitGate::new();
        let t0 = Instant::now();
        assert_eq!(gate.on_exit_requested(true, t0), ExitDecision::Prevent);
        gate.confirm();
        assert_eq!(gate.on_exit_requested(true, t0), ExitDecision::Allow);
    }

    #[test]
    fn exit_is_allowed_without_windows() {
        let mut gate = QuitGate::new();
        assert_eq!(
            gate.on_exit_requested(false, Instant::now()),
            ExitDecision::Allow
        );
    }

    #[test]
    fn forced_quit_marks_confirmed_so_the_exit_is_not_prevented() {
        let mut gate = QuitGate::new();
        let t0 = Instant::now();
        assert_eq!(gate.on_exit_requested(true, t0), ExitDecision::Prevent);
        // 두 번째 요청(같은 창 안)은 강제 종료. 이어지는 ExitRequested는 막지 않는다
        assert_eq!(
            gate.on_quit_request(t0 + Duration::from_secs(2)),
            QuitRequest::Force
        );
        assert_eq!(
            gate.on_exit_requested(true, t0 + Duration::from_secs(2)),
            ExitDecision::Allow
        );
    }

    #[test]
    fn confirm_clears_pending_so_next_request_asks() {
        let mut gate = QuitGate::new();
        let t0 = Instant::now();
        gate.on_quit_request(t0);
        gate.confirm();
        // 확인된 뒤에는 앱이 곧 끝난다. 다시 요청이 오면 새 흐름으로 본다
        assert_eq!(gate.pending_since, None);
    }
}
