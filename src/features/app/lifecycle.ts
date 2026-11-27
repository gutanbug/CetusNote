import { msg } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { metaStore } from "@/features/meta";
import { remindersStore } from "@/features/reminders";
import { onKeptExternal, pagesStore } from "@/features/pages";
import { sessionStore } from "@/features/session";
import { workspaceStore } from "@/features/workspace";
import { runAutoBackup } from "@/features/backup";
import { getStorage, isTauri } from "@/lib/storage/default";
import {
  confirmQuit,
  destroyCurrentWindow,
  onQuitRequested,
  onWindowCloseRequested,
} from "@/lib/storage/window";
import { useEffect } from "react";
import { createLaunchGate, openWorkspaceForLaunch } from "./open-order";
import { AUTO_BACKUP_DELAY_MS, scheduleAutoBackup } from "./auto-backup";

/**
 * 워크스페이스가 열리면 그 폴더를 읽는다 (SYS-09: 한 번에 한 단계씩).
 * 페이지 목록(검색 인덱스·트리의 출발점)·화면 상태·workspace.json을 순서대로 읽어 권한 요청이 겹치지 않게 한다.
 */
/** 읽기 준비가 끝난 워크스페이스. 자동 백업·바깥 변경 확인은 이 뒤에만 폴더를 읽는다 (페이지 읽기가 실패하면 준비 완료가 아니다) */
export const launchGate = createLaunchGate();
let loadSeq = 0;

export function useLoadWorkspaceOnOpen() {
  useEffect(() => {
    let loadedFor: string | null = null;
    const load = (path: string | undefined) => {
      if (!path || path === loadedFor) return;
      loadedFor = path;
      launchGate.reset();
      const seq = ++loadSeq;
      void openWorkspaceForLaunch(
        path,
        [
          () => pagesStore.getState().load(),
          (p) => sessionStore.getState().load(p),
          () => metaStore.getState().load(),
          () => remindersStore.getState().load(),
        ],
        launchGate,
        // 기다리는 사이 다른 워크스페이스로 바뀌었으면 준비 완료로 표시하지 않는다
        () => seq === loadSeq,
      );
    };
    load(workspaceStore.getState().workspace?.path);
    return workspaceStore.subscribe((s) => load(s.workspace?.path));
  }, []);
}

/**
 * 자동 백업 (DATA-05): 워크스페이스마다 화면 설정을 읽은 뒤 켜져 있으면 하루 한 번.
 * 조용히 만들고, 실패하면 한 번만 알린다(노트 저장에는 영향 없음)
 */
export function useAutoBackupOnOpen() {
  useEffect(() => {
    let doneFor: string | null = null;
    let cancel: (() => void) | undefined;
    const check = () => {
      const s = sessionStore.getState();
      const path = workspaceStore.getState().workspace?.path;
      if (!s.loaded || !path || s.workspace !== path || doneFor === path || !s.autoBackup) return;
      if (!launchGate.isReady(path)) return;
      doneFor = path;
      // 첫 화면을 그리는 일과 겹치지 않게 조금 뒤에. 기다리는 사이 워크스페이스가 바뀌면 백업하지 않는다 (DATA-05)
      cancel = scheduleAutoBackup({
        delay: AUTO_BACKUP_DELAY_MS,
        isCurrent: () => workspaceStore.getState().workspace?.path === path,
        backup: () => runAutoBackup(getStorage()),
        onFailed: () => toast.error(msg().features.app.autoBackupFailed),
      });
    };
    check();
    const a = sessionStore.subscribe(check);
    const b = workspaceStore.subscribe(check);
    const c = launchGate.onReady(check);
    return () => {
      a();
      b();
      c();
      cancel?.();
    };
  }, []);
}

/**
 * 바깥 변경을 버전 기록에 남기고 앱 쪽 내용을 지켰을 때 알린다 (DATA-07).
 * 「버전 기록 보기」는 호출한 쪽이 넘긴 함수로 그 페이지의 기록을 연다.
 */
export function useKeptExternalNotice(openHistory: (pageId: string) => void) {
  useEffect(
    () =>
      onKeptExternal((pageId) => {
        toast(msg().features.app.externalChangesKept, {
          action: { label: msg().features.app.viewHistory, onClick: () => openHistory(pageId) },
        });
      }),
    [openHistory],
  );
}

/** 바깥 변경을 확인하는 간격 (DATA-07) */
const SCAN_MS = 30_000;

/**
 * 외부 변경 감지 (DATA-07): 다른 앱·동기화 도구가 워크스페이스 파일을 바꾸면 다시 읽는다.
 * 창이 다시 앞으로 올 때와, 보이는 동안 30초마다 확인한다. 이 앱에서 아직 저장하지 않은 페이지는 덮지 않고 알린다.
 */
export function useExternalChanges() {
  useEffect(() => {
    let busy = false;
    const scan = async () => {
      if (busy || document.visibilityState !== "visible") return;
      const path = workspaceStore.getState().workspace?.path;
      if (!path || !launchGate.isReady(path)) return;
      busy = true;
      try {
        await checkExternalChanges();
      } catch {
        // 다음 확인 때 다시 본다
      } finally {
        busy = false;
      }
    };
    const onFocus = () => void scan();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = setInterval(() => void scan(), SCAN_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(timer);
    };
  }, []);
}

