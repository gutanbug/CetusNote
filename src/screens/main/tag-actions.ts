import { toast } from "@/components/ui/toast";
import { metaStore } from "@/features/meta";
import { pagesStore } from "@/features/pages";
import {
  planTagChange,
  undoTagChange,
  type TagOp,
  type TagPagePatch,
  type TagUndo,
} from "@/features/tags/manage";
import { msg } from "@/lib/i18n";
import { sessionStore, type Tab } from "@/features/session";
import { useMainUi, type MainView } from "./ui-store";
import { findTagAnchor, tagNeighbours, useTagUi } from "./tag-ui";

/**
 * 태그 관리 실행 (SHELL-18). 순수 계산은 features/tags/manage.ts, 여기서는 두 저장소에 적용하고
 * 열린 탭·화면을 맞추고 실행 취소 토스트를 띄운다. 사이드바·태그 보기·설정이 모두 여기를 부른다.
 */

type Snapshot = { tabs: Tab[]; activeTab: number; view: MainView };

const SUCCESS_TOAST_MS = 6000;

/** 실행 뒤 토스트 문구 — 부르는 순간의 언어 */
function messageFor(op: TagOp): string {
  const a = msg().screens.tags.actions;
  switch (op.kind) {
    case "rename":
      return a.renamed(op.from, op.to.trim());
    case "merge":
      return a.merged(op.from, op.into);
    case "recolor":
      return a.recolored(op.name);
    case "delete":
      return a.deleted(op.name);
  }
}

/** 바뀐 뒤 탭을 맞춘다: 이름이 바뀐 태그 탭은 새 이름으로, 지운 태그 탭은 홈으로 */
function remapTabs(tabs: Tab[], op: TagOp): Tab[] {
  return tabs.map((t) => {
    if (t.kind !== "tag") return t;
    if (op.kind === "rename" || op.kind === "merge") {
      const to = op.kind === "rename" ? op.to.trim() : op.into;
      return t.tag === op.from ? { kind: "tag", tag: to } : t;
    }
    if (op.kind === "delete") return t.tag === op.name ? { kind: "home" } : t;
    return t;
  });
}

/** 바뀐 뒤 화면을 맞춘다: 보던 태그가 바뀌면 새 이름으로, 지워졌으면 홈 */
function remapView(view: MainView, op: TagOp): MainView {
  if (view.kind !== "tag") return view;
  if (op.kind === "rename" || op.kind === "merge") {
    const from = op.from;
    const to = op.kind === "rename" ? op.to.trim() : op.into;
    return view.tag === from ? { kind: "tag", tag: to } : view;
  }
  if (op.kind === "delete") return view.tag === op.name ? { kind: "home" } : view;
  return view;
}

function snapshotNow(): Snapshot {
  const s = sessionStore.getState();
  return { tabs: s.tabs, activeTab: s.activeTab, view: useMainUi.getState().view };
}

/** 페이지 값을 쓴다. 실행 취소는 지금 값의 태그·컬렉션·수정 시각만 되돌린다(그 사이의 다른 편집은 살린다) */
function writePages(patches: Record<string, TagPagePatch>) {
  pagesStore.getState().patchMany(patches);
}

function undoPatches(undo: TagUndo): Record<string, TagPagePatch> {
  const { pages } = pagesStore.getState();
  const out: Record<string, TagPagePatch> = {};
  for (const [id, prev] of Object.entries(undo.pages)) {
    const cur = pages[id];
    if (!cur) continue;
    out[id] = {
      props: { ...cur.props, tags: prev.props.tags },
      collection: prev.collection,
      updatedAt: prev.updatedAt,
    };
  }
  return out;
}

function applyOp(
  op: TagOp,
  now: string,
): { ok: true; undo: TagUndo; merged: boolean } | { ok: false; reason: string } {
  const pages = pagesStore.getState().pages;
  const colors = metaStore.getState().meta?.tags ?? {};
  const r = planTagChange(pages, colors, op, now);
  if (!r.ok) return { ok: false, reason: r.reason };
  writePages(r.plan.pages);
  metaStore.getState().replaceTagColors(r.plan.colors);
  return { ok: true, undo: r.plan.undo, merged: r.plan.merged };
}

