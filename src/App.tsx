import { applyAppearance } from "@/lib/appearance";
import { pinShellScroll } from "@/lib/shell-scroll";
import { motionTokens } from "@/lib/motion";
import { useStore } from "zustand";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Toaster } from "@/components/ui/toast";
import {
  useAutoBackupOnOpen,
  useExternalChanges,
  useKeptExternalNotice,
  useLoadWorkspaceOnOpen,
  useSaveOnClose,
} from "@/features/app/lifecycle";
import { sessionStore } from "@/features/session";
import { useAutoUpdateChecks } from "@/features/updater";
import { useWorkspace, workspaceStore } from "@/features/workspace";
import { MainScreen } from "@/screens/main/main-screen";
import { useMainUi } from "@/screens/main/ui-store";
import { useReminderAlerts } from "@/screens/main/reminder-alerts";
import { ReminderAlertsDialog } from "@/screens/main/reminder-dialog";
import { UnsavedSwitchDialog } from "@/screens/main/unsaved-switch-dialog";
import { SetupScreen } from "@/screens/setup/setup-screen";
import { lazy, Suspense, useEffect, useState } from "react";

// Debug 화면은 개발 빌드에만 있다. DEV가 false면 import 자체가 번들에서 빠진다 (debug-screen.md §3).
const DebugScreen = import.meta.env.DEV ? lazy(() => import("./debug/debug-screen")) : null;

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

/** ⌘⇧D (Windows·Linux는 Ctrl+Shift+D)로 Debug 화면을 여닫는다. 개발 빌드 전용 */
function useDebugShortcut() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        window.location.hash = window.location.hash.startsWith("#/debug") ? "" : "#/debug";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** 외관 설정을 문서에 적용한다 (SET-03). Debug 화면은 자기 툴바로 따로 칠한다 */
function useAppearance(debug: boolean) {
  const appearance = useStore(sessionStore, (s) => s.appearance);
  const loaded = useStore(sessionStore, (s) => s.loaded);
  useEffect(() => {
    if (loaded && !debug) applyAppearance(appearance);
  }, [appearance, loaded, debug]);
}

/** 창 고정 셸의 스크롤 가드 (SYS-05) — 문서가 프로그램 스크롤로 밀리지 않게 */
function usePinnedShell() {
  useEffect(() => pinShellScroll(), []);
}

/** 시작할 때 워크스페이스를 연다(지난 폴더) — 없으면 첫 실행 화면(DATA-03) */
function useWorkspaceInit() {
  useEffect(() => {
    void workspaceStore.getState().init();
  }, []);
}

/** 「버전 기록 보기」: 그 페이지의 버전 기록 대화상자를 연다 (DATA-07, DATA-09) */
const openVersionHistory = (pageId: string) => useMainUi.getState().setHistoryPageId(pageId);

export default function App() {
  const hash = useHash();
  useDebugShortcut();
  usePinnedShell();
  useWorkspaceInit();
  useLoadWorkspaceOnOpen();
  useSaveOnClose();
  useAutoBackupOnOpen();
  useAutoUpdateChecks();
  useExternalChanges();
  useKeptExternalNotice(openVersionHistory);
  useReminderAlerts();
  useAppearance(!!DebugScreen && hash.startsWith("#/debug"));
  const phase = useWorkspace((s) => s.phase);
  const reduced = useReducedMotion();

  if (DebugScreen && hash.startsWith("#/debug")) {
    return (
      <Suspense fallback={null}>
        <DebugScreen />
      </Suspense>
    );
  }

  // 확인하는 동안은 빈 배경만 — 첫 실행 화면이 잠깐 번쩍이지 않게
  if (phase === "loading") return <div className="h-(--fit-h) bg-app" />;
  const t = motionTokens();
  // 폴더를 고르면 첫 실행 화면이 살짝 작아지며 사라지고 앱이 나타난다(동작 줄이기면 바로 바뀜)
  return (
    <>
      <Toaster />
      <UnsavedSwitchDialog />
      <ReminderAlertsDialog />
      <AnimatePresence mode="wait" initial={false}>
        {phase === "setup" ? (
          <motion.div
            key="setup"
            exit={reduced ? undefined : { opacity: 0, scale: 0.98 }}
            transition={{ duration: t.slow, ease: t.ease }}
          >
            <SetupScreen />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: t.slow, ease: t.ease }}
          >
            <MainScreen />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
