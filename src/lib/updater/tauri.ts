import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { msg } from "@/lib/i18n";
import type { UpdateInfo, Updater } from "./types";

/** check()가 찾은 업데이트. 내려받기는 이 핸들로 한다(Rust 쪽 리소스라 닫아야 한다) */
let pending: Update | null = null;

function toInfo(update: Update): UpdateInfo {
  return { version: update.version, notes: update.body ?? null, date: update.date ?? null };
}

/** Tauri 창용 구현 — tauri-plugin-updater · tauri-plugin-process */
export function createTauriUpdater(): Updater {
  return {
    currentVersion: () => getVersion(),
    async check() {
      const next = await check();
      const prev = pending;
      pending = next;
      if (prev) await prev.close().catch(() => undefined);
      return next ? toInfo(next) : null;
    },
    async downloadAndInstall(onProgress) {
      const update = pending;
      if (!update) throw new Error(msg().features.updater.noUpdate);
      let total: number | null = null;
      let received = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? null;
          onProgress(total === null ? null : 0);
        } else if (event.event === "Progress") {
          received += event.data.chunkLength;
          onProgress(total === null ? null : Math.min(100, Math.round((received / total) * 100)));
        } else {
          onProgress(100);
        }
      });
    },
    relaunch,
  };
}
