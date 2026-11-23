import { Splash } from "@/components/page/splash";
import { WorkspaceSetup } from "@/components/page/workspace-setup";
import { useWorkspace, workspaceStore } from "@/features/workspace";
import { hasOverlayTitleBar } from "@/lib/platform";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

/**
 * 첫 실행 화면 (DATA-03) — 스플래시(PG-Splash) → 노트를 저장할 폴더 고르기.
 * 스플래시는 앱을 켤 때 한 번만. 별자리는 두 화면이 이어 쓴다(layoutId).
 */
export function SetupScreen() {
  const defaultLabel = useWorkspace((s) => s.defaultLabel);
  const missingPath = useWorkspace((s) => s.missingPath);
  const busy = useWorkspace((s) => s.busy);
  const error = useWorkspace((s) => s.error);
  const { openDefault, pick } = workspaceStore.getState();
  const [splash, setSplash] = useState(true);
  const reduced = useReducedMotion();
  return (
    <main className="relative h-(--fit-h) overflow-y-auto bg-app">
      {/* 맨 위 줄을 끌면 창이 움직인다 (SYS-05, macOS 오버레이 타이틀바) */}
      {hasOverlayTitleBar() ? (
        <div data-tauri-drag-region className="absolute inset-x-0 top-0 z-10 h-(--topbar-h)" />
      ) : null}
      <LayoutGroup>
        <AnimatePresence mode="wait">
          {splash ? (
            <motion.div key="splash" className="h-full" exit={reduced ? undefined : { opacity: 0 }}>
              <Splash onDone={() => setSplash(false)} />
            </motion.div>
          ) : (
            <motion.div key="setup" className="min-h-full">
              <WorkspaceSetup
                enter
                defaultLabel={defaultLabel}
                missingPath={missingPath}
                busy={busy === "restore" ? null : busy}
                error={error}
                onUseDefault={() => void openDefault()}
                onPick={() => void pick()}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </main>
  );
}
