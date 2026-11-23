import { create } from "zustand";

/**
 * 다른 앱에서 가져오기(DATA-11) 앱 고르기 대화상자의 열림 상태. 메인 화면에 하나만 둔다.
 * returnFocus는 연 곳(메뉴·버튼 등)이다. 닫으면 거기로 포커스를 돌려보낸다(프로그램으로 연 대화상자는 Radix가 되돌리지 못한다).
 */
export const useImportAppPicker = create<{ open: boolean; returnFocus: HTMLElement | null }>(
  () => ({ open: false, returnFocus: null }),
);

export function openImportAppPicker() {
  const active = typeof document === "undefined" ? null : document.activeElement;
  useImportAppPicker.setState({
    open: true,
    returnFocus: active instanceof HTMLElement ? active : null,
  });
}

export function closeImportAppPicker() {
  useImportAppPicker.setState({ open: false });
}
