import { cn } from "@/lib/utils";
import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";
import { focusRing } from "./styles";

/** UI-Switch — 프로토타입 .switch (36×20, 손잡이 16) */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill bg-line-control transition-colors duration-(--dur) before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']",
        "disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:bg-accent",
        "enabled:hover:brightness-94 force-hover:brightness-94",
        focusRing,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 translate-x-0.5 rounded-pill bg-knob shadow-knob transition-transform duration-(--dur) data-[state=checked]:translate-x-4.5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
