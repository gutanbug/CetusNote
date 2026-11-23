import { create } from "zustand";

/** 다른 앱에서 가져오기(DATA-11) 앱 고르기 대화상자의 열림 상태. 메인 화면에 하나만 둔다 */
export const useImportAppPicker = create<{ open: boolean }>(() => ({ open: false }));

export function openImportAppPicker() {
  useImportAppPicker.setState({ open: true });
}

export function closeImportAppPicker() {
  useImportAppPicker.setState({ open: false });
}
