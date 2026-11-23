import { cn } from "@/lib/utils";
import { Separator as SeparatorPrimitive } from "radix-ui";
import type * as React from "react";

/** UI-Separator — --border-subtle 1px 선 */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-line data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px",
        // 변형(data-*) 없이 두어야 className의 self-center가 이긴다(tailwind-merge). 툴바 구분선이 위로 치우쳤던 원인
        orientation === "vertical" && "self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
