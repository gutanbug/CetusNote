import { cn } from "@/lib/utils";
import type * as React from "react";
import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner";

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
      // 기본 폭(356px)에 갇히면 긴 문구가 두 줄이 된다 — 틀은 넓게 두고 토스트는 글 길이만큼(가운데)
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
          actionButton: cn(
            "ml-1 shrink-0 rounded-pill px-2 py-1 font-medium text-inverse-accent hover:bg-inverse-fg/8 force-hover:bg-inverse-fg/8",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverse-accent focus-visible:outline-solid",
          ),
        },
      }}
      {...props}
    />
  );
}

/** 토스트 호출. 실행 취소가 있으면 { action: { label: "실행 취소", onClick } } */
const toast = sonnerToast;

export { toast, Toaster };
