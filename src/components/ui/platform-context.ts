import { createContext, useContext } from "react";
import type { Platform } from "@/lib/platform-labels";

/**
 * 운영체제 값 (SYS-08). 앱 루트가 실제 값을 내려보내고, 컴포넌트는 값만 읽는다.
 * 기본값은 macOS라 Storybook·Debug 샘플이 그대로 ⌘ 표기로 보인다.
 */
export const PlatformContext = createContext<Platform>("mac");

/** 현재 운영체제 표기를 쓰는 컴포넌트가 읽는다 (UI-Kbd · 메뉴 단축키) */
export function usePlatform(): Platform {
  return useContext(PlatformContext);
}
