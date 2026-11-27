import { normalizeZoom } from "@/lib/zoom";
import { currentWorkspaceGeneration } from "@/features/workspace/generation";
import type { PageFont, RecordOpenMode, Storage } from "@/lib/storage";
import { parseAppIconPref, type AppIconPref } from "@/lib/app-icon";
import { createStore } from "zustand/vanilla";
import {
  forgetPositions,
  findPosition,
  readPositions,
  rememberPosition,
  type PagePosition,
  type PageSpot,
} from "./page-position";

/**
 * 화면 상태 — 열린 페이지, 펼친 트리, 사이드바 폭·접힘 (SHELL-01, SHELL-05).
 * 앱 설정 폴더의 settings.json에 저장한다(워크스페이스 파일이 아니다, architecture §3).
 * 열린 페이지·펼친 트리는 워크스페이스 경로마다 따로 기억한다.
 */
export type ThemePref = "light" | "dark" | "system";
export type AccentPref =
  "blue" | "indigo" | "violet" | "teal" | "green" | "amber" | "rose" | "graphite";
export type FontScale = 0.9 | 1 | 1.1;

/** 외관 설정 (SET-03). 모든 워크스페이스에 같다 */
export type Appearance = {
  theme: ThemePref;
  accent: AccentPref;
  fontScale: FontScale;
  /** 화면 크기 0.8~1.5 (SHELL-17, ⌘+ ⌘− ⌘0) */
  zoom: number;
  /** 고래자리 — 홈·페이지·빈 화면에 그린다 (concept.md §3, SET-03). 끄면 모든 화면에서 숨긴다 */
  constellation: boolean;
  /** 본문 폭 기본값 (SET-03). 폴더·페이지가 따로 정하지 않으면 이 값을 쓴다 */
  defaultWide: boolean;
  /** 앱 아이콘(SET-07): 자동은 테마를 따른다 */
  appIcon: AppIconPref;
};

/** 에디터 설정 (SET-04). 모든 워크스페이스에 같다 */
export type EditorPrefs = {
  /** 새 페이지의 본문 글꼴. 페이지마다 메뉴에서 바꿀 수 있다 */
  newPageFont: PageFont;
  /** 본문 맞춤법 검사(시스템 검사기 밑줄) */
  spellcheck: boolean;
  /** 완료한 체크 항목을 회색 + 취소선으로 */
  dimChecked: boolean;
  /** 계산 줄(EDIT-38): 줄 끝 `=`에 계산 결과를 보여 준다 */
  calc: boolean;
  /** 계산 결과를 본문 오른쪽 끝에 맞춘다 */
  calcRight: boolean;
};

export const DEFAULT_EDITOR: EditorPrefs = {
  newPageFont: "default",
  spellcheck: true,
  dimChecked: true,
  calc: true,
  calcRight: false,
};

function readEditor(raw: unknown): EditorPrefs {
  const e = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    newPageFont: e.newPageFont === "serif" || e.newPageFont === "mono" ? e.newPageFont : "default",
    spellcheck: e.spellcheck !== false,
    dimChecked: e.dimChecked !== false,
    calc: e.calc !== false,
    calcRight: e.calcRight === true,
  };
}

/** 탭 하나가 보이는 곳 (SHELL-11) — 페이지 · 홈 · 태그별 페이지 */
export type Tab = { kind: "page"; id: string } | { kind: "home" } | { kind: "tag"; tag: string };

const TAB_LIMIT = 20;

function readTabs(raw: unknown): Tab[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Tab =>
      isObj(t)
        ? (t.kind === "page" && typeof t.id === "string") ||
          t.kind === "home" ||
          (t.kind === "tag" && typeof t.tag === "string")
        : false,
    )
    .slice(0, TAB_LIMIT);
}

/** 앱을 켰을 때 처음 보이는 화면 (SET-02) */
export type StartScreen = "home" | "last";

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "system",
  accent: "blue",
  fontScale: 1,
  zoom: 1,
  constellation: true,
  defaultWide: false,
  appIcon: "auto",
};

