import { workspaceStore } from "@/features/workspace";
import { StorageError, type Storage } from "@/lib/storage";
import { getStorage } from "@/lib/storage/default";
import * as React from "react";

/**
 * 이미지(EDIT-14 본문, PAGE-03 커버) — 저장 경로(`assets/<id>/…`)와 화면에 그릴 blob URL 사이.
 * 같은 경로는 한 번만 읽는다. 워크스페이스가 바뀌면 캐시를 비우고 URL을 돌려준다.
 */

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

const cache = new Map<string, Promise<string>>();
const urls = new Set<string>();
let cacheFor: string | undefined;

function syncWorkspace() {
  const path = workspaceStore.getState().workspace?.path;
  if (path === cacheFor) return;
  cacheFor = path;
  cache.clear();
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls.clear();
}

/** 저장 경로 → blob URL (실패하면 거절, 다음에 다시 읽는다) */
export function assetUrl(path: string, storage: Storage = getStorage()): Promise<string> {
  syncWorkspace();
  let hit = cache.get(path);
  if (!hit) {
    hit = storage.readAsset(path).then((bytes) => {
      const type = MIME[path.split(".").pop()?.toLowerCase() ?? ""] ?? "";
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
      urls.add(url);
      return url;
    });
    hit.catch(() => cache.delete(path));
    cache.set(path, hit);
  }
  return hit;
}

/** 경로의 blob URL. 읽는 중이거나 실패·경로 없음이면 undefined */
export function useAssetUrl(path: string | null | undefined): string | undefined {
  const [loaded, setLoaded] = React.useState<{ path: string; url: string }>();
  React.useEffect(() => {
    if (!path) return;
    let alive = true;
    assetUrl(path).then(
      (url) => alive && setLoaded({ path, url }),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [path]);
  return path && loaded?.path === path ? loaded.url : undefined;
}

/** 이미지 저장 실패 안내 (토스트 문구) */
export function assetErrorMessage(e: unknown): string {
  if (e instanceof StorageError) {
    if (e.code === "unsupported_image") return "PNG·JPEG·GIF·WebP·AVIF 이미지만 넣을 수 있어요.";
    if (e.code === "too_large") return "25MB보다 큰 이미지는 넣을 수 없어요.";
    if (e.code === "fetch_failed")
      return "링크에서 이미지를 가져오지 못했어요. 주소를 확인해 주세요.";
  }
  return "이미지를 저장하지 못했어요.";
}

/** 붙여넣거나 끌어 놓은 이미지 파일을 그 페이지의 assets에 저장 → 경로 */
export async function saveImageFile(
  pageId: string,
  file: Blob,
  storage: Storage = getStorage(),
): Promise<string> {
  return storage.writeAsset(pageId, new Uint8Array(await file.arrayBuffer()));
}

/** 이미지 링크를 내려받아 그 페이지의 assets에 저장 → 경로 (PAGE-10) */
export function fetchImage(
  pageId: string,
  url: string,
  storage: Storage = getStorage(),
  options?: { publicOnly?: boolean },
): Promise<string> {
  return storage.fetchAsset(pageId, url, options);
}

/** 이미지 선택 대화상자 → 그 페이지의 assets에 저장 → 경로. 취소하면 null */
export function pickImage(pageId: string, storage: Storage = getStorage()): Promise<string | null> {
  return storage.pickAsset(pageId);
}
