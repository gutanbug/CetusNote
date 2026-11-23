import { applyAppearance } from "@/lib/appearance";
import { motionTokens } from "@/lib/motion";
import { useStore } from "zustand";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Toaster } from "@/components/ui/toast";
import {
  useAutoBackupOnOpen,
  useExternalChanges,
  useLoadPagesOnOpen,
  useSaveOnClose,
} from "@/features/app/lifecycle";
import { metaStore } from "@/features/meta";
import { sessionStore } from "@/features/session";
import { useAutoUpdateChecks } from "@/features/updater";
import { useWorkspace, workspaceStore } from "@/features/workspace";
import { MainScreen } from "@/screens/main/main-screen";
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

/** 워크스페이스가 열리면 그 폴더의 화면 상태(열린 페이지·펼친 트리)와 workspace.json을 불러온다 */
function useSessionLoad() {
  const path = useWorkspace((s) => s.workspace?.path);
  useEffect(() => {
    if (!path) return;
    void sessionStore.getState().load(path);
    void metaStore.getState().load();
  }, [path]);
}

/** 외관 설정을 문서에 적용한다 (SET-03). Debug 화면은 자기 툴바로 따로 칠한다 */
function useAppearance(debug: boolean) {
  const appearance = useStore(sessionStore, (s) => s.appearance);
  const loaded = useStore(sessionStore, (s) => s.loaded);
  useEffect(() => {
    if (loaded && !debug) applyAppearance(appearance);
  }, [appearance, loaded, debug]);
}

/** 시작할 때 워크스페이스를 연다(지난 폴더) — 없으면 첫 실행 화면(DATA-03) */
function useWorkspaceInit() {
  useEffect(() => {
    void workspaceStore.getState().init();
  }, []);
}

export default function App() {
  const hash = useHash();
  useDebugShortcut();
  useWorkspaceInit();
  useLoadPagesOnOpen();
  useSaveOnClose();
  useAutoBackupOnOpen();
  useAutoUpdateChecks();
  useExternalChanges();
  useSessionLoad();
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
