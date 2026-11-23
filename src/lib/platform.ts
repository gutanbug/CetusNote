import { isTauri } from "@/lib/storage/default";
import { currentPlatform } from "./platform-labels";

/**
 * macOS 데스크톱 앱인가 — 창이 오버레이 타이틀바(SYS-05)라 왼쪽 위에 신호등 버튼이 겹친다.
 * 브라우저 미리보기·Storybook·Windows·Linux에서는 false. Windows·Linux는 기본 창 틀을 쓴다.
 */
export function hasOverlayTitleBar(): boolean {
  if (!isTauri()) return false;
  return currentPlatform() === "mac";
}
