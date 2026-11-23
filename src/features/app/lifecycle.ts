import { toast } from "@/components/ui/toast";
import { metaStore } from "@/features/meta";
import { pagesStore } from "@/features/pages";
import { sessionStore } from "@/features/session";
import { workspaceStore } from "@/features/workspace";
import { runAutoBackup } from "@/features/backup";
import { getStorage, isTauri } from "@/lib/storage/default";
import { onWindowCloseRequested } from "@/lib/storage/window";
import { useEffect } from "react";

/** 워크스페이스가 열리면 페이지를 읽는다 (검색 인덱스·트리의 출발점) */
export function useLoadPagesOnOpen() {
  useEffect(() => {
    let loadedFor: string | null = null;
    const load = (path: string | undefined) => {
      if (!path || path === loadedFor) return;
      loadedFor = path;
      void pagesStore.getState().load();
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
    const check = () => {
      const s = sessionStore.getState();
      const path = workspaceStore.getState().workspace?.path;
      if (!s.loaded || !path || s.workspace !== path || doneFor === path || !s.autoBackup) return;
      doneFor = path;
      // 첫 화면을 그리는 일과 겹치지 않게 조금 뒤에
      setTimeout(() => {
        void runAutoBackup(getStorage()).then((r) => {
          if (r === false)
            toast.error("자동 백업을 만들지 못했어요. 설정 → 데이터에서 확인해 주세요.");
        });
      }, 3000);
    };
    check();
    const a = sessionStore.subscribe(check);
    const b = workspaceStore.subscribe(check);
    return () => {
      a();
      b();
    };
  }, []);
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
      if (!workspaceStore.getState().workspace || !pagesStore.getState().loaded) return;
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
  if (result.conflicts.length)
    toast.error("다른 곳에서 바뀐 페이지가 있지만, 여기서 고친 내용을 지키려고 반영하지 않았어요.");
  if (read.errors.length)
    toast.error(`바깥에서 바뀐 파일 ${read.errors.length}개를 읽지 못했어요.`);
  return { ...result, meta: changes.meta, errors: read.errors };
}

/**
 * 창을 닫기 전에 남은 저장을 끝낸다 (DATA-01).
 * 저장에 실패하면 한 번은 닫지 않고 알린다. 한 번 더 닫으면 그대로 닫힌다(디스크가 계속 실패해도 갇히지 않게).
 */
export function useSaveOnClose() {
  useEffect(() => {
    // 브라우저 미리보기: 새로 고침·탭 닫기 전에 남은 저장이 있으면 묻는다
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pagesStore.getState().saveState !== "saved") e.preventDefault();
    };
    if (!isTauri()) {
      window.addEventListener("beforeunload", onBeforeUnload);
      return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }
    let warned = false;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void onWindowCloseRequested(async (preventClose) => {
      const [ok] = await Promise.all([
        pagesStore.getState().flushAll(),
        sessionStore.getState().flush(),
        metaStore.getState().flush(),
      ]);
      if (ok || warned) return;
      warned = true;
      preventClose();
      toast.error("저장하지 못한 변경이 있어요. 한 번 더 닫으면 저장하지 않고 닫혀요.");
    }).then((fn) => (disposed ? fn() : (unlisten = fn)));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
