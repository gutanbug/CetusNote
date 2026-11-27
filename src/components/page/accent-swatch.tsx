import { Check } from "lucide-react";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { ACCENT_CHOICES, type AccentChoice } from "./options";
import { rovingKey } from "./roving";
import { useMessages } from "@/lib/i18n";

type AccentSwatchGroupProps = {
  value: AccentChoice;
  onValueChange: (accent: AccentChoice) => void;
  className?: string;
};

/**
 * PG-AccentSwatch — 포인트 색 8종 견본 (프로토타입 `.accent-card`, 높이 38).
 * 점 색은 data-accent로 그 색의 토큰(라이트 --accent-l, 다크 --accent-d)을 쓴다. 라디오 그룹.
 */
function AccentSwatchGroup({ value, onValueChange, className }: AccentSwatchGroupProps) {
  const m = useMessages();
  const ids = ACCENT_CHOICES.map((a) => a.id);
  return (
    <div
      role="radiogroup"
      aria-label={m.page.accent.group}
      data-roving=""
      data-slot="accent-swatches"
      className={cn("grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2", className)}
    >
      {ACCENT_CHOICES.map(({ id, name }) => {
        const checked = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-value={id}
            onClick={() => onValueChange(id)}
            onKeyDown={(e) => {
              const next = rovingKey(e, ids, value);
              if (next) onValueChange(next);
            }}
            className={cn(
              "flex min-h-9.5 items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-caption text-primary transition-colors duration-(--dur-fast)",
              "hover:bg-hover aria-checked:border-accent aria-checked:ring-3 aria-checked:ring-accent-soft force-hover:bg-hover",
              focusRing,
            )}
          >
            <span
              aria-hidden
              data-accent={id}
              className="size-4 shrink-0 rounded-pill bg-(--accent-l) dark:bg-(--accent-d)"
            />
            <span className={cn("min-w-0 flex-1 truncate", checked && "font-medium text-sel-fg")}>
              {name}
            </span>
            {checked ? (
              <Check strokeWidth={1.5} aria-hidden className="size-3.5 shrink-0 text-accent" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export { AccentSwatchGroup, type AccentSwatchGroupProps };
