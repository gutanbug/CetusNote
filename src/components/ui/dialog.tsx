import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";
import { IconButton } from "./icon-button";

/** OV-Dialog — scrim + 가운데 모달 (--r-xl, --shadow-modal). 크기 sm·md·lg·xl */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 z-50 bg-scrim data-[state=open]:animate-fade", className)}
      {...props}
    />
  );
}

const dialogVariants = cva(
  "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(var(--fit-h)-var(--s16))] w-[calc(var(--fit-w)-var(--s8))] -translate-1/2 gap-4 overflow-auto rounded-xl bg-elevated p-6 text-primary shadow-modal outline-none data-[state=open]:animate-rise",
  {
    variants: {
      size: { sm: "max-w-100", md: "max-w-140", lg: "max-w-180", xl: "max-w-240" },
    },
    defaultVariants: { size: "md" },
  },
);

/**
 * scrollable: 본문을 안쪽 스크롤 영역으로 감싼다. 뿌리 요소는 스크롤하지 않으므로 × 가 길어진 본문과 함께 올라가지 않는다.
 * 기본(false)은 뿌리가 스크롤하는 예전 배치다 — 긴 본문이면 × 가 같이 밀리니, 길어질 수 있는 대화상자는 켠다.
 * 뿌리가 자식 배치(grid 열·행)를 직접 정하는 대화상자(설정·버전 기록 등)는 자기 className으로 배치하고 끈 채 둔다.
 */
function DialogContent({
  className,
  size,
  children,
  showClose = true,
  closeLabel = "닫기",
  scrollable = false,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof dialogVariants> & {
    showClose?: boolean;
    closeLabel?: string;
    scrollable?: boolean;
  }) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        data-slot="dialog-content"
        className={cn(
          dialogVariants({ size }),
          scrollable && "grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden p-0",
          className,
        )}
        // 스크롤 영역(tabIndex 0)이 첫 포커스를 받으면 영역 전체에 링이 뜬다. 열 때는 안의 첫 요소(없으면 ×)로 보낸다
        onOpenAutoFocus={(e) => {
          onOpenAutoFocus?.(e);
          if (!scrollable || e.defaultPrevented) return;
          e.preventDefault();
          const target =
            contentRef.current?.querySelector<HTMLElement>(
              '[data-slot="dialog-body"] :is(a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]))',
            ) ??
            contentRef.current?.querySelector<HTMLElement>(`button[aria-label="${closeLabel}"]`);
          target?.focus();
        }}
        {...props}
      >
        {scrollable ? (
          <div
            data-slot="dialog-body"
            tabIndex={0}
            className="grid min-h-0 content-start gap-4 overflow-y-auto p-6"
          >
            {children}
          </div>
        ) : (
          children
        )}
        {showClose ? (
          <DialogPrimitive.Close asChild>
            <IconButton label={closeLabel} noTooltip className="absolute top-4 right-4">
              <X strokeWidth={1.5} />
            </IconButton>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("grid gap-1 pr-8", className)} {...props} />;
}

/**
 * 제목과 동작이 한 줄인 머리글(제목 · 「새 템플릿」 등). 오른쪽 × 자리를 늘 비워 둔다.
 * 기본 여백은 px-6 py-4이고 오른쪽은 pr-14(56px)다 — p-6 안의 DialogHeader(pr-8)와 × 기준 거리가 같다.
 * 칸이 p-0인 대화상자에서도 쓰므로 여백은 className으로 덮어쓸 수 있다.
 */
function DialogHeaderRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header-row"
      className={cn("flex items-center gap-2 px-6 py-4 pr-14", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex justify-end gap-2 pt-2", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-h3 font-semibold text-primary", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-ui text-secondary", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeaderRow,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
};
