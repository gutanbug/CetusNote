import { cn } from "@/lib/utils";
import type * as React from "react";
import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverse-accent focus-visible:outline-solid";

/** 주 버튼(실행 취소 · 업데이트 · 다시 시도) — 강조 글자 색 */
const actionButtonClass = cn(
  "ml-1 shrink-0 rounded-pill px-2 py-1 font-medium text-inverse-accent hover:bg-inverse-fg/8 force-hover:bg-inverse-fg/8",
  focusRing,
);

/** 보조 버튼(닫기) — 흐린 글자, 주 버튼보다 조용하다 */
const cancelButtonClass = cn(
  "ml-1 shrink-0 rounded-pill px-2 py-1 font-normal text-inverse-fg/70 hover:bg-inverse-fg/8 hover:text-inverse-fg force-hover:bg-inverse-fg/8 force-hover:text-inverse-fg",
  focusRing,
);

/**
 * OV-Toast — 아래 가운데 알약 모양, 반전 배경 (프로토타입 .toast).
 * 테마는 CSS 변수로 따라가므로 sonner의 theme 기능은 쓰지 않는다.
 */
function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      position="bottom-center"
      offset={24}
      gap={8}
      visibleToasts={3}
      // 기본은 겹쳐 접혀서 맨 앞 토스트만 보인다(뒤의 「실행 취소」가 가려짐). 펼쳐서 최대 3개를 다 보이게 한다
      expand
      // 스크린 리더가 알림 영역을 찾도록 한국어 이름을 기본으로 단다(호출하는 쪽이 바꿀 수 있다)
      containerAriaLabel="알림"
      // 기본 폭(356px)에 갇히면 긴 문구가 두 줄이 된다 — 틀은 넓게 두고 토스트는 글 길이만큼(가운데).
      // spacing 160 = 4px × 160 = 640px 상한. 긴 문구도 두 줄이 되지 않게 하는 폭이며,
      // 화면이 좁으면 --fit-w에서 양옆 여백(--s8)을 뺀 값으로 줄어든다. 토큰이 없어 여기서 한 번 정한다.
      style={
        {
          "--width": "min(calc(var(--spacing) * 160), calc(var(--fit-w) - var(--s8)))",
        } as React.CSSProperties
      }
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: cn(
            "flex items-center gap-3 rounded-pill bg-inverse py-2 pr-3 pl-4 text-ui text-inverse-fg shadow-modal",
            // sonner는 토스트를 absolute로 둔다 — 양옆 0 + 자동 여백으로 글 길이만큼 가운데에
            "inset-x-0 mx-auto w-fit max-w-full break-keep",
            // 모달(Radix)이 body에 pointer-events:none을 걸면 토스트도 클릭이 안 된다 — 토스트만 되살린다
            "pointer-events-auto",
          ),
          title: "font-normal text-pretty",
          description: "text-label text-inverse-fg/70",
          icon: "[&_svg]:size-4",
          error: "[&_[data-icon]]:text-inverse-danger",
          actionButton: actionButtonClass,
          cancelButton: cancelButtonClass,
        },
      }}
      {...props}
    />
  );
}

/** 토스트 호출. 실행 취소가 있으면 { action: { label: "실행 취소", onClick } } */
const toast = sonnerToast;

/**
 * 토스트 안의 「닫기」 보조 버튼. sonner의 cancel 자리에 이 요소를 넣는다.
 * dismissible: false인 토스트는 sonner의 cancel 옵션이 동작하지 않으므로(밀어서 닫기와 함께 막힌다) 직접 그린다.
 */
function ToastCancelButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={cancelButtonClass} onClick={onClick}>
      {children}
    </button>
  );
}

export { toast, Toaster, ToastCancelButton };