const ACCENTS: AccentPref[] = [
  "blue",
  "indigo",
  "violet",
  "teal",
  "green",
  "amber",
  "rose",
  "graphite",
];
const RECENT_LIMIT = 10;
/** 최근 고른 페이지 아이콘 (PAGE-10) */
const RECENT_ICON_LIMIT = 24;

function readAppearance(raw: unknown): Appearance {
  const a = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    theme: a.theme === "light" || a.theme === "dark" ? a.theme : "system",
    accent: ACCENTS.includes(a.accent as AccentPref) ? (a.accent as AccentPref) : "blue",
    fontScale: a.fontScale === 0.9 || a.fontScale === 1.1 ? a.fontScale : 1,
    zoom: normalizeZoom(a.zoom),
    constellation: a.constellation !== false,
    // 예전 이름(newPageWide)의 값은 옮겨 받는다
    defaultWide: a.defaultWide === undefined ? a.newPageWide === true : a.defaultWide === true,
    appIcon: parseAppIconPref(a.appIcon),
  };
}

export type SessionState = {
  loaded: boolean;
  /** 워크스페이스 경로(기억할 때의 키) */
  workspace: string | null;
  activeId: string | null;
  expanded: string[];
  /** null이면 토큰 기본 폭(--sidebar-w) */
  sidebarWidth: number | null;
  /** 레코드 사이드 패널 폭 (COLL-07). null이면 화면의 40% */
  recordPanelWidth: number | null;
  sidebarCollapsed: boolean;
  appearance: Appearance;
  editor: EditorPrefs;
  startScreen: StartScreen;
  /** 하루 한 번 워크스페이스 .backups/에 자동 백업 (DATA-05). 기본 켬 */
  autoBackup: boolean;
  /** 앱 실행 때와 하루 한 번 새 버전이 있는지 확인 (SYS-07). 기본 켬 */
  autoUpdateCheck: boolean;
  /** 컬렉션 레코드를 여는 기본 방식 (COLL-07). 컬렉션마다 바꿀 수 있다 */
  recordOpen: RecordOpenMode;
  /** 최근에 연 문서(새 것이 앞, 최대 10개) — 워크스페이스마다 (SHELL-03) */
  recent: string[];
  /** 열린 탭과 지금 탭 — 워크스페이스마다 (SHELL-11). 비어 있으면 화면이 처음 열 때 채운다 */
  tabs: Tab[];
  activeTab: number;
  /** 최근에 고른 페이지 아이콘 값(새 것이 앞, 최대 24개) — 워크스페이스마다 (PAGE-10) */
  recentIcons: string[];
  /** 페이지마다 읽던 위치(가장 최근이 뒤, 최대 200개) — 워크스페이스마다 (PAGE-15) */
  positions: PageSpot[];
  /** 읽던 위치를 기억한다 */
  remember(id: string, pos: PagePosition): void;
  /** 영구 삭제한 페이지의 위치를 지운다 */
  forgetPositions(ids: string[]): void;
  /** 위치 한 개 읽기 */
  positionOf(id: string): PagePosition | undefined;
  /** 고른 아이콘을 최근 목록 맨 앞에 */
  pushRecentIcon(icon: string): void;
  setTabs(tabs: Tab[], activeTab: number): void;
  load(workspacePath: string): Promise<void>;
  setAppearance(patch: Partial<Appearance>): void;
  setEditor(patch: Partial<EditorPrefs>): void;
  setStartScreen(screen: StartScreen): void;
  setAutoBackup(on: boolean): void;
  setAutoUpdateCheck(on: boolean): void;
  setRecordOpen(mode: RecordOpenMode): void;
  open(id: string | null): void;
  /** 지금 보는 문서는 그대로 두고 최근 목록 맨 앞에만 올린다 (레코드 상세로 연 보드 카드) */
  touch(id: string): void;
  setExpanded(ids: string[]): void;
  /** 하나 더 펼친다(이미 펼쳤으면 그대로) */
  expand(...ids: string[]): void;
  setSidebarWidth(width: number | null): void;
  setRecordPanelWidth(width: number | null): void;
  toggleSidebar(): void;
  /** 기다리지 않고 바로 저장 */
  flush(): Promise<void>;
};

