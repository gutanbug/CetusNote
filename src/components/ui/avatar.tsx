import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type * as React from "react";

/** UI-Avatar — 이니셜 아바타 (프로토타입 .ws-avatar). 이미지는 쓰지 않는다(로컬 전용 앱). */
const avatarVariants = cva(
  "inline-grid shrink-0 place-items-center rounded-pill bg-accent-fill font-semibold tracking-tight text-accent-fill-on select-none",
  {
    variants: {
      size: {
        sm: "size-5.5 text-micro",
        md: "size-8 text-caption",
      },
    },
    defaultVariants: { size: "sm" },
  },
);

/** 이름에서 이니셜 1–2자를 뽑는다. 한글은 첫 글자, 영문은 단어 첫 글자 2개. */
function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  if (/^[\p{Script=Hangul}]/u.test(trimmed)) return trimmed[0];
  const words = trimmed.split(/\s+/);
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}

type AvatarProps = Omit<React.ComponentProps<"span">, "children"> &
  VariantProps<typeof avatarVariants> & { name: string };

function Avatar({ name, size, className, ...props }: AvatarProps) {
  return (
    <span
      data-slot="avatar"
      role="img"
      aria-label={name}
      className={cn(avatarVariants({ size }), className)}
      {...props}
    >
      <span aria-hidden>{initialsOf(name)}</span>
    </span>
  );
}

export { Avatar, initialsOf, type AvatarProps };
