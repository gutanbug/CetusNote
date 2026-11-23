import { cn } from "@/lib/utils";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import type * as React from "react";

/** 앱 루트(와 스토리 데코레이터)에 한 번 둔다. 프로토타입처럼 짧게 기다린다. */
function TooltipProvider({
  delayDuration = 400,
  skipDelayDuration = 200,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

/** UI-Tooltip — 반전 배경 12px. shortcut이 있으면 오른쪽에 키를 보인다. */
function TooltipContent({
  className,
  sideOffset = 6,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & { shortcut?: React.ReactNode }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 flex max-w-60 items-center gap-2 rounded-pill bg-inverse px-3 py-1 text-label text-inverse-fg data-[state=delayed-open]:animate-fade data-[state=instant-open]:animate-fade",
          className,
        )}
        {...props}
      >
        <span>{children}</span>
        {shortcut ? <span className="text-inverse-fg/70">{shortcut}</span> : null}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
