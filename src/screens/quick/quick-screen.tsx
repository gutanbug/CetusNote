import { useEffect, useRef, type KeyboardEvent } from "react";
import { useMessages } from "@/lib/i18n";
import { hideCurrentWindow } from "@/lib/storage/window";

/**
 * 빠른 입력 창(QN-03)의 임시 화면. 입력 한 줄과 Esc로 숨기기만 있다.
 * TODO: 빠른 메모 저장(Enter), 페이지 검색 결과, 시간 표현 알림 칩은 quick UI 작업에서 붙인다.
 */
export function QuickScreen() {
  const m = useMessages();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 창이 다시 보일 때마다 입력칸에 포커스를 준다 (창은 숨겼다 다시 띄우므로 마운트는 한 번이다)
    const focusInput = () => inputRef.current?.focus();
    focusInput();
    window.addEventListener("focus", focusInput);
    return () => window.removeEventListener("focus", focusInput);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      void hideCurrentWindow();
    }
  };

  return (
    <div className="flex h-screen w-screen items-center bg-app px-4">
      <input
        ref={inputRef}
        type="text"
        aria-label={m.screens.quickInput.label}
        placeholder={m.screens.quickInput.placeholder}
        onKeyDown={onKeyDown}
        className="w-full bg-transparent text-base text-primary placeholder:text-secondary"
      />
    </div>
  );
}
