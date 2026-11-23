import { cn } from "@/lib/utils";
import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";
import { focusRing, hitArea } from "./styles";

/** UI-Checkbox — 프로토타입 .cbox (16px, 테두리 1.5px). checked="indeterminate" 지원. */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative grid size-4 shrink-0 place-items-center rounded-xs border-(length:--bw-control) border-tertiary bg-transparent text-accent-fill-on transition-colors",
        "hover:border-secondary force-hover:border-secondary",
        hitArea,
        "data-[state=checked]:border-accent-fill data-[state=checked]:bg-accent-fill data-[state=indeterminate]:border-accent-fill data-[state=indeterminate]:bg-accent-fill",
        "disabled:cursor-not-allowed disabled:opacity-40",
        focusRing,
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-items-center"
      >
        {props.checked === "indeterminate" ? (
          <Minus strokeWidth={2.5} className="size-3" aria-hidden />
        ) : (
          <Check strokeWidth={2.5} className="size-3" aria-hidden />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
