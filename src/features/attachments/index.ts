import { msg } from "@/lib/i18n";
import {
  attachmentKind,
  limitFor,
  oversizeMessage,
  type AttachmentKind,
} from "@/lib/attachments/limits";
import {
  StorageError,
  type AttachmentInfo,
  type AttachmentPickKind,
  type Storage,
} from "@/lib/storage";
import { getStorage } from "@/lib/storage/default";

/**
 * 파일 첨부(EDIT-31~33, ADR-025) — 저장 계층(lib/storage)과 에디터 사이.
 * 고르기·끌어 놓기 복사·열기·Finder 보기·다른 이름으로 저장을 맡고, 실패 안내 문구도 여기서 정한다.
 */

/** 에디터 노드 속성 모양의 첨부 정보 (components/editor/attachment의 AttachmentPick과 같다) */
export type AttachmentPick = {
  path: string;
  name: string;
  size: number;
  mime: string;
  kind: AttachmentKind;
};

/** 저장 계층의 첨부 정보를 에디터 노드 속성 모양으로 */
export function toPick(info: AttachmentInfo): AttachmentPick {
  return { path: info.path, name: info.name, size: info.size, mime: info.mime, kind: info.kind };
}

/** 첨부 실패 안내 (토스트 문구). 크기·종류는 limits의 문구를 그대로 쓴다 */
export function attachmentErrorMessage(e: unknown, kind?: AttachmentKind): string {
  if (e instanceof StorageError) {
    if (e.code === "too_large") return oversizeMessage(kind ?? "file");
    if (e.code === "wrong_kind") {
      if (kind === "pdf") return msg().features.attachments.pdfOnly;
      if (kind === "video" || kind === "audio") return msg().features.attachments.mediaOnly;
    }
    if (e.code === "not_found") return msg().features.attachments.notFound;
    if (e.code === "symlink") return msg().features.attachments.symlink;
  }
  return msg().features.attachments.failed;
}

/** 에디터의 종류 → 고르기 대화상자의 종류 */
export function pickKindOf(kind: AttachmentKind): AttachmentPickKind {
  if (kind === "pdf") return "pdf";
  if (kind === "video" || kind === "audio") return "media";
  return "file";
}

/** 파일 고르기 → 그 페이지 assets에 복사. 취소하면 null. 실패는 토스트 문구로 알리고 null */
export async function pickAttachmentFile(
  pageId: string,
  kind: AttachmentPickKind,
  storage: Storage = getStorage(),
): Promise<AttachmentInfo | null> {
  return storage.pickFile(pageId, { kind });
}

/**
 * 끌어 놓기·붙여 넣기 파일 → 그 페이지 assets. 크기 상한은 바이트를 읽기 전에 거른다.
 * 종류는 파일 이름·형식으로 정한다(저장 계층이 다시 검사한다).
 */
export async function importAttachmentFile(
  pageId: string,
  file: File,
  storage: Storage = getStorage(),
): Promise<AttachmentInfo> {
  const kind = attachmentKind(file.name, file.type);
  if (file.size > limitFor(kind)) throw new StorageError("too_large", oversizeMessage(kind));
  const bytes = new Uint8Array(await file.arrayBuffer());
  return storage.importAttachmentBytes(pageId, {
    name: file.name,
    bytes,
    mime: file.type || undefined,
  });
}

/** 웹뷰가 읽을 주소 (asset 프로토콜). 파일이 없으면 거절한다 — 누락 상태 판정에 쓴다 */
export function attachmentSrc(path: string, storage: Storage = getStorage()): Promise<string> {
  return storage.resolveAssetSrc(path);
}

/** 기본 앱으로 열기 */
export function openAttachment(path: string, storage: Storage = getStorage()): Promise<void> {
  return storage.openAsset(path);
}

/** Finder·탐색기에서 보기 */
export function revealAttachment(path: string, storage: Storage = getStorage()): Promise<void> {
  return storage.revealAsset(path);
}

/** 다른 이름으로 저장. 취소하면 null */
export function saveAttachmentAs(
  path: string,
  storage: Storage = getStorage(),
): Promise<string | null> {
  return storage.saveAssetAs(path);
}
