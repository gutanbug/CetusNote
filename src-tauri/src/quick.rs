//! 빠른 입력 창 (QN-03). 두 번째 웹뷰 창 `quick`을 처음 열 때 만든다.
//! 테두리 없는 작은 창을 커서가 있는 화면의 보이는 영역(메뉴 막대·Dock 제외) 가로 가운데, 아래쪽에 띄운다.
//! macOS에서는 비활성 NSPanel(tauri-nspanel)이다. 패널은 앱을 활성화하지 않고 떠서, 숨어 있던 메인 창이 앞으로 나오지 않는다.
//! 전체 화면 앱 위·모든 Space에 뜬다. 같은 프런트엔드를 `#/quick` 해시로 연다.
//! 포커스를 잃으면 `on_window_event`(lib.rs)가 숨긴다. Esc·저장은 프런트엔드가 `window.hide()`로 숨긴다.

use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Monitor, Runtime, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};

pub const LABEL: &str = "quick";
/// 창이 떴을 때 프런트엔드에 알리는 이벤트 (포커스·목록 새로 읽기)
pub const SHOWN_EVENT: &str = "quick://shown";
/// 기본 크기 (논리 px). 결과가 나오면 프런트엔드가 높이를 늘린다
pub const WIDTH: f64 = 680.0;
pub const HEIGHT: f64 = 72.0;

/// 입력 줄 아래 끝이 보이는 영역 바닥에서 올라가는 비율 (보이는 영역 높이의 25%)
const BOTTOM_RATIO: f64 = 0.25;

#[cfg(target_os = "macos")]
tauri_nspanel::tauri_panel! {
    panel!(QuickPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

/// 보이는 영역 (논리 px, y는 아래로 증가)
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// 창의 왼쪽 위 좌표를 정한다. 규칙:
/// - 가로: 보이는 영역의 가운데.
/// - 세로: 입력 줄(기본 높이 `HEIGHT`)의 아래 끝이 보이는 영역 바닥에서 높이의 25% 위에 온다.
///   창의 위쪽 끝은 입력 줄 위치에 고정되어, 결과가 늘어나면 아래로 자란다.
/// - 창의 아래 끝이 보이는 영역 밖으로 나가면 그만큼 위로 민다.
pub fn origin(visible: Rect, win_w: f64, win_h: f64) -> (f64, f64) {
    let x = visible.x + (visible.width - win_w) / 2.0;
    let bar_bottom = visible.y + visible.height - visible.height * BOTTOM_RATIO;
    let bar_top = bar_bottom - HEIGHT;
    let max_top = visible.y + visible.height - win_h;
    (x, bar_top.min(max_top))
}

#[cfg(target_os = "macos")]
fn setup_panel<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    use tauri_nspanel::{CollectionBehavior, PanelLevel, StyleMask, WebviewWindowExt};
    let panel = window.to_panel::<QuickPanel<R>>()?;
    // 비활성 패널: 키보드 입력은 받되 앱을 활성화하지 않는다
    panel
        .set_style_mask(StyleMask::empty().nonactivating_panel().value())
        .map_err(|e| tauri::Error::Io(std::io::Error::other(e.to_string())))?;
    panel.set_level(PanelLevel::PopUpMenu.value());
    panel.set_collection_behavior(
        CollectionBehavior::new()
            .can_join_all_spaces()
            .full_screen_auxiliary()
            .stationary()
            .ignores_cycle()
            .value(),
    );
    panel.set_hides_on_deactivate(false);
    panel.set_becomes_key_only_if_needed(false);
    Ok(())
}

/// 창을 만든다 (없을 때만). 숨긴 상태로 만들고 `show`가 연다.
fn ensure<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<WebviewWindow<R>> {
    if let Some(window) = app.get_webview_window(LABEL) {
        return Ok(window);
    }
    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html#/quick".into()))
        .title("빠른 입력")
        .inner_size(WIDTH, HEIGHT)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .focused(true)
        .visible_on_all_workspaces(true)
        .build()?;
    #[cfg(target_os = "macos")]
    setup_panel(&window)?;
    Ok(window)
}

/// 커서가 있는 화면 (없으면 기본 화면)
fn cursor_monitor<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) -> Option<Monitor> {
    let cursor = app.cursor_position().ok();
    let monitors = app.available_monitors().unwrap_or_default();
    cursor
        .and_then(|c| {
            monitors.into_iter().find(|m| {
                let p = m.position();
                let s = m.size();
                c.x >= f64::from(p.x)
                    && c.x < f64::from(p.x) + f64::from(s.width)
                    && c.y >= f64::from(p.y)
                    && c.y < f64::from(p.y) + f64::from(s.height)
            })
        })
        .or_else(|| window.primary_monitor().ok().flatten())
}

