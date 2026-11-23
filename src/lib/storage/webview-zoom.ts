import { getCurrentWebview } from "@tauri-apps/api/webview";
import { isTauri } from "./default";

/**
 * 앱 창의 웹뷰 배율을 바꾼다(SHELL-17). 앱이 아니면(브라우저 미리보기) false.
 * 바꾸지 못하면(권한이 빠진 빌드 등) onFail을 부른다 — 화면은 그대로인데 배율만 바뀌지 않게.
 */
export function setWebviewZoom(level: number, onFail: (error: unknown) => void): boolean {
  if (!isTauri()) return false;
  getCurrentWebview().setZoom(level).catch(onFail);
  return true;
}
