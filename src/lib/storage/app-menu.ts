import { listen } from "@tauri-apps/api/event";
import { isTauri } from "./default";

export type AppMenuItem =
  | "new-tab"
  | "close-tab"
  | "zoom-in"
  | "zoom-out"
  | "zoom-reset"
  | "find"
  | "find-replace"
  | "outline"
  | "import-document"
  | "export-workspace-markdown";
const ITEMS: readonly string[] = [
  "new-tab",
  "close-tab",
  "zoom-in",
  "zoom-out",
  "zoom-reset",
  "find",
  "find-replace",
  "outline",
  "import-document",
  "export-workspace-markdown",
];

/**
 * macOS 앱 메뉴 항목(src-tauri/src/menu.rs)을 받는다. 메뉴 단축키(⌘T ⌘W ⌘= ⌘- ⌘0)는 웹뷰 keydown보다 먼저 받으므로
 * 앱에서는 이 이벤트로 처리한다. 브라우저 미리보기에서는 아무 일도 하지 않는다. 등록을 풀 함수를 돌려준다.
 */
export async function onAppMenu(handler: (item: AppMenuItem) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  return listen<string>("app-menu", (e) => {
    if (ITEMS.includes(e.payload)) handler(e.payload as AppMenuItem);
  });
}
