import { create } from "zustand";

/**
 * 태그 메뉴가 열린 자리 — 뷰포트 좌표. returnTo는 닫힐 때 포커스를 돌려줄 요소.
 * scope는 returnTo가 있던 대화상자(설정) — 이름을 바꾼 뒤 같은 대화상자 안의 행을 찾는 데 쓴다.
 */
export type TagMenuAnchor = {
  tag: string;
  x: number;
  y: number;
  returnTo: HTMLElement | null;
  scope: Element | null;
};
export type TagDialogKind = "rename" | "merge" | "delete";
export type TagDialogState = { kind: TagDialogKind; tag: string } | null;

/** 태그 메뉴와 태그 대화상자의 열림 상태 (사이드바·태그 보기·설정이 함께 쓴다). 저장하지 않는다 */
export const useTagUi = create<{
  menu: TagMenuAnchor | null;
  /** 메뉴가 열려 있는가. 닫아도 anchor는 남겨 닫히는 동안과 포커스 복귀에 쓴다 */
  menuOpen: boolean;
  dialog: TagDialogState;
  /** 방금 이름을 바꾼 태그의 새 이름 (포커스를 그 행으로 돌릴 때 쓴다) */
  renamedTo: string | null;
  openMenu(tag: string, x: number, y: number, returnTo?: HTMLElement | null): void;
  closeMenu(): void;
  openDialog(kind: TagDialogKind, tag: string): void;
  closeDialog(): void;
}>((set) => ({
  menu: null,
  menuOpen: false,
  dialog: null,
  renamedTo: null,
  openMenu: (tag, x, y, returnTo = null) =>
    set({
      menu: { tag, x, y, returnTo, scope: returnTo?.closest('[role="dialog"]') ?? null },
      menuOpen: true,
    }),
  closeMenu: () => set({ menuOpen: false }),
  openDialog: (kind, tag) => set({ dialog: { kind, tag }, renamedTo: null }),
  closeDialog: () => set({ dialog: null }),
}));

/**
 * 태그 이름으로 행(data-tag-anchor)을 찾는다 — 이름이 바뀌면 행은 새 이름으로 다시 그려져
 * 예전 요소는 떨어진다. 가려진 행(aria-hidden · inert)은 건너뛰고, 열린 대화상자가 같으면 그 안의 행을 고른다.
 */
export function findTagAnchor(name: string, scope: Element | null): HTMLElement | null {
  const rows = [...document.querySelectorAll<HTMLElement>("[data-tag-anchor]")].filter(
    (el) => el.dataset.tagAnchor === name && !el.closest('[aria-hidden="true"], [inert]'),
  );
  return rows.find((el) => el.closest('[role="dialog"]') === scope) ?? rows[0] ?? null;
}

/**
 * 태그 행을 화면 순서대로 보고 이름의 앞·뒤 이웃을 고른다 (삭제 뒤 포커스용, SHELL-18).
 * scope는 행을 연 대화상자(설정)이고 없으면 문서 전체. 대화상자가 열리면 뒤쪽 행은 inert라 거르지 않는다(그러면 사이드바 이웃을 못 찾는다).
 * 같은 이름이 여러 번 나와도 한 번만 센다.
 */
export function tagNeighbours(
  name: string,
  scope: Element | null,
): { next: string | null; prev: string | null } {
  const names: string[] = [];
  for (const el of (scope ?? document).querySelectorAll<HTMLElement>("[data-tag-anchor]")) {
    const n = el.dataset.tagAnchor ?? "";
    if (n && !names.includes(n)) names.push(n);
  }
  const i = names.indexOf(name);
  if (i < 0) return { next: null, prev: null };
  return { next: names[i + 1] ?? null, prev: names[i - 1] ?? null };
}

/** 요소 아래 왼쪽에 메뉴를 연다 (··· 버튼·목록 행) */
export function openTagMenuAt(tag: string, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  useTagUi.getState().openMenu(tag, r.left, r.bottom + 4, el);
}

/** 마우스 우클릭 · 키보드 메뉴 키(ContextMenu, Shift+F10)면 열고 true. 아니면 false */
export function openTagMenuFromKey(
  tag: string,
  e: { key: string; shiftKey: boolean; preventDefault(): void; currentTarget: HTMLElement },
): boolean {
  if (e.key !== "ContextMenu" && !(e.key === "F10" && e.shiftKey)) return false;
  e.preventDefault();
  openTagMenuAt(tag, e.currentTarget);
  return true;
}
