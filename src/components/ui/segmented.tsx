import { cn } from "@/lib/utils";
import { ToggleGroup } from "radix-ui";
import type * as React from "react";
import { focusRing, press } from "./styles";

type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** label이 글자가 아닐 때(아이콘만) 읽어 줄 이름 */
  ariaLabel?: string;
};

type SegmentedProps<T extends string> = {
  /** 2–4개 */
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** 그룹의 접근성 이름 */
  label: string;
  className?: string;
};

/** UI-Segmented — 프로토타입 .seg / .seg-btn. 항상 하나가 선택된다. */
function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => next && onValueChange(next as T)}
      className={cn(
        "inline-flex shrink-0 gap-0.5 rounded-pill border border-line bg-subtle p-0.5",
        className,
      )}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          aria-label={o.ariaLabel}
          data-press=""
          className={cn(
            "flex h-6 items-center gap-1 rounded-pill px-3 text-caption text-secondary [&_svg]:size-4",
            press,
            "hover:text-primary force-hover:text-primary",
            "data-[state=on]:bg-sel data-[state=on]:font-medium data-[state=on]:text-sel-fg data-[state=on]:ring-1 data-[state=on]:ring-accent-soft",
            focusRing,
          )}
        >
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export { Segmented, type SegmentedOption, type SegmentedProps };