/// 창의 크기와 위치를 정한다 (논리 px). 화면 정보가 없으면 크기만 바꾼다
fn place<R: Runtime>(
    window: &WebviewWindow<R>,
    monitor: Option<&Monitor>,
    width: f64,
    height: f64,
) {
    if let Some(m) = monitor {
        let scale = m.scale_factor();
        let area = m.work_area();
        let visible = Rect {
            x: f64::from(area.position.x) / scale,
            y: f64::from(area.position.y) / scale,
            width: f64::from(area.size.width) / scale,
            height: f64::from(area.size.height) / scale,
        };
        let (x, y) = origin(visible, width, height);
        let _ = window.set_size(LogicalSize::new(width, height));
        let _ = window.set_position(LogicalPosition::new(x, y));
    } else {
        let _ = window.set_size(LogicalSize::new(width, height));
    }
}

/// 창의 현재 크기 (논리 px)
fn logical_size<R: Runtime>(window: &WebviewWindow<R>) -> (f64, f64) {
    let scale = window.scale_factor().unwrap_or(1.0);
    match window.inner_size() {
        Ok(s) => (f64::from(s.width) / scale, f64::from(s.height) / scale),
        Err(_) => (WIDTH, HEIGHT),
    }
}

/// 보이게 한다. macOS는 패널을 키 창으로만 띄운다 (앱을 활성화하지 않는다)
fn present<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    #[cfg(target_os = "macos")]
    {
        use tauri_nspanel::ManagerExt;
        if let Ok(panel) = app.get_webview_panel(LABEL) {
            panel.show_and_make_key();
            return;
        }
    }
    let _ = app;
    let _ = window.show();
    let _ = window.set_focus();
}

/// 보이면 숨기고, 아니면 연다. 단축키·메뉴 막대·두 번 누르기가 부른다
pub fn toggle<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app
        .get_webview_window(LABEL)
        .filter(|w| w.is_visible().unwrap_or(false))
    {
        let _ = window.hide();
        return;
    }
    show(app);
}

/// 빠른 입력 창을 연다. 메인 창을 앞으로 가져오지 않는다 (macOS: 비활성 패널)
pub fn show<R: Runtime>(app: &AppHandle<R>) {
    // 창·패널 조작은 메인 스레드에서 한다
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || show_on_main(&handle));
}

fn show_on_main<R: Runtime>(app: &AppHandle<R>) {
    let Ok(window) = ensure(app) else { return };
    let monitor = cursor_monitor(app, &window);
    let (width, height) = logical_size(&window);
    place(&window, monitor.as_ref(), width, height);
    present(app, &window);
    let _ = app.emit(SHOWN_EVENT, ());
}

/// 프런트엔드가 결과 개수에 맞춰 높이를 바꾼다. 입력 줄 위치 규칙을 다시 적용한다
#[tauri::command]
pub fn quick_resize(app: AppHandle, width: f64, height: f64) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(window) = handle.get_webview_window(LABEL) else {
            return;
        };
        let monitor = window
            .current_monitor()
            .ok()
            .flatten()
            .or_else(|| window.primary_monitor().ok().flatten());
        place(&window, monitor.as_ref(), width, height);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const VISIBLE: Rect = Rect {
        x: 0.0,
        y: 25.0,
        width: 1440.0,
        height: 875.0,
    };

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-9
    }

    #[test]
    fn centers_horizontally_on_visible_frame() {
        let (x, _) = origin(VISIBLE, WIDTH, HEIGHT);
        assert!(close(x, (1440.0 - WIDTH) / 2.0));
    }

    #[test]
    fn input_bar_sits_a_quarter_height_above_the_bottom() {
        // 입력 줄 아래 끝 = 보이는 영역 바닥(900) - 높이의 25%(218.75)
        let (_, y) = origin(VISIBLE, WIDTH, HEIGHT);
        assert!(close(y + HEIGHT, 900.0 - 875.0 * 0.25));
    }

    #[test]
    fn taller_window_keeps_top_and_grows_down() {
        let (_, base) = origin(VISIBLE, WIDTH, HEIGHT);
        let (_, taller) = origin(VISIBLE, WIDTH, 200.0);
        assert!(close(base, taller));
    }

    #[test]
    fn window_is_shifted_up_so_it_never_leaves_the_visible_frame() {
        let (_, y) = origin(VISIBLE, WIDTH, 400.0);
        assert!(close(y + 400.0, 900.0));
    }

    #[test]
    fn works_on_a_monitor_with_an_offset_origin() {
        let second = Rect {
            x: 1440.0,
            y: 0.0,
            width: 1920.0,
            height: 1080.0,
        };
        let (x, y) = origin(second, WIDTH, HEIGHT);
        assert!(close(x, 1440.0 + (1920.0 - WIDTH) / 2.0));
        assert!(close(y + HEIGHT, 1080.0 - 1080.0 * 0.25));
    }
}
