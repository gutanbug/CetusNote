import * as React from "react";

/**
 * 트리거 없이 여는 대화상자(⌘, · 메뉴에서 연 옮기기 · 이름 바꾸기)는 Radix가 닫을 때 포커스를 돌려주지 않는다.
 * 열 때 포커스가 있던 곳을 기억했다가, 닫힌 뒤 포커스가 사라졌으면 그곳으로 돌려준다.
 * fallback은 열 때 포커스가 있던 곳이 그사이 사라졌을 때(예: 메뉴 항목에서 연 대화상자) 돌아갈 요소다.
 * 함수로 주면 닫힌 뒤에 고른다(이름 바꾸기처럼 행이 새 이름으로 다시 그려지는 경우).
 */
type RestoreTarget = HTMLElement | null | (() => HTMLElement | null);

export function useRestoreFocus(open: boolean, fallback?: RestoreTarget) {
  const from = React.useRef<HTMLElement | null>(null);
  const fallbackRef = React.useRef<RestoreTarget>(null);
  // 레이아웃 효과로 잡는다 — Radix가 대화상자 안으로 포커스를 옮기는 효과보다 먼저 돈다
  React.useLayoutEffect(() => {
    fallbackRef.current = fallback ?? null;
  });
  React.useLayoutEffect(() => {
    if (open) {
      from.current = document.activeElement as HTMLElement | null;
      return;
    }
    const prev = from.current;
    from.current = null;
    const keep = prev?.isConnected ? prev : null;
    if (!keep && !fallbackRef.current) return;
    // rAF는 창이 뒤에 있으면 멈추므로 setTimeout으로 (Radix가 닫기 처리를 끝낸 다음 차례)
    setTimeout(() => {
      const fb = fallbackRef.current;
      const el = keep ?? (typeof fb === "function" ? fb() : fb);
      const lost = !document.activeElement || document.activeElement === document.body;
      if (lost && el?.isConnected) el.focus();
    }, 0);
  }, [open]);
}
