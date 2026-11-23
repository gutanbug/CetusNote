import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { RadioGroup } from "radix-ui";
import type * as React from "react";
import { focusRing, press } from "./styles";

export type ChoiceCardOption<T extends string> = {
  value: T;
  /** 카드 머리에 놓는 그림(예: UI-AppLogo) */
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** 한 줄 설명 */
  description?: React.ReactNode;
};

type ChoiceCardsProps<T extends string> = {
  options: ChoiceCardOption<T>[];
  value: T | null;
  onValueChange: (value: T) => void;
  /** 그룹의 접근성 이름 */
  label: string;
  /** 열 수 (기본 2) */
  columns?: 2 | 3 | 4;
  className?: string;
};

/**
 * UI-ChoiceCard — 카드 형식의 단일 선택(라디오 그룹). 화살표 키로 옮기면 선택도 따라간다(Radix RadioGroup).
 * Enter·Space는 버튼 기본 동작으로 고른다. 선택된 카드는 포인트 테두리와 체크 표시를 가진다.
 */
function ChoiceCards<T extends string>({
  options,
  value,
  onValueChange,
  label,
  columns = 2,
  className,
}: ChoiceCardsProps<T>) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value ?? ""}
      onValueChange={(next) => onValueChange(next as T)}
      className={cn(
        "grid gap-3",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-2 sm:grid-cols-4",
        className,
      )}
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          data-press=""
          // Radix 라디오는 Enter를 막으므로(폼 제출 방지) 여기서 고른다. Space는 라디오 기본 동작이다
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) onValueChange(o.value);
          }}
          className={cn(
            "relative flex min-w-0 flex-col items-start gap-3 rounded-lg border border-line bg-elevated p-4 text-left text-primary",
            press,
            "hover:bg-hover force-hover:bg-hover",
            "data-[state=checked]:border-accent data-[state=checked]:ring-1 data-[state=checked]:ring-accent-soft",
            focusRing,
          )}
        >
          {o.icon ? <span className="text-primary [&_svg]:size-6">{o.icon}</span> : null}
          <span className="grid min-w-0 gap-1">
            <span className="text-ui font-medium">{o.title}</span>
            {o.description ? (
              <span className="text-caption text-secondary">{o.description}</span>
            ) : null}
          </span>
          <RadioGroup.Indicator className="absolute top-3 right-3 text-accent">
            <Check aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </RadioGroup.Indicator>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

export { ChoiceCards };
