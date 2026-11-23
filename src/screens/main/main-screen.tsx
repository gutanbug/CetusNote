import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { pagesStore, usePages } from "@/features/pages";
import { sessionStore, useSession } from "@/features/session";
import { hasOverlayTitleBar } from "@/lib/platform";
import { SkyMark } from "@/screens/main/sky-mark";
import { FilePlus } from "lucide-react";
import { isTemplate } from "@/features/templates";
import * as React from "react";
import { openDailyNote, createIn, createNearActive, duplicatePage, openQuickNote } from "./actions";
import { CommandPalette } from "./command-palette";
import { HomeView } from "./home-view";
import { PageView } from "./page-view";
import type { Side } from "./split-model";
import { TagView } from "./tag-view";
import { SettingsDialog } from "./settings-dialog";
import { useMainUi } from "./ui-store";
import { visibleIds } from "./palette-model";
import { SidebarPanel } from "./sidebar-panel";
import { TabsBar } from "./tabs-bar";
import { closeTabAt, initTabs, installTabSync, newTab, selectTabByNumber, stepTab } from "./tabs";
import { CollectionView } from "./collection-view";
import { PdfExportDialog } from "./pdf-export-dialog";
import { PrintView } from "./print-view";
import { TemplateDialog } from "./template-dialog";
import { ImportDestinationDialog } from "./import-destination-dialog";
import { TagDialogs } from "./tag-dialogs";
import { TagMenu } from "./tag-menu";
import { VersionHistoryDialog } from "./version-history-dialog";
import { onAppMenu } from "@/lib/storage/app-menu";
import { importDocuments } from "./import-document";
import { exportWorkspaceMarkdown } from "./export-workspace";
import { toast } from "@/components/ui/toast";
import { stepZoom, zoomKey } from "@/lib/zoom";
import { Resizer } from "@/components/shell/resizer";
import { resolveMention } from "./mention-model";
import { canSplit, clampPaneWidth, paneMax, PANE_MIN, PANE_STEP } from "./split-model";
import {
  activeSideNow,
  closeSplit,
  installSplitSync,
  pageIdOf,
  resetSplitWidth,
  resizeSplit,
} from "./split";

/**
 * 포커스가 있는 쪽의 열린 문서를 고른다 (SHELL-19). 주 화면은 보기가 문서일 때만 쓴다.
 * 문서가 아니면 null
 */
function focusedDoc(): { side: Side; id: string } | null {
  const side = activeSideNow();
  const id = pageIdOf(side);
  const page = id ? pagesStore.getState().pages[id] : undefined;
  if (side === "main" && useMainUi.getState().view.kind !== "page") return null;
  if (!id || page?.kind !== "page") return null;
  return { side, id };
}

/** 열린 문서가 있으면 찾기 막대를 연다. 연 경우 true (포커스가 있는 쪽에) */
function openFind(mode: "find" | "replace"): boolean {
  const doc = focusedDoc();
  if (!doc) return false;
  useMainUi.getState().openFind(mode, doc.side);
  return true;
}

/** 열린 문서가 있으면 목차를 연다/닫는다 (PAGE-12). 연 경우 true (포커스가 있는 쪽에) */
function toggleOutline(): boolean {
  const doc = focusedDoc();
  if (!doc) return false;
  const ui = useMainUi.getState();
  const open = ui.outlineOpen && ui.outlineSide === doc.side;
  ui.setOutlineOpen(!open, doc.side);
  return true;
}

/** 화면 크기 한 단계 (SHELL-17). 끝에 닿으면 그렇다고 알린다 */
function zoomBy(dir: -1 | 0 | 1) {
  const s = sessionStore.getState();
  const now = s.appearance.zoom;
  const next = stepZoom(now, dir);
  if (next !== now) s.setAppearance({ zoom: next });
  const edge = next === now && dir !== 0 ? (dir > 0 ? " · 최대 크기예요" : " · 최소 크기예요") : "";
  toast(`화면 크기 ${Math.round(next * 100)}%${edge}`, { id: "zoom", duration: 1500 });
}

