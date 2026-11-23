//! PDF 내보내기(DATA-06): 메인 WKWebView의 `createPDFWithConfiguration`으로 쪽(rect) 하나씩 찍고,
//! PDFKit으로 한 파일에 합친다. 글자는 살아 있다(벡터).
//!
//! 왜 인쇄 작업(NSPrintOperation)을 쓰지 않나: `runOperation`은 메인 스레드에서 끝날 때까지 돌면서
//! 쪽을 계속 만들었다. 내용이 한 문단이어도 PDF가 수백 MB가 될 때까지 멈추지 않아 앱이 얼었다(2026-11-23 재현).
//! createPDF는 완료 핸들러로 돌아오는 비동기 호출이라 메인 스레드를 막지 않는다.
//! 쪽 나누기(A4 높이 경계)는 프론트엔드가 정한다(pdf-layout.ts). 여기서는 각 쪽을 rect로 찍기만 한다.

/// 찍을 영역(웹뷰 문서 좌표, pt = CSS px)
#[derive(serde::Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PageRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// 웹뷰의 rect 한 쪽을 PDF 바이트로 만든다. 메인 스레드에서 부른다. 결과는 `done`으로 나중에 온다(막지 않는다).
#[cfg(target_os = "macos")]
pub fn capture_page(
    webview: *mut std::ffi::c_void,
    rect: PageRect,
    done: impl Fn(Result<Vec<u8>, String>) + 'static,
) -> Result<(), String> {
    use block2::RcBlock;
    use objc2::MainThreadMarker;
    use objc2_foundation::{NSData, NSError, NSPoint, NSRect, NSSize};
    use objc2_web_kit::{WKPDFConfiguration, WKWebView};

    if webview.is_null() {
        return Err("미리보기를 만들 화면이 없어요".into());
    }
    let mtm = MainThreadMarker::new().ok_or("메인 스레드가 아니에요")?;
    // SAFETY: wry가 준 WKWebView 포인터다. 메인 스레드에서 이 호출 동안만 쓴다.
    let wk: &WKWebView = unsafe { &*webview.cast::<WKWebView>() };

    let config = unsafe { WKPDFConfiguration::new(mtm) };
    let frame = NSRect::new(
        NSPoint::new(rect.x, rect.y),
        NSSize::new(rect.width, rect.height),
    );
    unsafe { config.setRect(frame) };

    let handler = RcBlock::new(move |data: *mut NSData, error: *mut NSError| {
        // SAFETY: WebKit이 완료 핸들러에 넘기는 객체는 핸들러가 도는 동안 살아 있다
        let result = match unsafe { data.as_ref() } {
            Some(data) if error.is_null() => {
                let bytes = data.to_vec();
                if bytes.is_empty() {
                    Err("빈 PDF가 만들어졌어요".to_string())
                } else {
                    Ok(bytes)
                }
            }
            _ => Err("PDF 쪽을 만들지 못했어요".to_string()),
        };
        done(result);
    });
    unsafe { wk.createPDFWithConfiguration_completionHandler(Some(&config), &handler) };
    Ok(())
}

/// 쪽 PDF 파일들을 순서대로 한 PDF로 합친다. PDFKit을 쓰므로 메인 스레드에서 부른다.
#[cfg(target_os = "macos")]
pub fn merge_pages(parts: &[std::path::PathBuf]) -> Result<Vec<u8>, String> {
    use objc2::AnyThread;
    use objc2_foundation::NSData;
    use objc2_pdf_kit::PDFDocument;

    let merged = unsafe { PDFDocument::new() };
    for (index, part) in parts.iter().enumerate() {
        let bytes = std::fs::read(part).map_err(|_| "쪽 PDF를 읽지 못했어요".to_string())?;
        let data = NSData::with_bytes(&bytes);
        let doc = unsafe { PDFDocument::initWithData(PDFDocument::alloc(), &data) }
            .ok_or("쪽 PDF를 열지 못했어요")?;
        let page = unsafe { doc.pageAtIndex(0) }.ok_or("쪽 PDF에 쪽이 없어요")?;
        unsafe { merged.insertPage_atIndex(&page, index) };
    }
    let out = unsafe { merged.dataRepresentation() }.ok_or("PDF를 합치지 못했어요")?;
    Ok(out.to_vec())
}

