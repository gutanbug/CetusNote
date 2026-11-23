import { isTauri } from "@/lib/storage/default";
import { createFakeUpdater } from "./fake";
import { createTauriUpdater } from "./tauri";
import type { Updater } from "./types";

export type { Updater, UpdateInfo } from "./types";
export { createFakeUpdater } from "./fake";

/**
 * 앱이 쓰는 업데이트 구현. Tauri 창이면 실제 업데이트, 브라우저 미리보기면 가짜.
 * 미리보기(개발 빌드)에서 `?fakeUpdate=0.2.0`을 붙이면 새 버전이 있는 것처럼 보인다.
 */
export function createUpdater(): Updater {
  if (isTauri()) return createTauriUpdater();
  const fake = import.meta.env.DEV ? new URLSearchParams(location.search).get("fakeUpdate") : null;
  return createFakeUpdater({
    current: "0.1.0",
    latest: fake ? { version: fake, notes: null, date: null } : null,
    delayMs: 400,
  });
}
