/**
 * 메뉴가 닫힐 때 포커스 돌려주기 (OV-Menu).
 * Radix는 닫힌 뒤 트리거로 포커스를 돌려준다. 그런데 항목이 새 화면을 열어 이미 다른 곳(예: 새 페이지 제목)에
 * 포커스를 줬다면 그 포커스를 빼앗지 않는다. 그냥 닫았으면(포커스가 body·메뉴 안) 원래대로 트리거로 돌아간다.
 */
export function keepMovedFocus(e: Event, user?: (e: Event) => void) {
  user?.(e);
  if (e.defaultPrevented) return;
  const active = document.activeElement;
  if (active && active !== document.body && !active.closest('[data-slot="menu-content"]'))
    e.preventDefault();
}
