import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";
import { IconButton } from "./icon-button";

/** OV-Dialog — scrim + 가운데 모달 (--r-xl, --shadow-modal). 크기 sm·md·lg */
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
      size: { sm: "max-w-100", md: "max-w-140", lg: "max-w-180" },
    },
    defaultVariants: { size: "md" },
  },
);

function DialogContent({
  className,
  size,
  children,
  showClose = true,
  closeLabel = "닫기",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof dialogVariants> & { showClose?: boolean; closeLabel?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(dialogVariants({ size }), className)}
        {...props}
      >
        {children}
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
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
};
