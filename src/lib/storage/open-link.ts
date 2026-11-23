import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { isTauri } from "./default";

/** 본문 링크를 기본 브라우저로 연다. http(s)·mailto만 (다른 스킴은 무시) */
export async function openLink(href: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return;
  }
  if (!["http:", "https:", "mailto:"].includes(url.protocol)) return;
  if (isTauri()) {
    await openUrl(url.href);
  } else {
    window.open(url.href, "_blank", "noopener,noreferrer");
  }
}

/** 워크스페이스 폴더를 Finder(탐색기)에서 보여 준다. 브라우저 미리보기에서는 할 수 없다 */
export const canReveal = () => isTauri();
export async function revealInFinder(path: string): Promise<void> {
  if (isTauri()) await revealItemInDir(path);
}
