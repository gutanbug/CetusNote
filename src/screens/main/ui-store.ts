import type { SettingsTab } from "@/components/page/options";
import { create } from "zustand";

/** 오른쪽에 무엇을 보이나 — 열린 문서(page) · 홈(SHELL-13) · 태그별 문서(tag) */
export type MainView =
  { kind: "page" } | { kind: "home" } | { kind: "tag"; tag: string } | { kind: "reminders" };

/** 메인 화면의 잠깐 열리는 것들(저장하지 않는다) */
export const useMainUi = create<{
  view: MainView;
  setView(view: MainView): void;
  paletteOpen: boolean;
  setPaletteOpen(open: boolean): void;
  settingsOpen: boolean;
  setSettingsOpen(open: boolean): void;
  /** 설정 창을 이 탭으로 연다 (팔레트의 "단축키 보기" 등) */
  settingsTab: SettingsTab | null;
  openSettings(tab?: SettingsTab): void;
  /** 집중 모드 (SHELL-10) — 사이드바를 숨기고 상단 바만. 앱을 다시 켜면 꺼진다 */
  /**
   * 열린 문서의 본문을 바깥에서 통째로 바꿨을 때 올린다(템플릿 적용).
   * 에디터는 처음 만들 때만 본문을 읽으므로, 이 값을 key에 넣어 다시 만든다.
   */
  contentEpoch: number;
  bumpContent(): void;
  /** 버전 기록 대화상자가 보여 줄 페이지 (DATA-09). null이면 닫힘 */
  historyPageId: string | null;
  setHistoryPageId(id: string | null): void;
  /** 템플릿 갤러리 (PAGE-07) */
  templatesOpen: boolean;
  setTemplatesOpen(open: boolean): void;
  focusMode: boolean;
  setFocusMode(on: boolean): void;
  /** 빠른 메모 팝오버 (QN-01) */
  quickNoteOpen: boolean;
  setQuickNoteOpen(open: boolean): void;
  /** 알림 대화상자 「열기」로 빠른 메모를 열 때 강조할 메모 id (SYS-16) */
  quickNoteFocusId: string | null;
  setQuickNoteFocusId(id: string | null): void;
  /** 상단 바 알림 버튼 패널 — 페이지 메뉴 「알림…」도 같은 패널을 연다 (SYS-16) */
  pageReminderOpen: boolean;
  setPageReminderOpen(open: boolean): void;
  /** 컬렉션 화면이 열리면 바로 상세로 띄울 레코드 (최근 항목에서 보드 카드를 눌렀을 때) */
  recordToOpen: string | null;
  setRecordToOpen(id: string | null): void;
  /** PDF 내보내기(DATA-06): 인쇄 전용 화면에 그릴 페이지 */
  printId: string | null;
  setPrintId(id: string | null): void;
  /** 페이지 안 찾기 막대 (EDIT-25). seq는 ⌘F를 다시 눌렀을 때 찾기 칸으로 돌아가게 */
  find: { mode: "find" | "replace"; seq: number } | null;
  openFind(mode: "find" | "replace"): void;
  closeFind(): void;
  /** 상단 바 목차 메뉴 (PAGE-12) */
  outlineOpen: boolean;
  setOutlineOpen(open: boolean): void;
}>()((set) => ({
  view: { kind: "page" },
  setView: (view) => set({ view }),
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  settingsTab: null,
  openSettings: (tab) => set({ settingsOpen: true, settingsTab: tab ?? null }),
  contentEpoch: 0,
  bumpContent: () => set((s) => ({ contentEpoch: s.contentEpoch + 1 })),
  historyPageId: null,
  setHistoryPageId: (historyPageId) => set({ historyPageId }),
  templatesOpen: false,
  setTemplatesOpen: (templatesOpen) => set({ templatesOpen }),
  focusMode: false,
  setFocusMode: (focusMode) => set({ focusMode }),
  quickNoteOpen: false,
  setQuickNoteOpen: (quickNoteOpen) => set({ quickNoteOpen }),
  quickNoteFocusId: null,
  setQuickNoteFocusId: (quickNoteFocusId) => set({ quickNoteFocusId }),
  pageReminderOpen: false,
  setPageReminderOpen: (pageReminderOpen) => set({ pageReminderOpen }),
  recordToOpen: null,
  setRecordToOpen: (recordToOpen) => set({ recordToOpen }),
  printId: null,
  setPrintId: (printId) => set({ printId }),
  find: null,
  openFind: (mode) => set((s) => ({ find: { mode, seq: (s.find?.seq ?? 0) + 1 } })),
  closeFind: () => set({ find: null }),
  outlineOpen: false,
  setOutlineOpen: (outlineOpen) => set({ outlineOpen }),
}));