/**
 * 삭제 뒤 포커스 (SHELL-18): 다음 행 → 이전 행 → 설정의 태그 제목. 대화상자가 닫히며 배경(inert)이 풀릴 때까지
 * 몇 번 기다렸다가, 아무도 포커스를 쥐지 않았을 때만 옮긴다(Radix 복귀 포커스와 겹치지 않게).
 */
function focusAfterDelete(n: { next: string | null; prev: string | null }) {
  let tries = 0;
  const tick = () => {
    const el =
      (n.next && findTagAnchor(n.next, null)) ||
      (n.prev && findTagAnchor(n.prev, null)) ||
      document.getElementById("settings-tags-title");
    const a = document.activeElement;
    if (el && (!a || a === document.body)) el.focus();
    if (el && document.activeElement === el) return;
    if (++tries < 30) setTimeout(tick, 16);
  };
  setTimeout(tick, 0);
}

/** 실패 사유 → 토스트 문구 (빈 문자열이면 토스트를 띄우지 않는다) */
function failText(reason: string): string {
  const a = msg().screens.tags.actions;
  const table: Record<string, string> = {
    empty: a.failEmpty,
    same: "",
    missing: a.failMissing,
    self: a.failSelf,
  };
  return table[reason] ?? a.failGeneric;
}

/**
 * 태그 한 번을 바꾼다. 성공하면 true. 이름이 그대로면 아무것도 하지 않고 true.
 * 실행 취소 토스트를 띄운다(6초).
 */
export function runTagOp(op: TagOp): boolean {
  const before = snapshotNow();
  const now = new Date().toISOString();
  // 지우기 전에 이웃 행을 잡아 둔다 (삭제 뒤에는 그 행이 사라진다)
  const afterDelete =
    op.kind === "delete" ? tagNeighbours(op.name, useTagUi.getState().menu?.scope ?? null) : null;
  const res = applyOp(op, now);
  if (!res.ok) {
    if (res.reason === "same") return true;
    toast.error(failText(res.reason));
    return false;
  }

  // 포커스를 돌릴 행의 이름을 남긴다: 이름을 바꾼 행(행은 새 이름으로 다시 그려진다), 합친 대상 행(원래 행은 사라진다)
  const focusTag = op.kind === "rename" ? op.to.trim() : op.kind === "merge" ? op.into : null;
  useTagUi.setState({ renamedTo: focusTag });
  if (afterDelete) focusAfterDelete(afterDelete);

  // 탭·화면을 새 이름에 맞춘다
  const tabs = remapTabs(before.tabs, op);
  sessionStore.getState().setTabs(tabs, before.activeTab);
  const nextView = remapView(before.view, op);
  if (nextView !== before.view) useMainUi.getState().setView(nextView);

  const message =
    res.merged && op.kind === "rename"
      ? msg().screens.tags.actions.merged(op.from, op.to.trim())
      : messageFor(op);

  toast(message, {
    duration: SUCCESS_TOAST_MS,
    action: {
      label: msg().screens.tags.actions.undo,
      onClick: () => undoTagOp(res.undo, before, nextView),
    },
  });
  return true;
}

function undoTagOp(undo: TagUndo, before: Snapshot, after: MainView) {
  const colors = metaStore.getState().meta?.tags ?? {};
  const back = undoTagChange(colors, undo);
  writePages(undoPatches(undo));
  metaStore.getState().replaceTagColors(back.colors);
  sessionStore.getState().setTabs(before.tabs, before.activeTab);
  // 보고 있던 화면이 바로 그 바뀐 화면일 때만 되돌린다
  const cur = useMainUi.getState().view;
  if (
    cur.kind === after.kind &&
    (cur.kind !== "tag" || (after.kind === "tag" && cur.tag === after.tag))
  ) {
    useMainUi.getState().setView(before.view);
  }
}
