import { extensionOf } from "./limits";

/** 사람이 읽는 크기: 512 B · 3.4 KB · 12 MB · 1.2 GB (10 미만은 소수 한 자리) */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded} ${units[unit]}`;
}

/**
 * 긴 이름을 가운데서 줄인다: "회의록_최종_검토의견_반영본.pdf" → "회의록_최종_검…의견_반영본.pdf".
 * 확장자(짧을 때)는 살린다. 글자는 코드 포인트 단위로 센다(한글·이모지 안전).
 */
export function middleEllipsis(name: string, max: number): string {
  const chars = Array.from(name);
  if (chars.length <= max || max < 5) return name;
  const ext = extensionOf(name);
  // 확장자는 짧고 줄일 자리가 넉넉할 때만 살린다
  let tail = ext && ext.length <= 6 ? `.${ext}` : "";
  if (max - 1 - Array.from(tail).length < 4) tail = "";
  const tailLen = Array.from(tail).length;
  const keep = max - 1 - tailLen;
  const head = Math.ceil(keep * 0.6);
  const rest = keep - head;
  return `${chars.slice(0, head).join("")}…${chars.slice(chars.length - tailLen - rest).join("")}`;
}

/** 재생 시간: 0:05 · 3:07 · 1:02:10 (음수·NaN은 0:00) */
export function formatTime(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** 카드에 쓰는 형식 표시: 확장자를 대문자로(PDF · DOCX). 없으면 "파일" */
export function formatLabel(name: string): string {
  const ext = extensionOf(name);
  return ext ? ext.toUpperCase() : "파일";
}
