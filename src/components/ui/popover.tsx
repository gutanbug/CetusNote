import { cn } from "@/lib/utils";
import { Popover as PopoverPrimitive } from "radix-ui";
import type * as React from "react";
import { popoverSurface } from "./styles";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverClose = PopoverPrimitive.Close;

/** OV-Popover — 프로토타입 .popover (bg-elevated, --r-lg, --shadow-popover, pop 모션) */
function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(popoverSurface, "max-w-85 min-w-55 outline-none", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger };
