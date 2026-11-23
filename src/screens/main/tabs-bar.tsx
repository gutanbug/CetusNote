import { PageTabs, type PageTabItem } from "@/components/shell/page-tabs";
import { displayTitle } from "@/features/pages/title";
import { usePages } from "@/features/pages";
import { useSession, type Tab } from "@/features/session";
import { hasOverlayTitleBar } from "@/lib/platform";
import { closeTabAt, newTab, selectTab } from "./tabs";
import { useTabBarVisible } from "./use-tab-bar";

/** 열린 탭 (SHELL-11) — 탭마다 지금 제목·아이콘을 읽는다 */
export function TabsBar() {
  const visible = useTabBarVisible();
  const tabs = useSession((s) => s.tabs);
  const active = useSession((s) => s.activeTab);
  const collapsed = useSession((s) => s.sidebarCollapsed);
  // 탭 이름은 구조(제목·종류)만 쓴다 (SYS-10)
  const pages = usePages((s) => s.structure);
  if (!visible) return null;

  const item = (t: Tab, i: number): PageTabItem => {
    const key = `${i}:${t.kind === "page" ? t.id : t.kind === "tag" ? t.tag : "home"}`;
    if (t.kind === "home") return { key, kind: "home", title: "홈" };
    if (t.kind === "tag") return { key, kind: "tag", title: `#${t.tag}` };
    const p = pages[t.id];
    return { key, kind: "page", title: p ? displayTitle(p) : "제목 없음", emoji: p?.icon };
  };

  return (
    <PageTabs
      items={tabs.map(item)}
      activeIndex={active}
      onSelect={selectTab}
      onClose={closeTabAt}
      onAdd={() => newTab()}
      titleBar={hasOverlayTitleBar() ? (collapsed ? "inset" : "drag") : undefined}
    />
  );
}
