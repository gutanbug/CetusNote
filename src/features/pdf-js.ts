import { msg } from "@/lib/i18n";
import type { PdfText } from "@/lib/storage/types";

/**
 * pdf.js 글자 조각(TextItem)을 쪽 글로 잇는다. hasEOL이면 줄을 바꾼다(SYS-08, DATA-08 Windows·Linux).
 * 빈 줄은 한 줄로 줄이고 앞뒤 공백은 뗀다.
 */
export function pageTextFromItems(items: ReadonlyArray<{ str: string; hasEOL?: boolean }>): string {
  let out = "";
  for (const item of items) {
    out += item.str;
    if (item.hasEOL) out += "\n";
  }
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== ""))
    .join("\n")
    .trim();
}

/** pdf.js 워커는 앱 번들의 파일로 싣는다(CSP script-src 'self') */
async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

/** PDF 바이트에서 제목과 쪽마다 글자를 뽑는다. Windows·Linux에서 PDFKit 대신 쓴다 (DATA-08) */
export async function readPdfTextWithPdfJs(bytes: Uint8Array): Promise<PdfText> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: bytes });
  try {
    const doc = await task.promise;
    const meta = await doc.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as { Title?: unknown };
    const title = typeof info.Title === "string" && info.Title.trim() ? info.Title.trim() : null;
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items = content.items.flatMap((item) =>
        "str" in item ? [{ str: item.str, hasEOL: item.hasEOL }] : [],
      );
      pages.push(pageTextFromItems(items));
    }
    return { title, pages };
  } finally {
    await task.destroy();
  }
}

/**
 * PDF 쪽을 PNG 바이트로 그린다(미리보기 전용, SYS-08). 폭은 픽셀이다. 저장본과 무관하다.
 * macOS는 PDFKit으로 그리고(pdf_preview_page), Windows·Linux는 이 함수로 그린다.
 */
export async function renderPdfPreviewPngs(
  bytes: ArrayBuffer,
  width: number,
): Promise<ArrayBuffer[]> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  const out: ArrayBuffer[] = [];
  try {
    const doc = await task.promise;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(msg().features.pdf.noCanvas);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error(msg().features.pdf.pngFailed);
      out.push(await blob.arrayBuffer());
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return out;
}
