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
import { ImportAppDialog } from "./import-app-dialog";
import { openImportAppPicker } from "./import-app-picker";
import { exportWorkspaceMarkdown } from "./export-workspace";
import { toast } from "@/components/ui/toast";
import { stepZoom, zoomKey } from "@/lib/zoom";

/** 열린 문서의 id. 보기가 문서가 아니거나 문서가 아니면 null */
function openDocId(): string | null {
  const id = sessionStore.getState().activeId;
  const page = id ? pagesStore.getState().pages[id] : undefined;
  if (useMainUi.getState().view.kind !== "page") return null;
  if (!id || page?.kind !== "page") return null;
  return id;
}

/** 열린 문서가 있으면 찾기 막대를 연다. 연 경우 true */
function openFind(mode: "find" | "replace"): boolean {
  if (!openDocId()) return false;
  useMainUi.getState().openFind(mode);
  return true;
}

/** 열린 문서가 있으면 목차를 연다/닫는다 (PAGE-12). 연 경우 true */
function toggleOutline(): boolean {
  if (!openDocId()) return false;
  const ui = useMainUi.getState();
  ui.setOutlineOpen(!ui.outlineOpen);
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
  const activeId = useSession((s) => s.activeId);
  // 구조만 보고 트리·표시 여부를 정한다. 본문 입력은 이 참조를 바꾸지 않는다 (SYS-10)
  const structure = usePages((s) => s.structure);
  const visible = React.useMemo(() => visibleIds(structure), [structure]);
  // 열린 페이지 객체는 id로 따로 구독한다 — 다른 페이지 변경에는 이 화면을 다시 그리지 않는다
  const active = usePages((s) => (activeId ? s.pages[activeId] : undefined));
  // 템플릿(PAGE-14)은 트리에 없지만 편집할 때는 연다
  const page = active && (visible.has(active.id) || isTemplate(active)) ? active : undefined;
  const focusMode = useMainUi((s) => s.focusMode);
  const contentEpoch = useMainUi((s) => s.contentEpoch);
  // 바깥에서 파일이 바뀌면(DATA-07) 에디터를 새 본문으로 다시 만든다
  const externalRev = usePages((s) => (page ? (s.externalRev[page.id] ?? 0) : 0));
  const view = useMainUi((s) => s.view);
  const sessionLoaded = useSession((s) => s.loaded);
  const workspace = useSession((s) => s.workspace);
  // 탭 (SHELL-11): 화면 → 지금 탭 동기화를 한 번 걸고, 워크스페이스를 열 때마다 저장된 탭을 편다
  // (시작 화면 SET-02도 여기서 따른다)
  React.useEffect(() => installTabSync(), []);
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
      else if (item === "import-app") openImportAppPicker();
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
        const id = openDocId();
        if (id) {
          e.preventDefault();
          duplicatePage(id);
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
    // relative: 안쪽 절대 위치 요소(장식·팝오버 자리)의 기준을 셸로 묶어 overflow-hidden이 잘라 내게 한다(SYS-05)
    <div
      data-slot="main-screen"
      data-shell
      className="relative flex h-(--fit-h) min-w-0 overflow-clip bg-app text-primary"
    >
      <SidebarPanel hidden={focusMode} />
      <div className="flex min-h-0 min-w-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
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
      </div>
      <CommandPalette />
      <SettingsDialog />
      <TemplateDialog />
      <ImportDestinationDialog />
      <ImportAppDialog />
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
