import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { rovingKey } from "./roving";

export type ThemeChoice = "light" | "dark" | "system";

const THEMES: { id: ThemeChoice; name: string; icon: LucideIcon }[] = [
  { id: "light", name: "라이트", icon: Sun },
  { id: "dark", name: "다크", icon: Moon },
  { id: "system", name: "시스템", icon: Monitor },
];

/** 미리보기 칸 — data-theme으로 그 테마의 실제 토큰 색을 쓴다 */
function Preview({ theme }: { theme: ThemeChoice }) {
  const side = theme === "dark" ? "dark" : "light";
  const app = theme === "light" ? "light" : "dark";
  return (
    <span
      aria-hidden
      className="grid h-17 grid-cols-[34%_1fr] overflow-hidden rounded-lg border border-line"
    >
      <span data-theme={side} className="block border-r border-line bg-sidebar" />
      <span data-theme={app} className="grid content-start gap-1.25 bg-app p-2">
        <i className="block h-1 w-[70%] rounded-hair bg-(--text-primary)" />
        <i className="block h-1 w-[92%] rounded-hair bg-(--text-primary) opacity-45" />
        <i className="block h-1 w-[80%] rounded-hair bg-(--text-primary) opacity-45" />
        <i className="block h-1 w-[40%] rounded-hair bg-accent" />
      </span>
    </span>
  );
}

type ThemeCardGroupProps = {
  value: ThemeChoice;
  onValueChange: (theme: ThemeChoice) => void;
  className?: string;
};

/**
 * PG-ThemeCard — 라이트 · 다크 · 시스템 미리보기 카드 3개 (프로토타입 `.theme-card`).
 * 라디오 그룹: 방향키로 옮기면 바로 고른다. 고른 카드는 accent 테두리 + 3px 소프트 링.
 */
function ThemeCardGroup({ value, onValueChange, className }: ThemeCardGroupProps) {
  const ids = THEMES.map((t) => t.id);
  return (
    <div
      role="radiogroup"
      aria-label="테마"
      data-roving=""
      data-slot="theme-cards"
      className={cn("grid max-w-full grid-cols-[repeat(3,minmax(0,1fr))] gap-3", className)}
    >
      {THEMES.map(({ id, name, icon: Icon }) => {
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
              "grid gap-2 rounded-lg border border-line p-2 text-left transition-colors duration-(--dur-fast)",
              "hover:bg-hover aria-checked:border-accent aria-checked:ring-3 aria-checked:ring-accent-soft force-hover:bg-hover",
              focusRing,
            )}
          >
            <Preview theme={id} />
            <span className="flex items-center gap-1 text-caption font-medium text-primary">
              <Icon strokeWidth={1.5} aria-hidden className="size-3.5 shrink-0" />
              {name}
              {checked ? (
                <Check strokeWidth={1.5} aria-hidden className="size-3.5 text-accent" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { ThemeCardGroup, type ThemeCardGroupProps };
