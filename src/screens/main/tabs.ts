import { pagesStore } from "@/features/pages";
import { sessionStore, type Tab } from "@/features/session";
import { openPage } from "./actions";
import { resolveMention } from "./mention-model";
import {
  addBackgroundTab,
  closeTab,
  cycleTab,
  navigateTo,
  openNewTab,
  pruneTabs,
  startTabs,
  tabOfView,
  type Tabs,
} from "./tab-model";
import { useMainUi } from "./ui-store";

/**
 * 페이지 탭 동작 (SHELL-11). 화면에 보이는 것(useMainUi.view + session.activeId)이 늘 "지금 탭"이고,
 * 이동하면 installTabSync가 지금 탭을 고쳐 적는다. 탭을 바꾸면 그 탭의 내용을 화면에 연다(applyTab).
 * 이미 열린 페이지로 가면 새로 만들지 않고 그 탭을 활성화한다(tab-model navigateTo·openNewTab).
 */

const read = (): Tabs => {
  const s = sessionStore.getState();
  return { tabs: s.tabs, active: s.activeTab };
};
const write = ({ tabs, active }: Tabs) => sessionStore.getState().setTabs(tabs, active);
const alive = (id: string) => resolveMention(pagesStore.getState().pages, id) !== null;

/** 탭의 내용을 화면에 연다. 열 수 없는 페이지면 홈 */
function applyTab(tab: Tab | undefined) {
  const ui = useMainUi.getState();
  if (!tab || tab.kind === "home") ui.setView({ kind: "home" });
  else if (tab.kind === "tag") ui.setView({ kind: "tag", tag: tab.tag });
  else if (alive(tab.id)) openPage(tab.id);
  else ui.setView({ kind: "home" });
}

/** 같은 화면을 다시 적지 않게 지금 탭을 고르는 동안은 동기화를 멈춘다 */
let ready = false;
/** 탭을 쓰고 그 내용을 여는 동안(activate) 화면→탭 동기화를 멈춘다. 옛 activeId가 새 탭을 덮어쓰지 않게 */
let muted = false;

/** 탭을 고쳐 적고 그 탭의 내용을 화면에 연다 */
function activate(state: Tabs) {
  muted = true;
  try {
    write(state);
    applyTab(state.tabs[state.active]);
  } finally {
    muted = false;
  }
}

/** 워크스페이스를 연 뒤 한 번: 저장된 탭을 펴고 시작 화면(SET-02)을 따른다 */
export function initTabs() {
  const s = sessionStore.getState();
  const state = startTabs(read(), s.startScreen, s.activeId);
  activate(state);
  ready = true;
}

export function selectTab(index: number) {
  const { tabs } = read();
  if (index < 0 || index >= tabs.length) return;
  activate({ tabs, active: index });
}

/** ⌘T — 홈을 연 새 탭. 페이지를 주면 그 페이지(⌘클릭 · "새 탭에서 열기"). 이미 열린 페이지면 그 탭으로 간다 */
export function newTab(tab: Tab = { kind: "home" }) {
  activate(openNewTab(read(), tab));
}

export const openInNewTab = (pageId: string) => newTab({ kind: "page", id: pageId });

/** 지금 탭은 그대로 두고 바로 오른쪽에 페이지 탭을 연다 (COLL-07 ⌘클릭). 이미 열려 있으면 그대로 */
export function openInBackgroundTab(pageId: string) {
  write(addBackgroundTab(read(), { kind: "page", id: pageId }));
}

/** ⌘클릭(⌃클릭)이면 새 탭, 아니면 지금 탭에서 연다 */
export function openPageFrom(pageId: string, e?: { metaKey: boolean; ctrlKey: boolean } | null) {
  if (e && (e.metaKey || e.ctrlKey)) openInNewTab(pageId);
  else openPage(pageId);
}

/** 탭 닫기 (× · ⌘W · Delete). 없으면 지금 탭. 마지막 페이지 탭을 닫으면 홈이 남는다 */
export function closeTabAt(index = read().active) {
  const before = read();
  const state = closeTab(before, index);
  if (index === before.active) activate(state);
  else write(state);
  // 페이지 탭을 닫아 홈만 남으면(탭 바가 사라진다) 포커스를 홈 제목으로 옮긴다 — 닫힌 탭이 포커스를 가지고 있었다
  if (
    before.tabs[index]?.kind === "page" &&
    state.tabs.length === 1 &&
    state.tabs[0]?.kind === "home"
  ) {
    requestAnimationFrame(() => document.getElementById("home-title")?.focus());
  }
}

/** ⌃Tab / ⌃⇧Tab */
export const stepTab = (step: 1 | -1) => selectTab(cycleTab(read(), step));

/** ⌘1~8은 그 번호, ⌘9는 마지막 탭 */
export const selectTabByNumber = (n: number) => selectTab(n === 9 ? read().tabs.length - 1 : n - 1);

/**
 * 화면 → 지금 탭 동기화, 지워진 페이지 탭 정리. MainScreen이 한 번 건다. 등록을 풀 함수를 돌려준다.
 * 워크스페이스가 바뀌면 멈췄다가 initTabs가 다시 켠다.
 */
export function installTabSync(): () => void {
  let prev = {
    view: useMainUi.getState().view,
    activeId: sessionStore.getState().activeId,
    workspace: sessionStore.getState().workspace,
  };
  const onChange = () => {
    const view = useMainUi.getState().view;
    const { activeId, workspace } = sessionStore.getState();
    if (workspace !== prev.workspace) ready = false;
    else if (ready && !muted && (view !== prev.view || activeId !== prev.activeId)) {
      const tab = tabOfView(view, activeId);
      if (tab) {
        const cur = read();
        const next = navigateTo(cur, tab);
        if (next.tabs !== cur.tabs || next.active !== cur.active) write(next);
      }
    }
    prev = { view, activeId, workspace };
  };
  const offUi = useMainUi.subscribe(onChange);
  const offSession = sessionStore.subscribe(onChange);
  const offPages = pagesStore.subscribe((s, old) => {
    if (!ready || s.pages === old.pages) return;
    const next = pruneTabs(read(), alive);
    if (next.tabs !== read().tabs) write(next);
  });
  return () => {
    offUi();
    offSession();
    offPages();
    ready = false;
  };
}