/**
 * 메인 편집 화면 (Phase 6 1단계) — 사이드바 + 상단 바 + 페이지 머리 + 에디터.
 * ⌘N 새 페이지(지금 폴더 안), ⌘D 복제, ⌘\ 사이드바 접기, ⌘. 집중 모드, ⌘K 명령 팔레트,
 * ⌘T 새 탭 · ⌘W 탭 닫기 · ⌃Tab 다음 탭 · ⌘1~9 탭 고르기, ⌘⇧T 템플릿.
 * 단축키 목록은 shortcuts.ts(설정 → 단축키)에 같이 적는다.
 */
export function MainScreen() {
  const loaded = usePages((s) => s.loaded);
  const pages = usePages((s) => s.pages);
  const activeId = useSession((s) => s.activeId);
  const visible = React.useMemo(() => visibleIds(pages), [pages]);
  // 템플릿(PAGE-14)은 트리에 없지만 편집할 때는 연다
  const active = activeId ? pages[activeId] : undefined;
  const page = active && (visible.has(active.id) || isTemplate(active)) ? active : undefined;
  const focusMode = useMainUi((s) => s.focusMode);
  const contentEpoch = useMainUi((s) => s.contentEpoch);
  // 바깥에서 파일이 바뀌면(DATA-07) 에디터를 새 본문으로 다시 만든다
  const externalRev = usePages((s) => (page ? (s.externalRev[page.id] ?? 0) : 0));
  const view = useMainUi((s) => s.view);
  const sessionLoaded = useSession((s) => s.loaded);
  const workspace = useSession((s) => s.workspace);
  // 분할 화면 (SHELL-19): 오른쪽 패널의 페이지와 폭, 영역 폭
  const splitId = useSession((s) => s.splitId);
  const splitWidth = useSession((s) => s.splitWidth);
  const splitArea = useMainUi((s) => s.splitArea);
  const activeSide = useMainUi((s) => s.activeSide);
  const panePage = splitId ? pages[splitId] : undefined;
  const paneExternalRev = usePages((s) => (splitId ? (s.externalRev[splitId] ?? 0) : 0));
  const paneAlive = !!panePage && resolveMention(pages, panePage.id) !== null;
  const paneVisible = paneAlive && !focusMode && canSplit(splitArea);
  const paneW = clampPaneWidth(splitWidth, splitArea);
  const areaRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => useMainUi.getState().setSplitArea(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 패널 페이지가 사라졌으면(휴지통·영구 삭제·복원 전 저장값) 패널을 닫는다 — 워크스페이스를 연 뒤에도 본다
  React.useEffect(() => {
    if (!loaded || !sessionLoaded || !splitId) return;
    if (!resolveMention(pages, splitId)) closeSplit();
  }, [loaded, sessionLoaded, splitId, pages]);

  // 탭 (SHELL-11): 화면 → 지금 탭 동기화를 한 번 걸고, 워크스페이스를 열 때마다 저장된 탭을 편다
  // (시작 화면 SET-02도 여기서 따른다)
  React.useEffect(() => installTabSync(), []);
  // 분할 화면(SHELL-19): 주 화면과 패널이 겹치면 맞바꾸는 규칙
  React.useEffect(() => installSplitSync(), []);
  React.useEffect(() => {
    if (sessionLoaded) initTabs();
  }, [sessionLoaded, workspace]);

  // macOS 메뉴의 ⌘T · ⌘W (메뉴가 키를 먼저 받는다, src-tauri/src/menu.rs)
  React.useEffect(() => {
    let off: (() => void) | undefined;
    let gone = false;
    void onAppMenu((item) => {
      if (item === "new-tab") newTab();
      else if (item === "close-tab") closeTabAt();
      else if (item === "find" || item === "find-replace")
        openFind(item === "find" ? "find" : "replace");
      else if (item === "outline") toggleOutline();
      else if (item === "import-document") void importDocuments();
      else if (item === "export-workspace-markdown") void exportWorkspaceMarkdown();
      else zoomBy(item === "zoom-in" ? 1 : item === "zoom-out" ? -1 : 0);
    }).then((f) => {
      if (gone) f();
      else off = f;
    });
    return () => {
      gone = true;
      off?.();
    };
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌃Tab / ⌃⇧Tab: 다음 · 이전 탭
      if (e.key === "Tab" && e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        stepTab(e.shiftKey ? -1 : 1);
        return;
      }
      // ⌥⌘W 오른쪽 패널 닫기 (SHELL-19). ⌘W는 탭 닫기 그대로
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === "KeyW" && !e.shiftKey) {
        if (sessionStore.getState().splitId) {
          e.preventDefault();
          closeSplit();
        }
        return;
      }
      // ⌘F 찾기 · ⌥⌘F 바꾸기 (EDIT-25). 앱에서는 편집 메뉴가 먼저 받는다
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyF" && !e.shiftKey) {
        if (openFind(e.altKey ? "replace" : "find")) e.preventDefault();
        return;
      }
      // ⌥⌘T 오늘의 일일 노트 (PAGE-13). ⌘⇧D는 개발용 Debug 화면이 쓴다
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === "KeyT" && !e.shiftKey) {
        e.preventDefault();
        openDailyNote();
        return;
      }
      // ⌥⌘O 목차 (PAGE-12). ⌥를 누르면 e.key가 바뀌므로 자리(code)로 본다
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === "KeyO" && !e.shiftKey) {
        if (toggleOutline()) e.preventDefault();
        return;
      }
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      // ⌘+ ⌘− ⌘0 화면 크기 (앱에서는 ⌘= ⌘- ⌘0을 메뉴가 먼저 받고, ⌘⇧=만 여기로 온다)
      const zoom = zoomKey(e);
      if (zoom !== null) {
        e.preventDefault();
        zoomBy(zoom);
        return;
      }
      if (/^[1-9]$/.test(e.key) && !e.shiftKey) {
        // ⌘1~8: n번째 탭, ⌘9: 마지막 탭
        e.preventDefault();
        selectTabByNumber(Number(e.key));
        return;
      }
      if (e.key.toLowerCase() === "n") {
        // ⌘N 새 페이지 · ⌘⇧N 빠른 메모 (QN-01, 앱 안에서만 — 2026-11-19 사용자 결정)
        e.preventDefault();
        if (e.shiftKey) openQuickNote();
        else createNearActive();
      } else if (e.key.toLowerCase() === "d" && !e.shiftKey) {
        // 복제 ⌘D (PAGE-05) — 열린 문서
        const doc = focusedDoc();
        if (doc) {
          e.preventDefault();
          duplicatePage(doc.id);
        }
      } else if (e.key === ",") {
        e.preventDefault();
        useMainUi.getState().openSettings();
      } else if (e.key === "\\") {
        e.preventDefault();
        // 집중 모드에서는 먼저 집중 모드를 끈다(사이드바가 돌아온다)
        if (useMainUi.getState().focusMode) useMainUi.getState().setFocusMode(false);
        else sessionStore.getState().toggleSidebar();
      } else if (e.key.toLowerCase() === "t") {
        // ⌘T 새 탭 (SHELL-11) · ⌘⇧T 템플릿 갤러리 (PAGE-07) — 2026-11-19 사용자 결정
        e.preventDefault();
        if (e.shiftKey) useMainUi.getState().setTemplatesOpen(true);
        else newTab();
      } else if (e.key.toLowerCase() === "w" && !e.shiftKey) {
        // ⌘W 탭 닫기 — 앱에서는 메뉴가 먼저 받는다. 브라우저 미리보기에서는 브라우저가 가져갈 수 있다
        e.preventDefault();
        closeTabAt();
      } else if (e.key === "." && !e.shiftKey) {
        // 집중 모드 ⌘. (SHELL-10)
        e.preventDefault();
        const ui = useMainUi.getState();
        ui.setFocusMode(!ui.focusMode);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div data-slot="main-screen" className="flex h-(--fit-h) overflow-hidden bg-app text-primary">
      <SidebarPanel hidden={focusMode} />
      <div ref={areaRef} className="flex min-h-0 min-w-0 flex-1">
        <main
          data-side="main"
          className="flex min-w-0 flex-1 flex-col"
          onPointerDownCapture={() => useMainUi.getState().setActiveSide("main")}
          onFocusCapture={() => useMainUi.getState().setActiveSide("main")}
        >
          <TabsBar />
          <div className="min-h-0 flex-1">
            {view.kind === "home" ? (
              <HomeView />
            ) : view.kind === "tag" ? (
              <TagView tag={view.tag} />
            ) : page && page.kind === "page" ? (
              <PageView key={`${page.id}:${contentEpoch}:${externalRev}`} page={page} />
            ) : page && page.kind === "collection" ? (
              <CollectionView key={page.id} page={page} />
            ) : loaded ? (
              <NoPage />
            ) : null}
          </div>
        </main>
        {paneVisible && panePage ? (
          // 오른쪽 패널 (SHELL-19): 페이지 하나, 머리 + 편집기. 폭은 SH-Resizer로 바꾼다(왼쪽 끝 핸들)
          <section
            data-slot="split-pane"
            aria-label="오른쪽 패널"
            data-active={activeSide === "pane" || undefined}
            style={{ width: paneW }}
            className="relative flex min-w-0 shrink-0 flex-col border-l border-line bg-app"
            onPointerDownCapture={() => useMainUi.getState().setActiveSide("pane")}
            onFocusCapture={() => useMainUi.getState().setActiveSide("pane")}
          >
            <Resizer
              width={paneW}
              min={PANE_MIN}
              max={paneMax(splitArea)}
              step={PANE_STEP}
              edge="left"
              label="오른쪽 패널 너비 조절"
              onWidthChange={resizeSplit}
              onReset={resetSplitWidth}
            />
            <div className="min-h-0 flex-1">
              <PageView
                key={`pane:${panePage.id}:${contentEpoch}:${paneExternalRev}`}
                page={panePage}
                side="pane"
              />
            </div>
          </section>
        ) : null}
      </div>
      <CommandPalette />
      <SettingsDialog />
      <TemplateDialog />
      <ImportDestinationDialog />
      <VersionHistoryDialog />
      <PdfExportDialog />
      <PrintView />
      <TagMenu />
      <TagDialogs />
    </div>
  );
}

