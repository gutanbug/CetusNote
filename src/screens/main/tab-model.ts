import type { Tab } from "@/features/session";
import type { MainView } from "./ui-store";

/**
 * 페이지 탭 계산 (SHELL-11, 브라우저 방식 — 2026-11-19 사용자 결정).
 * 지금 탭 안에서 이동하면 그 탭이 바뀌고, 새 탭은 ⌘T · ⌘클릭 · "새 탭에서 열기"로만 생긴다.
 */
export type Tabs = { tabs: Tab[]; active: number };

export const sameTab = (a: Tab, b: Tab) =>
  a.kind === b.kind &&
  (a.kind !== "page" || a.id === (b as typeof a).id) &&
  (a.kind !== "tag" || a.tag === (b as typeof a).tag);

/** 지금 화면 → 탭. 페이지 화면인데 열린 페이지가 없으면 null */
export function tabOfView(view: MainView, activeId: string | null): Tab | null {
  if (view.kind === "home") return { kind: "home" };
  if (view.kind === "tag") return { kind: "tag", tag: view.tag };
  return activeId ? { kind: "page", id: activeId } : null;
}

/** 지금 탭의 내용을 바꾼다(같으면 그대로) */
export function replaceActive({ tabs, active }: Tabs, tab: Tab): Tabs {
  if (!tabs.length) return { tabs: [tab], active: 0 };
  if (tabs[active] && sameTab(tabs[active]!, tab)) return { tabs, active };
  const next = [...tabs];
  next[active] = tab;
  return { tabs: next, active };
}

/** 지금 탭 바로 오른쪽에 새 탭을 열고 그리로 간다 */
export function addTab({ tabs, active }: Tabs, tab: Tab): Tabs {
  const at = tabs.length ? active + 1 : 0;
  return { tabs: [...tabs.slice(0, at), tab, ...tabs.slice(at)], active: at };
}

/**
 * 탭 닫기. 지금 탭을 닫으면 오른쪽(없으면 왼쪽) 탭으로 간다. 마지막 탭을 닫으면 홈 탭 하나가 남는다.
 */
export function closeTab({ tabs, active }: Tabs, index: number): Tabs {
  if (index < 0 || index >= tabs.length) return { tabs, active };
  const rest = tabs.filter((_, i) => i !== index);
  if (!rest.length) return { tabs: [{ kind: "home" }], active: 0 };
  const nextActive =
    index < active ? active - 1 : index === active ? Math.min(index, rest.length - 1) : active;
  return { tabs: rest, active: nextActive };
}

/** 열 수 없는 페이지 탭(지워짐·휴지통)을 뺀다. 지금 탭은 화면이 따로 처리하므로 남긴다 */
export function pruneTabs({ tabs, active }: Tabs, alive: (id: string) => boolean): Tabs {
  const keep = tabs.map((t, i) => i === active || t.kind !== "page" || alive(t.id));
  if (keep.every(Boolean)) return { tabs, active };
  return {
    tabs: tabs.filter((_, i) => keep[i]),
    active: keep.slice(0, active).filter(Boolean).length,
  };
}

/**
 * 앱을 켤 때: 저장된 탭을 쓴다. 시작 화면이 홈이면 — 탭이 하나뿐이면 그 탭을 홈으로 바꾸고
 * (탭을 안 쓰는 사람에게 탭 바가 생기지 않게), 여럿이면 홈 탭으로 간다(없으면 맨 끝에 하나 연다).
 */
export function startTabs(saved: Tabs, start: "home" | "last", lastPageId: string | null): Tabs {
  const state: Tabs = saved.tabs.length
    ? saved
    : { tabs: [lastPageId ? { kind: "page", id: lastPageId } : { kind: "home" }], active: 0 };
  if (start !== "home") return state;
  if (state.tabs.length === 1) return { tabs: [{ kind: "home" }], active: 0 };
  const home = state.tabs.findIndex((t) => t.kind === "home");
  return home >= 0
    ? { ...state, active: home }
    : addTab({ ...state, active: state.tabs.length - 1 }, { kind: "home" });
}

/** ⌃Tab / ⌃⇧Tab — 끝에서 처음으로 돈다 */
export const cycleTab = ({ tabs, active }: Tabs, step: 1 | -1) =>
  tabs.length ? (active + step + tabs.length) % tabs.length : 0;

/** 같은 탭이 열려 있는 위치 (없으면 -1). 페이지·태그·홈 모두 같은 것으로 본다 */
export const indexOfTab = ({ tabs }: Tabs, tab: Tab) => tabs.findIndex((t) => sameTab(t, tab));

/**
 * 이동(사이드바·팔레트·멘션·백링크·홈 카드): 이미 다른 탭에 열린 페이지면 그 탭으로 간다(중복 탭을 만들지 않는다).
 * 아니면 지금 탭의 내용을 바꾼다.
 */
export function navigateTo(state: Tabs, tab: Tab): Tabs {
  if (tab.kind === "page") {
    const j = indexOfTab(state, tab);
    if (j >= 0 && j !== state.active) return { tabs: state.tabs, active: j };
  }
  return replaceActive(state, tab);
}

/** 새 탭(⌘T · ⌘클릭 · "새 탭에서 열기"): 이미 열린 페이지면 그 탭을 활성화하고, 아니면 오른쪽에 연다 */
export function openNewTab(state: Tabs, tab: Tab): Tabs {
  const j = tab.kind === "page" ? indexOfTab(state, tab) : -1;
  if (j >= 0) return { tabs: state.tabs, active: j };
  return addTab(state, tab);
}

/** 백그라운드 탭(⌘클릭 COLL-07): 이미 열린 페이지면 아무것도 하지 않는다 */
export function addBackgroundTab(state: Tabs, tab: Tab): Tabs {
  if (indexOfTab(state, tab) >= 0) return state;
  const before = state;
  const added = addTab(state, tab);
  return { tabs: added.tabs, active: before.tabs.length ? before.active : added.active };
}
