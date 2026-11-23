import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type * as React from "react";
import { focusRing, press } from "./styles";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** UI-IconButton — 프로토타입 .icon-btn. 이름(label)은 aria-label과 툴팁에 함께 쓴다. */
const iconButtonVariants = cva(
  [
    "inline-grid shrink-0 place-items-center rounded-pill text-secondary",
    "hover:bg-active hover:text-primary force-hover:bg-active force-hover:text-primary",
    "aria-pressed:text-accent data-[on=true]:text-accent",
    "disabled:pointer-events-none disabled:opacity-35",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    focusRing,
    press,
  ],
  {
    variants: {
      size: { sm: "size-6.5", md: "size-8" },
    },
    defaultVariants: { size: "sm" },
  },
);

type IconButtonProps = Omit<React.ComponentProps<"button">, "aria-label"> &
  VariantProps<typeof iconButtonVariants> & {
    /** 접근성 이름이자 툴팁 문구 (필수) */
    label: string;
    /** 툴팁에 함께 보일 단축키 */
    shortcut?: React.ReactNode;
    /** 툴팁을 끈다(메뉴 트리거 등 다른 설명이 있을 때) */
    noTooltip?: boolean;
    /** 켜짐 상태 (accent 색) */
    on?: boolean;
  };

function IconButton({
  className,
  size,
  label,
  shortcut,
  noTooltip,
  on,
  type = "button",
  ...props
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      data-slot="icon-button"
      data-press=""
      data-on={on || undefined}
      aria-label={label}
      className={cn(iconButtonVariants({ size }), className)}
      {...props}
    />
  );
  if (noTooltip) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent shortcut={shortcut}>{label}</TooltipContent>
    </Tooltip>
  );
}

export { IconButton, iconButtonVariants, type IconButtonProps };