/// 합친 PDF의 쪽 하나를 PNG로 그린다(미리보기 전용, DATA-06). 저장본은 그대로 벡터다.
/// 폭은 `width` 픽셀이고 높이는 쪽 비율을 따른다. PDFKit을 쓰므로 메인 스레드에서 부른다.
#[cfg(target_os = "macos")]
pub fn render_page_png(path: &std::path::Path, index: usize, width: f64) -> Result<Vec<u8>, String> {
    use objc2::AnyThread;
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep};
    use objc2_foundation::{NSData, NSDictionary, NSSize};
    use objc2_pdf_kit::{PDFDisplayBox, PDFDocument};

    let bytes = std::fs::read(path).map_err(|_| "미리보기 PDF를 읽지 못했어요".to_string())?;
    let data = NSData::with_bytes(&bytes);
    let doc = unsafe { PDFDocument::initWithData(PDFDocument::alloc(), &data) }
        .ok_or("미리보기 PDF를 열지 못했어요")?;
    let page = unsafe { doc.pageAtIndex(index) }.ok_or("미리보기 쪽이 없어요")?;
    let bounds = unsafe { page.boundsForBox(PDFDisplayBox::MediaBox) };
    if bounds.size.width <= 0.0 || bounds.size.height <= 0.0 {
        return Err("쪽 크기를 알 수 없어요".into());
    }
    let height = width * bounds.size.height / bounds.size.width;
    let image = unsafe {
        page.thumbnailOfSize_forBox(NSSize::new(width, height), PDFDisplayBox::MediaBox)
    };
    let tiff = image.TIFFRepresentation().ok_or("쪽 그림을 만들지 못했어요")?;
    let rep = NSBitmapImageRep::imageRepWithData(&tiff).ok_or("쪽 그림을 읽지 못했어요")?;
    let props = NSDictionary::new();
    let png = unsafe { rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &props) }
        .ok_or("쪽 그림을 PNG로 바꾸지 못했어요")?;
    Ok(png.to_vec())
}

#[cfg(not(target_os = "macos"))]
pub fn render_page_png(_path: &std::path::Path, _index: usize, _width: f64) -> Result<Vec<u8>, String> {
    Err("PDF 내보내기는 macOS 앱에서만 지원해요".into())
}

#[cfg(not(target_os = "macos"))]
pub fn capture_page(
    _webview: *mut std::ffi::c_void,
    _rect: PageRect,
    _done: impl Fn(Result<Vec<u8>, String>) + 'static,
) -> Result<(), String> {
    Err("PDF 내보내기는 macOS 앱에서만 지원해요".into())
}

#[cfg(not(target_os = "macos"))]
pub fn merge_pages(_parts: &[std::path::PathBuf]) -> Result<Vec<u8>, String> {
    Err("PDF 내보내기는 macOS 앱에서만 지원해요".into())
}

/// 가져오기(DATA-08)용 PDF 글: 메타데이터 제목과 쪽마다 글자. 글자만 뽑는다(표·그림·서식은 잃는다)
#[derive(serde::Serialize, Debug, PartialEq)]
pub struct PdfText {
    pub title: Option<String>,
    pub pages: Vec<String>,
}

/// PDF 바이트에서 글자를 뽑는다. PDFKit을 쓰므로 macOS에서만 된다
#[cfg(target_os = "macos")]
pub fn extract_text(bytes: &[u8]) -> Result<PdfText, String> {
    use objc2::AnyThread;
    use objc2::runtime::AnyObject;
    use objc2_foundation::{NSData, NSDictionary, NSString};
    use objc2_pdf_kit::{PDFDocument, PDFDocumentTitleAttribute};

    let data = NSData::with_bytes(bytes);
    let doc = unsafe { PDFDocument::initWithData(PDFDocument::alloc(), &data) }
        .ok_or("PDF를 열지 못했어요")?;

    let attrs: Option<objc2::rc::Retained<NSDictionary>> = unsafe { doc.documentAttributes() };
    let title = attrs.and_then(|attrs| {
        let key: &AnyObject = unsafe { PDFDocumentTitleAttribute }.as_ref();
        let value = attrs.objectForKey(key)?;
        let text = value.downcast_ref::<NSString>()?.to_string();
        let text = text.trim().to_string();
        (!text.is_empty()).then_some(text)
    });

    let count = unsafe { doc.pageCount() };
    let pages = (0..count)
        .map(|i| {
            unsafe { doc.pageAtIndex(i) }
                .and_then(|page| unsafe { page.string() })
                .map(|s| s.to_string())
                .unwrap_or_default()
        })
        .collect();
    Ok(PdfText { title, pages })
}

#[cfg(not(target_os = "macos"))]
pub fn extract_text(_bytes: &[u8]) -> Result<PdfText, String> {
    Err("PDF 가져오기는 macOS 앱에서만 돼요".into())
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn extracts_text_per_page_and_title() {
        let pdf = extract_text(include_bytes!("../testdata/sample.pdf")).unwrap();
        assert_eq!(pdf.title.as_deref(), Some("Fixture Title"));
        assert_eq!(pdf.pages.len(), 2);
        assert!(pdf.pages[0].contains("Hello from page one"), "{:?}", pdf.pages);
        assert!(pdf.pages[1].contains("Second page text"), "{:?}", pdf.pages);
    }

    #[test]
    fn rejects_bytes_that_are_not_pdf() {
        assert!(extract_text(b"not a pdf").is_err());
    }
}
