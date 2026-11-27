//! 빠른 입력 창 (QN-03). 두 번째 웹뷰 창 `quick`을 처음 열 때 만든다.
//! 테두리 없는 작은 창을 커서가 있는 화면의 위쪽 가운데(높이의 20%)에 띄운다.
//! 같은 프런트엔드를 `#/quick` 해시로 연다. 포커스를 잃으면 `on_window_event`(lib.rs)가 숨긴다.
//! Esc·저장은 프런트엔드가 `window.hide()`로 숨긴다 (core:window:allow-hide).

use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const LABEL: &str = "quick";
/// 기본 크기 (논리 px). 결과가 나오면 프런트엔드가 높이를 늘린다
pub const WIDTH: f64 = 680.0;
pub const HEIGHT: f64 = 72.0;

/// 창을 띄울 때 위에서 내려오는 비율 (화면 높이의 20%)
const TOP_RATIO: f64 = 0.2;

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
    allow_over_fullscreen(&window);
    Ok(window)
}

/// 전체 화면 앱 위에도 뜨게 한다 (NSWindowCollectionBehaviorFullScreenAuxiliary)
#[cfg(target_os = "macos")]
fn allow_over_fullscreen<R: Runtime>(window: &WebviewWindow<R>) {
    use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior};
    if let Ok(ptr) = window.ns_window() {
        // SAFETY: Tauri가 만든 NSWindow 포인터다. 창이 살아 있는 동안만 쓴다(이 함수는 만든 직후 부른다)
        let ns: &NSWindow = unsafe { &*(ptr as *const NSWindow) };
        let behavior = ns.collectionBehavior()
            | NSWindowCollectionBehavior::FullScreenAuxiliary
            | NSWindowCollectionBehavior::CanJoinAllSpaces;
        ns.setCollectionBehavior(behavior);
    }
}

/// 커서가 있는 화면에서 창의 위치를 정한다 (위쪽 가운데, 높이의 20%)
fn position<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let cursor = app.cursor_position().ok();
    let monitors = app.available_monitors().unwrap_or_default();
    let monitor = cursor
        .and_then(|c| {
            monitors.iter().find(|m| {
                let p = m.position();
                let s = m.size();
                c.x >= f64::from(p.x)
                    && c.x < f64::from(p.x) + f64::from(s.width)
                    && c.y >= f64::from(p.y)
                    && c.y < f64::from(p.y) + f64::from(s.height)
            })
        })
        .cloned()
        .or_else(|| window.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else { return };
    let scale = monitor.scale_factor();
    let origin = monitor.position();
    let size = monitor.size();
    let win_w = WIDTH * scale;
    let x = f64::from(origin.x) + (f64::from(size.width) - win_w) / 2.0;
    let y = f64::from(origin.y) + f64::from(size.height) * TOP_RATIO;
    let _ = window.set_position(tauri::PhysicalPosition::new(
        x.round() as i32,
        y.round() as i32,
    ));
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

/// 빠른 입력 창을 연다 (앞으로 가져와 포커스를 준다)
pub fn show<R: Runtime>(app: &AppHandle<R>) {
    let Ok(window) = ensure(app) else { return };
    position(app, &window);
    let _ = window.show();
    let _ = window.set_focus();
}
