import type { Page, Storage } from "@/lib/storage";
import type { PagesStore } from "@/features/pages";
import type { HistoryRecorder } from "./recorder";

/**
 * 버전으로 되돌리기 (DATA-09).
 * 바꾸는 것: 제목 · 아이콘 · 본문. 그대로 두는 것: id · 트리 위치 · 속성(태그·상태·담당·마감) · 커버 · 글꼴 ·
 * 휴지통 상태 — 되돌리는 목적은 글을 찾는 것이라, 정리해 둔 속성과 배치를 옛 값으로 덮지 않으려고다.
 */
export type RestoreDeps = {
  storage: Pick<Storage, "readVersion">;
  pages: PagesStore;
  history: HistoryRecorder;
  /** 편집기를 다시 그리게 한다 (contentEpoch) */
  onContentChanged(): void;
};

export type RestoreOutcome =
  | { ok: true; title: string; undo(): Promise<boolean> }
  | { ok: false; reason: "missing" | "snapshot" | "read" | "save" };

type Content = Pick<Page, "title" | "icon" | "content">;

const pick = (p: Page): Content => ({ title: p.title, icon: p.icon, content: p.content });

async function apply(deps: RestoreDeps, pageId: string, patch: Content): Promise<boolean> {
  const { pages } = deps;
  pages.getState().update(pageId, patch);
  const page = pages.getState().pages[pageId];
  // 되돌린 내용은 이미 버전으로 남아 있다 — 바로 다시 남기지 않는다
  if (page) deps.history.markSaved(page);
  deps.onContentChanged();
  return pages.getState().flushPage(pageId);
}

export async function restoreVersion(
  deps: RestoreDeps,
  pageId: string,
  versionId: string,
): Promise<RestoreOutcome> {
  // 지금 내용을 남기려면 본문이 있어야 한다. 없는 채로 남기면 빈 버전이 된다 (SYS-10)
  if (!deps.pages.getState().pages[pageId]) return { ok: false, reason: "missing" };
  if (!(await deps.pages.getState().ensureBody(pageId))) return { ok: false, reason: "read" };
  const current = deps.pages.getState().pages[pageId];
  if (!current || current.kind !== "page" || current.trashedAt)
    return { ok: false, reason: "missing" };
  // 지금 내용을 먼저 남긴다. 실패하면 되돌리지 않는다(지금 내용이 사라지지 않게)
  if (!(await deps.history.snapshot(current))) return { ok: false, reason: "snapshot" };

  let old: Page;
  try {
    old = await deps.storage.readVersion(pageId, versionId);
  } catch {
    return { ok: false, reason: "read" };
  }
  // 기다리는 사이 바뀐 내용까지 실행 취소가 되살리도록 지금 값을 다시 읽는다
  const before = pick(deps.pages.getState().pages[pageId] ?? current);
  if (!(await apply(deps, pageId, pick(old)))) return { ok: false, reason: "save" };
  return {
    ok: true,
    title: old.title,
    undo: () => apply(deps, pageId, before),
  };
}
