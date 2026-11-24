import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { PageIcon } from "@/components/ui/page-icon";
import { collapsePath } from "./breadcrumb-path";

export type Crumb = { id: string; title: string; emoji?: string };

type BreadcrumbProps = {
  /** 맨 위 → 지금 페이지 순서 */
  items: Crumb[];
  onNavigate?: (id: string) => void;
  /** 이보다 길면 가운데를 "…"로 접는다 (첫 항목 + … + 마지막 maxItems-2개) */
  maxItems?: number;
  className?: string;
};

const crumbClass = "flex min-w-0 max-w-55 items-center gap-1 rounded-pill px-1 py-0.5";
const crumbButton = cn(
  crumbClass,
  "transition-colors duration-(--dur-fast) hover:bg-hover hover:text-primary force-hover:bg-hover force-hover:text-primary",
  focusRing,
);

function Label({ item }: { item: Crumb }) {
  return (
    <>
      {item.emoji ? (
        <span aria-hidden className="shrink-0 leading-none">
          <PageIcon icon={item.emoji} />
        </span>
      ) : null}
      <span title={item.title || undefined} className="truncate">
        {item.title || "제목 없음"}
      </span>
    </>
  );
}

/**
 * SH-Breadcrumb — 페이지 경로 (프로토타입 `.crumbs`, shadcn breadcrumb의 nav > ol > li 구조).
 * 지금 페이지는 aria-current="page", 긴 경로는 가운데를 "…" 메뉴로 접는다.
 */
function Breadcrumb({ items, onNavigate, maxItems = 4, className }: BreadcrumbProps) {
  const { shown, hidden } = collapsePath(items, maxItems);

  return (
    <nav aria-label="경로" data-slot="breadcrumb" className={cn("min-w-0 flex-1", className)}>
      <ol className="flex min-w-0 items-center gap-0.5 text-ui text-secondary">
        {shown.map((item, i) => {
          const last = i === shown.length - 1;
          return (
            <li
              key={item === "more" ? "more" : item.id}
              className={cn("flex items-center gap-0.5", last ? "min-w-0" : "min-w-0 shrink")}
            >
              {i > 0 ? (
                <span aria-hidden className="shrink-0 px-0.5 text-tertiary">
                  /
                </span>
              ) : null}
              {item === "more" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`숨긴 경로 ${hidden.length}개`}
                    className={cn(crumbButton, "min-w-6 shrink-0 justify-center")}
                  >
                    …
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {hidden.map((h) => (
                      <DropdownMenuItem
                        key={h.id}
                        icon={h.emoji ? <span aria-hidden>{h.emoji}</span> : undefined}
                        onSelect={() => onNavigate?.(h.id)}
                      >
                        {h.title || "제목 없음"}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : last ? (
                <span aria-current="page" className={cn(crumbClass, "text-primary")}>
                  <Label item={item} />
                </span>
              ) : (
                <button type="button" className={crumbButton} onClick={() => onNavigate?.(item.id)}>
                  <Label item={item} />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Breadcrumb, type BreadcrumbProps };