type Remembered = {
  lastPageId?: string | null;
  expanded?: string[];
  recent?: string[];
  tabs?: unknown;
  activeTab?: number;
  recentIcons?: unknown;
  positions?: unknown;
};
type Settings = Record<string, unknown> & {
  appearance?: unknown;
  editor?: unknown;
  startScreen?: unknown;
  autoBackup?: unknown;
  autoUpdateCheck?: unknown;
  recordOpen?: unknown;
  sidebarWidth?: number | null;
  recordPanelWidth?: number | null;
  sidebarCollapsed?: boolean;
  workspaces?: Record<string, Remembered>;
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

type SessionOptions = {
  delay?: number;
  /** 워크스페이스 세대 (테스트용). 없으면 앱 전체의 세대를 쓴다 */
  generation?: () => number;
};

export function createSessionStore(
  storage: Storage,
  { delay = 400, generation = currentWorkspaceGeneration }: SessionOptions = {},
) {
  /** 읽은 settings 전체 — 다른 기능의 키(테마 등)를 지우지 않게 합쳐서 쓴다 */
  let settings: Settings = {};
  let timer: ReturnType<typeof setTimeout> | undefined;

  return createStore<SessionState>()((set, get) => {
    const write = async () => {
      clearTimeout(timer);
      timer = undefined;
      const s = get();
      if (!s.loaded) return;
      const workspaces = { ...(settings.workspaces ?? {}) };
      if (s.workspace)
        workspaces[s.workspace] = {
          lastPageId: s.activeId,
          expanded: s.expanded,
          recent: s.recent,
          tabs: s.tabs,
          activeTab: s.activeTab,
          recentIcons: s.recentIcons,
          positions: s.positions,
        };
      settings = {
        ...settings,
        sidebarWidth: s.sidebarWidth,
        recordPanelWidth: s.recordPanelWidth,
        sidebarCollapsed: s.sidebarCollapsed,
        appearance: s.appearance,
        editor: s.editor,
        startScreen: s.startScreen,
        autoBackup: s.autoBackup,
        autoUpdateCheck: s.autoUpdateCheck,
        recordOpen: s.recordOpen,
        workspaces,
      };
      try {
        await storage.writeSettings(settings);
      } catch {
        // 화면 상태는 잃어도 괜찮다 — 노트 저장과 달리 알리지 않는다
      }
    };
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void write(), delay);
    };
    const change = (patch: Partial<SessionState>) => {
      set(patch);
      save();
    };

    return {
      loaded: false,
      workspace: null,
      activeId: null,
      expanded: [],
      sidebarWidth: null,
      recordPanelWidth: null,
      sidebarCollapsed: false,
      appearance: DEFAULT_APPEARANCE,
      editor: DEFAULT_EDITOR,
      startScreen: "home",
      autoBackup: true,
      autoUpdateCheck: true,
      recordOpen: "modal",
      recent: [],
      tabs: [],
      activeTab: 0,
      recentIcons: [],
      positions: [],
      async load(workspacePath) {
        const gen = generation();
        let raw: unknown;
        try {
          raw = await storage.readSettings();
        } catch {
          raw = null;
        }
        // 읽는 사이 워크스페이스가 바뀌었으면 이전 워크스페이스의 화면 상태로 덮지 않는다 (SYS-09)
        if (gen !== generation()) return;
        settings = isObj(raw) ? (raw as Settings) : {};
        const mine = isObj(settings.workspaces) ? settings.workspaces[workspacePath] : undefined;
        set({
          loaded: true,
          workspace: workspacePath,
          activeId: typeof mine?.lastPageId === "string" ? mine.lastPageId : null,
          expanded: Array.isArray(mine?.expanded)
            ? mine.expanded.filter((x): x is string => typeof x === "string")
            : [],
          sidebarWidth: typeof settings.sidebarWidth === "number" ? settings.sidebarWidth : null,
          recordPanelWidth:
            typeof settings.recordPanelWidth === "number" ? settings.recordPanelWidth : null,
          sidebarCollapsed: settings.sidebarCollapsed === true,
          appearance: readAppearance(settings.appearance),
          editor: readEditor(settings.editor),
          startScreen: settings.startScreen === "last" ? "last" : "home",
          autoBackup: settings.autoBackup !== false,
          autoUpdateCheck: settings.autoUpdateCheck !== false,
          recordOpen:
            settings.recordOpen === "side" || settings.recordOpen === "tab"
              ? settings.recordOpen
              : "modal",
          recent: Array.isArray(mine?.recent)
            ? mine.recent.filter((x): x is string => typeof x === "string").slice(0, RECENT_LIMIT)
            : [],
          positions: readPositions(mine?.positions),
          recentIcons: Array.isArray(mine?.recentIcons)
            ? mine.recentIcons
                .filter((x): x is string => typeof x === "string" && x.length > 0)
                .slice(0, RECENT_ICON_LIMIT)
            : [],
          ...(() => {
            // 예전 `split`(분할 화면, 제거됨) 값은 읽지 않는다 — 다음 저장 때 사라진다
            const tabs = readTabs(mine?.tabs);
            const at = typeof mine?.activeTab === "number" ? mine.activeTab : 0;
            return {
              tabs,
              activeTab: Math.min(Math.max(0, at), Math.max(0, tabs.length - 1)),
            };
          })(),
        });
      },
      open(id) {
        if (get().activeId === id) return;
        const recent = id
          ? [id, ...get().recent.filter((r) => r !== id)].slice(0, RECENT_LIMIT)
          : get().recent;
        change({ activeId: id, recent });
      },
      touch(id) {
        if (get().recent[0] === id) return;
        change({ recent: [id, ...get().recent.filter((r) => r !== id)].slice(0, RECENT_LIMIT) });
      },
      setAppearance(patch) {
        change({ appearance: { ...get().appearance, ...patch } });
      },
      setEditor(patch) {
        change({ editor: { ...get().editor, ...patch } });
      },
      setTabs(tabs, activeTab) {
        const list = tabs.slice(0, TAB_LIMIT);
        change({
          tabs: list,
          activeTab: Math.min(Math.max(0, activeTab), Math.max(0, list.length - 1)),
        });
      },
      remember(id, pos) {
        change({ positions: rememberPosition(get().positions, id, pos) });
      },
      forgetPositions(ids) {
        const next = forgetPositions(get().positions, ids);
        if (next.length !== get().positions.length) change({ positions: next });
      },
      positionOf(id) {
        return findPosition(get().positions, id);
      },
      pushRecentIcon(icon) {
        const cur = get().recentIcons;
        if (cur[0] === icon) return;
        change({
          recentIcons: [icon, ...cur.filter((x) => x !== icon)].slice(0, RECENT_ICON_LIMIT),
        });
      },
      setStartScreen(startScreen) {
        change({ startScreen });
      },
      setRecordOpen(recordOpen) {
        change({ recordOpen });
      },
      setAutoUpdateCheck(autoUpdateCheck) {
        change({ autoUpdateCheck });
      },
      setAutoBackup(autoBackup) {
        change({ autoBackup });
      },
      setExpanded(ids) {
        change({ expanded: ids });
      },
      expand(...ids) {
        const cur = get().expanded;
        const add = ids.filter((id) => !cur.includes(id));
        if (add.length) change({ expanded: [...cur, ...add] });
      },
      setSidebarWidth(width) {
        change({ sidebarWidth: width });
      },
      setRecordPanelWidth(width) {
        change({ recordPanelWidth: width });
      },
      toggleSidebar() {
        change({ sidebarCollapsed: !get().sidebarCollapsed });
      },
      flush: write,
    };
  });
}

export type SessionStore = ReturnType<typeof createSessionStore>;
