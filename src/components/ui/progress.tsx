import { cn } from "@/lib/utils";
import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";

/** 이름이 꼭 있어야 한다(진행률 막대는 무엇의 진행인지 읽혀야 한다) */
type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> &
  ({ "aria-label": string } | { "aria-labelledby": string });

/** UI-Progress — 4px 막대, --r-hair */
function Progress({ className, value = 0, ...props }: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn("relative h-1 w-full overflow-hidden rounded-hair bg-active", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full bg-accent transition-transform duration-(--dur)"
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress, type ProgressProps };