/** 열린 페이지가 없을 때 */
function NoPage() {
  const collapsed = useSession((s) => s.sidebarCollapsed);
  return (
    <section
      aria-labelledby="no-page-title"
      className="relative grid h-full place-items-center px-6 text-center"
    >
      {/* 상단 바가 없는 화면 — 맨 위 줄을 끌면 창이 움직인다 (SYS-05) */}
      {hasOverlayTitleBar() ? (
        <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-(--topbar-h)" />
      ) : null}
      <div className="grid justify-items-center gap-4">
        <SkyMark />
        <h1 id="no-page-title" className="text-h3 font-semibold text-primary">
          열린 페이지가 없어요
        </h1>
        <p className="text-ui text-secondary">
          {collapsed ? "사이드바를 열어 페이지를 고르거나" : "사이드바에서 페이지를 고르거나"} 새로
          만들어 보세요.
        </p>
        <Button onClick={() => createIn(null)}>
          <FilePlus strokeWidth={1.5} aria-hidden />새 페이지
          <Kbd keys={["⌘", "N"]} className="ml-1" />
        </Button>
        {collapsed ? (
          <Button variant="ghost" size="sm" onClick={() => sessionStore.getState().toggleSidebar()}>
            사이드바 열기
          </Button>
        ) : null}
      </div>
    </section>
  );
}
