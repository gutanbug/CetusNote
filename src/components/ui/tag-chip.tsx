import { useMessages } from "@/lib/i18n";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type * as React from "react";
import { focusRing } from "./styles";

const SOFT_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;
type SoftColor = (typeof SOFT_COLORS)[number];

/** 소프트 컬러 9종 (tokens.md §2) — 태그, 상태 칩, 색 선택에서 함께 쓴다 */
const softColor = cva("", {
  variants: {
    color: {
      gray: "bg-gray-bg text-gray-fg",
      brown: "bg-brown-bg text-brown-fg",
      orange: "bg-orange-bg text-orange-fg",
      yellow: "bg-yellow-bg text-yellow-fg",
      green: "bg-green-bg text-green-fg",
      blue: "bg-blue-bg text-blue-fg",
      purple: "bg-purple-bg text-purple-fg",
      pink: "bg-pink-bg text-pink-fg",
      red: "bg-red-bg text-red-fg",
    },
  },
  defaultVariants: { color: "gray" },
});

const chipBase =
  "relative inline-flex h-5.5 w-fit max-w-45 shrink-0 items-center justify-center rounded-pill px-2 text-center text-label font-medium";

type TagChipProps = Omit<React.ComponentProps<"span">, "color"> & {
  color?: SoftColor;
  /** 있으면 삭제 버튼을 보인다 */
  onRemove?: () => void;
  removeLabel?: string;
};

/** UI-TagChip — 프로토타입 .chip[data-color] */
function TagChip({ color, onRemove, removeLabel, className, children, ...props }: TagChipProps) {
  const m = useMessages();
  return (
    <span
      data-slot="tag-chip"
      className={cn(chipBase, softColor({ color }), onRemove && "group/chip", className)}
      {...props}
    >
      <span className="truncate">{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={
            removeLabel ??
            m.ui.tag.remove(typeof children === "string" ? children : m.ui.tag.untitled)
          }
          className={cn(
            // 보조 컨트롤: 칩에 마우스를 올리거나 키보드로 오면 드러난다 (taste B).
            // 자리를 차지하지 않게 칩 오른쪽 끝에 겹쳐 띄운다 — 숨어 있을 때도 글자가 가운데에 온다
            "group/x absolute top-1/2 right-0.5 grid size-4.5 -translate-y-1/2 place-items-center rounded-pill bg-inherit opacity-0 group-hover/chip:opacity-100 before:absolute before:-inset-0.75 before:content-[''] hover:bg-active focus-visible:opacity-100 force-hover:bg-active force-hover:opacity-100",
            focusRing,
          )}
        >
          {/* 버튼은 불투명하게 두어 아래 글자를 가리고, 아이콘만 흐리게 */}
          <X
            strokeWidth={1.5}
            className="size-3 opacity-70 group-hover/x:opacity-100 group-focus-visible/x:opacity-100"
            aria-hidden
          />
        </button>
      ) : null}
    </span>
  );
}

export { chipBase, SOFT_COLORS, softColor, TagChip, type SoftColor, type TagChipProps };
