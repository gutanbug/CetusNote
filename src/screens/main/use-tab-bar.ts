import { useSession } from "@/features/session";
import { hasOverlayTitleBar } from "@/lib/platform";
import { useMainUi } from "./ui-store";

/** 탭 바가 보이나 — 탭이 둘 이상이고 집중 모드가 아닐 때 (브라우저 방식: 하나면 숨긴다) */
export function useTabBarVisible() {
  const count = useSession((s) => s.tabs.length);
  const focusMode = useMainUi((s) => s.focusMode);
  return count > 1 && !focusMode;
}

/**
 * 상단 바의 오버레이 타이틀바 역할 (SYS-05). 탭 바가 보이면 탭 바가 맨 위라 그쪽이 맡는다.
 * 사이드바가 숨으면 신호등 자리를 비운다(inset).
 */
export function useTopBarTitleBar(): "drag" | "inset" | undefined {
  const tabs = useTabBarVisible();
  const collapsed = useSession((s) => s.sidebarCollapsed);
  const focusMode = useMainUi((s) => s.focusMode);
  if (!hasOverlayTitleBar() || tabs) return undefined;
  return collapsed || focusMode ? "inset" : "drag";
}
