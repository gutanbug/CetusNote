import { msg } from "@/lib/i18n";
// 파일 첨부 블록의 종류와 크기 상한 (EDIT-31~33, ADR-025).
// 화면 컴포넌트(ED-FileAttachment · ED-PdfViewer · ED-MediaPlayer)는 이 값으로 크기 초과 상태를 그린다.
// 저장 시점 검사(Rust `asset_pick_file`)도 같은 값을 쓴다 — 단위는 바이트.

export const FILE_MAX_BYTES = 25 * 1024 * 1024;
export const MEDIA_MAX_BYTES = 200 * 1024 * 1024;

/** 노드 속성 `kind` 값 (ADR-025 §2) */
export type AttachmentKind = "file" | "pdf" | "video" | "audio";

const VIDEO_EXT = new Set(["mp4", "m4v", "mov", "webm", "mkv", "avi"]);
const AUDIO_EXT = new Set(["mp3", "m4a", "wav", "ogg", "oga", "flac", "aac", "opus"]);

/** 파일 이름의 확장자(소문자, 점 없음). 점이 없거나 맨 앞에만 있으면 "" */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

/** MIME 형식을 먼저 보고, 없으면 확장자로 종류를 정한다 */
export function attachmentKind(name: string, mime?: string | null): AttachmentKind {
  const type = (mime ?? "").toLowerCase();
  const ext = extensionOf(name);
  if (type === "application/pdf" || (!type && ext === "pdf")) return "pdf";
  if (type.startsWith("video/") || (!type && VIDEO_EXT.has(ext))) return "video";
  if (type.startsWith("audio/") || (!type && AUDIO_EXT.has(ext))) return "audio";
  return "file";
}

/** 종류별 크기 상한(바이트). 영상·소리는 따로 크다 */
export function limitFor(kind: AttachmentKind): number {
  return kind === "video" || kind === "audio" ? MEDIA_MAX_BYTES : FILE_MAX_BYTES;
}

/** 상한을 넘는지. 크기를 모르면(undefined) 넘지 않은 것으로 본다 */
export function isOversize(kind: AttachmentKind, size?: number | null): boolean {
  return size != null && size > limitFor(kind);
}

/** 크기 초과 안내 문구 (사용자 결정 2026-11-24) */
export function oversizeMessage(kind: AttachmentKind): string {
  return kind === "video" || kind === "audio"
    ? msg().features.attachments.tooLargeMedia
    : msg().features.attachments.tooLarge;
}