/** 한 번 확인하고 반영한다. 반영한 내용을 돌려준다(테스트용) */
export async function checkExternalChanges(storage = getStorage()) {
  const base = pagesStore.getState().pages;
  const changes = await storage.scanChanges();
  const read = changes.changed.length
    ? await storage.readPages(changes.changed)
    : { pages: [], errors: [] };
  const result = pagesStore.getState().applyExternal({
    pages: read.pages,
    removed: changes.removed,
    base,
  });
  if (changes.meta) await metaStore.getState().reloadExternal();
  if (result.conflicts.length) toast.error(msg().features.app.externalPagesChanged);
  if (read.errors.length) toast.error(msg().features.app.externalReadErrors(read.errors.length));
  return { ...result, meta: changes.meta, errors: read.errors };
}

export type QuitFlowDeps = {
  /** 남은 저장을 모두 쓴다. 하나라도 실패하면 false */
  saveAll: () => Promise<boolean>;
  /** Rust에 종료를 확인한다 (confirm_quit) */
  confirmQuit: () => Promise<void>;
  notify: (message: string, action?: { label: string; onClick: () => void }) => void;
};

/**
 * 종료 요청 한 번의 흐름 (DATA-07). 저장이 끝나면 종료를 확인하고, 실패하면 종료하지 않고 「그래도 종료」를 준다.
 * 저장 함수가 예외를 던져도 저장 실패로 본다. 확인 호출이 실패하면 알린다(권한 누락 시 조용히 남던 문제).
 * 돌려주는 값은 종료를 확인했는지 여부
 */
export async function runQuitFlow({
  saveAll,
  confirmQuit,
  notify,
}: QuitFlowDeps): Promise<boolean> {
  const quit = () => confirmQuit().catch(() => notify(msg().features.app.quitFailed));
  const saved = await saveAll().catch(() => false);
  if (saved) {
    await quit();
    return true;
  }
  notify(msg().features.app.quitBlockedUnsaved, {
    label: msg().features.app.quitAnyway,
    onClick: () => void quit(),
  });
  return false;
}

/**
 * 창을 닫기 전에 남은 저장을 끝낸다 (DATA-01).
 * 저장에 실패하면 닫지 않고 알리며, 「그래도 닫기」로 닫을 수 있다.
 */
export function useSaveOnClose() {
  useEffect(() => {
    // 저장이 실패했으면 창에 다시 들어올 때 한 번 더 쓴다 (DATA-02)
    const onFocus = () => {
      if (pagesStore.getState().saveState === "error") void pagesStore.getState().retry();
    };
    window.addEventListener("focus", onFocus);
    // 브라우저 미리보기: 새로 고침·탭 닫기 전에 남은 저장이 있으면 묻는다
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pagesStore.getState().saveState !== "saved") e.preventDefault();
    };
    if (!isTauri()) {
      window.addEventListener("beforeunload", onBeforeUnload);
      return () => {
        window.removeEventListener("beforeunload", onBeforeUnload);
        window.removeEventListener("focus", onFocus);
      };
    }
    /** 남은 저장을 모두 쓴다. 하나라도 실패하면 false */
    const saveAll = async (): Promise<boolean> => {
      const [ok, , , remindersOk] = await Promise.all([
        pagesStore.getState().flushAll(),
        sessionStore.getState().flush(),
        metaStore.getState().flush(),
        remindersStore
          .getState()
          .flush()
          .then(() => !remindersStore.getState().saveError)
          .catch(() => false),
      ]);
      return ok && remindersOk;
    };
    let disposed = false;
    const unlistens: Array<() => void> = [];
    const keep = (p: Promise<() => void>) =>
      void p.then((fn) => (disposed ? fn() : unlistens.push(fn)));
    keep(
      onWindowCloseRequested(async (preventClose) => {
        // 닫기 이벤트 안에서 먼저 막아야 한다. 저장을 기다린 뒤에 막으면 이미 닫히는 중이다 (DATA-02)
        preventClose();
        if (await saveAll()) {
          await destroyCurrentWindow();
          return;
        }
        // 저장하지 못했으면 창을 열어 두고, 사용자가 고를 수 있게 한다
        toast.error(msg().features.app.closeBlockedUnsaved, {
          action: {
            label: msg().features.app.closeAnyway,
            onClick: () => void destroyCurrentWindow(),
          },
        });
      }),
    );
    // Cmd+Q 등 종료 요청: Rust가 종료를 막고 알려 준다. 저장이 끝나면 종료를 확인하고, 실패하면 남긴다
    keep(
      onQuitRequested(() =>
        runQuitFlow({
          saveAll,
          confirmQuit,
          notify: (message, action) => toast.error(message, action ? { action } : undefined),
        }),
      ),
    );
    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
      unlistens.forEach((fn) => fn());
    };
  }, []);
}
