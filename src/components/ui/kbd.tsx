import { cn } from "@/lib/utils";
import type * as React from "react";

type KbdProps = React.ComponentProps<"span"> & {
  /** 누를 키 목록. 예: ["⌘", "K"] */
  keys: string[];
};

/** UI-Kbd — 단축키 배지. 키마다 kbd 하나 (프로토타입 .kbd). */
function Kbd({ keys, className, ...props }: KbdProps) {
  return (
    <span data-slot="kbd" className={cn("inline-flex items-center gap-0.5", className)} {...props}>
      {keys.map((key, i) => (
        <kbd
          key={`${key}-${i}`}
          className="inline-grid h-4.5 min-w-4.5 place-items-center rounded-xs border border-line bg-hover px-1 font-sans text-micro leading-none font-medium text-secondary"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

export { Kbd, type KbdProps };
