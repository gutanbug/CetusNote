//! PDF 내보내기(DATA-06): 메인 WKWebView의 인쇄 작업을 대화상자 없이 PDF 파일로 쓴다.
//! 무엇을 찍을지는 프론트엔드의 인쇄 전용 화면(#print-root, @media print)이 정한다.
//! 페이지는 A4로 나뉘고(WebKit 인쇄 엔진), 글자는 살아 있다(벡터). 래스터 이미지로 찍지 않는다.

use std::path::Path;

/// WKWebView 인쇄 작업을 `path`에 PDF로 쓴다. 메인 스레드에서 불러야 한다(commands::pdf_render가 맞춘다).
#[cfg(target_os = "macos")]
pub fn print_to_file(webview: *mut std::ffi::c_void, path: &Path) -> Result<(), String> {
    use objc2::runtime::{AnyObject, ProtocolObject};
    use objc2_app_kit::{NSPrintInfo, NSPrintJobSavingURL, NSPrintSaveJob};
    use objc2_foundation::{NSCopying, NSSize, NSString, NSURL};
    use objc2_web_kit::WKWebView;

    if webview.is_null() {
        return Err("미리보기를 만들 화면이 없어요".into());
    }
    // SAFETY: wry가 준 WKWebView 포인터다. 메인 스레드에서 이 호출이 끝날 때까지만 쓴다.
    let wk: &WKWebView = unsafe { &*webview.cast::<WKWebView>() };

    let info = NSPrintInfo::new();
    // A4 세로. 종이 여백은 globals.css의 @page가 정한다(여기서는 0)
    info.setPaperSize(NSSize::new(595.28, 841.89));
    info.setTopMargin(0.0);
    info.setBottomMargin(0.0);
    info.setLeftMargin(0.0);
    info.setRightMargin(0.0);
    // 인쇄가 아니라 파일 저장 작업으로 — 프린터를 고르지 않는다
    info.setJobDisposition(unsafe { NSPrintSaveJob });
    let url = NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()));
    unsafe {
        let dict = info.dictionary();
        let url_obj: &AnyObject = &url;
        let key: &ProtocolObject<dyn NSCopying> = ProtocolObject::from_ref(NSPrintJobSavingURL);
        dict.setObject_forKey(url_obj, key);
    }

    let op = unsafe { wk.printOperationWithPrintInfo(&info) };
    // 인쇄 창·진행 창을 띄우지 않는다
    op.setShowsPrintPanel(false);
    op.setShowsProgressPanel(false);
    if !op.runOperation() {
        return Err("PDF를 만들지 못했어요".into());
    }
    match std::fs::metadata(path) {
        Ok(m) if m.len() > 0 => Ok(()),
        _ => Err("PDF 파일이 만들어지지 않았어요".into()),
    }
}

#[cfg(not(target_os = "macos"))]
pub fn print_to_file(_webview: *mut std::ffi::c_void, _path: &Path) -> Result<(), String> {
    Err("PDF 내보내기는 macOS 앱에서만 지원해요".into())
}
