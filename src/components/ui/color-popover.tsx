import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { SOFT_COLORS, type SoftColor } from "./tag-chip";
import { focusRing } from "./styles";

const COLOR_NAMES: Record<SoftColor, string> = {
  gray: "회색",
  brown: "갈색",
  orange: "주황",
  yellow: "노랑",
  green: "초록",
  blue: "파랑",
  purple: "보라",
  pink: "분홍",
  red: "빨강",
};

const TEXT_CLASS: Record<SoftColor, string> = {
  gray: "text-gray-fg",
  brown: "text-brown-fg",
  orange: "text-orange-fg",
  yellow: "text-yellow-fg",
  green: "text-green-fg",
  blue: "text-blue-fg",
  purple: "text-purple-fg",
  pink: "text-pink-fg",
  red: "text-red-fg",
};
const BG_CLASS: Record<SoftColor, string> = {
  gray: "bg-gray-bg",
  brown: "bg-brown-bg",
  orange: "bg-orange-bg",
  yellow: "bg-yellow-bg",
  green: "bg-green-bg",
  blue: "bg-blue-bg",
  purple: "bg-purple-bg",
  pink: "bg-pink-bg",
  red: "bg-red-bg",
};

type ColorValue = { text: SoftColor | null; highlight: SoftColor | null };

type ColorPickerProps = {
  value: ColorValue;
  onChange: (value: ColorValue) => void;
  className?: string;
};

const swatch = cn(
  "grid size-7 place-items-center rounded-pill border border-line text-ui font-semibold transition-colors",
  "hover:border-line-strong aria-pressed:border-accent aria-pressed:ring-1 aria-pressed:ring-accent force-hover:border-line-strong",
  focusRing,
);

/**
 * OV-ColorPopover의 내용 — 글자색 줄 + 하이라이트 줄 (소프트 컬러 9종).
 * 이미 선택한 색을 다시 누르면 해제된다. OV-Popover 안에 넣어 쓴다.
 */
function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const row = (kind: keyof ColorValue, title: string) => (
    <div role="group" aria-label={title} className="grid gap-1">
      <div className="px-1 text-label font-semibold tracking-(--tracking-label) text-tertiary">
        {title}
      </div>
      <div className="grid grid-cols-9 gap-1">
        {SOFT_COLORS.map((c) => {
          const selected = value[kind] === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={selected}
              aria-label={`${title} ${COLOR_NAMES[c]}`}
              title={COLOR_NAMES[c]}
              onClick={() => onChange({ ...value, [kind]: selected ? null : c })}
              className={cn(swatch, kind === "text" ? TEXT_CLASS[c] : BG_CLASS[c])}
            >
              {kind === "text" ? (
                <span aria-hidden>가</span>
              ) : selected ? (
                <Check strokeWidth={1.5} className="size-4 text-primary" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div data-slot="color-picker" className={cn("grid gap-2 p-1", className)}>
      {row("text", "글자색")}
      {row("highlight", "배경색")}
    </div>
  );
}

export { COLOR_NAMES, ColorPicker, type ColorPickerProps, type ColorValue };
