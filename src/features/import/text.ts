/**
 * 문서 가져오기(DATA-08)의 글 변환 — 형식마다 HTML 조각을 만든다. 이 파일은 DOM 없이 돈다.
 * 만든 HTML은 markdown-import의 htmlToDoc이 정리하고 에디터 문서로 바꾼다.
 */

/** HTML 특수문자 이스케이프 (글을 그대로 HTML 조각에 넣을 때) */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 일반 텍스트(.txt) → 문단: 빈 줄은 문단 나눔, 문단 안 줄바꿈은 살린다. 기호는 글자 그대로 둔다 */
export function plainTextToHtml(raw: string): string {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  return text
    .split(/\n\s*\n/)
    .map((para) =>
      para
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length)
    .map((lines) => `<p>${lines.map(escapeHtml).join("<br>")}</p>`)
    .join("");
}

/**
 * PDF 쪽들의 글 → 문단. PDF는 쪽 나눔과 줄바꿈이 글의 흐름을 끊으므로, 빈 줄만 문단을 나누고
 * 문단 안 줄바꿈은 공백으로 이어 붙인다(줄 끝 하이픈은 이어 붙여 `exam-\nple` → `example`).
 */
export function pdfPagesToHtml(pages: string[]): string {
  const text = pages.map((p) => p.replace(/\r\n?/g, "\n")).join("\n\n");
  return text
    .split(/\n\s*\n/)
    .map((para) =>
      para
        .replace(/(\p{L})-\n\s*(\p{Ll})/gu, "$1$2")
        .replace(/\s*\n\s*/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para)}</p>`)
    .join("");
}

/** `data:image/png;base64,…` → 바이트. 형식이 아니면 빈 배열 */
export function dataUrlBytes(url: string): Uint8Array {
  const comma = url.indexOf(",");
  if (!url.startsWith("data:") || comma < 0) return new Uint8Array();
  const binary = atob(url.slice(comma + 1));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
