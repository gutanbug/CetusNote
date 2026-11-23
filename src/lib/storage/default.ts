import { createMemoryStorage } from "./memory";
import { createTauriStorage } from "./tauri";
import type { Storage } from "./types";

/** Tauri 창 안인지 (브라우저 미리보기·Storybook이면 false) */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let instance: Storage | undefined;

/**
 * 앱 전체가 함께 쓰는 저장소. Tauri 창이면 Rust 커맨드, 아니면(브라우저 미리보기) 메모리.
 * 메모리 저장소는 새로 고치면 사라진다 — 미리보기에서 화면을 확인하는 용도다.
 */
export function getStorage(): Storage {
  instance ??= isTauri() ? createTauriStorage() : createMemoryStorage({ info: null });
  return instance;
}
