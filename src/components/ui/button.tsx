import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import type * as React from "react";
import { focusRing, press } from "./styles";

/** UI-Button — 프로토타입 .btn (components.html §2) */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill border border-transparent font-medium whitespace-nowrap select-none",
    "disabled:pointer-events-none disabled:opacity-40 aria-busy:pointer-events-none",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    focusRing,
    press,
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-accent-fill text-accent-fill-on hover:brightness-94 active:brightness-88 force-hover:brightness-94 force-active:brightness-88",
        secondary:
          "border-line-strong bg-elevated text-primary hover:bg-hover force-hover:bg-hover",
        ghost:
          "text-secondary hover:bg-hover hover:text-primary force-hover:bg-hover force-hover:text-primary",
        danger:
          "bg-danger-fill text-danger-fill-on hover:brightness-94 active:brightness-88 force-hover:brightness-94 force-active:brightness-88",
      },
      size: {
        sm: "min-h-7 px-3 text-caption",
        md: "min-h-8 px-4 text-ui",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** 처리 중: 회전 아이콘을 앞에 두고 클릭을 막는다 */
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-press=""
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <LoaderCircle
            strokeWidth={1.5}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants, type ButtonProps };
