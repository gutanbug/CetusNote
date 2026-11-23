import { isTauri } from "@/lib/storage/default";

/**
 * macOS 데스크톱 앱인가 — 창이 오버레이 타이틀바(SYS-05)라 왼쪽 위에 신호등 버튼이 겹친다.
 * 브라우저 미리보기·Storybook·Windows에서는 false.
 */
export function hasOverlayTitleBar(): boolean {
  if (!isTauri() || typeof navigator === "undefined") return false;
  return /Mac/i.test(navigator.userAgent);
}
