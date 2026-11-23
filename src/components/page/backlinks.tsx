import { currentPlatform, isModPressed } from "@/lib/platform-labels";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { ChevronRight, FileText } from "lucide-react";
import * as React from "react";
import { PageIcon } from "@/components/ui/page-icon";

export type BacklinkItem = {
  id: string;
  title: string;
  emoji?: string | null;
  /** 이 페이지 안의 언급 수 */
  count: number;
  /** 언급 문맥(최대 몇 줄) — highlight는 text 안의 [시작, 끝) */
  snippets: { text: string; highlight: [number, number] }[];
};

type BacklinksProps = {
  items: BacklinkItem[];
  /** 페이지 열기. ⌘클릭이면 newTab (SHELL-11) */
  onOpen: (id: string, opts: { newTab: boolean; pane?: boolean }) => void;
  /** 처음에 펼쳐 둘지 (기본 펼침) */
  defaultOpen?: boolean;
  className?: string;
};

/**
 * PG-Backlinks — 이 페이지를 언급한 페이지 (PAGE-09). 본문 아래에 조용히 둔다.
 * 머리(접기·개수) + 페이지마다 제목과 언급 문맥(언급 자리는 진하게).
 */
function Backlinks({ items, onOpen, defaultOpen = true, className }: BacklinksProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const headId = React.useId();
  const listId = React.useId();
  const total = items.reduce((n, i) => n + i.count, 0);
  return (
    <section
      data-slot="backlinks"
      aria-labelledby={headId}
      className={cn("border-t border-line pt-3", className)}
    >
      <h2
        id={headId}
        className="text-label font-semibold tracking-(--tracking-label) text-tertiary"
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(!open)}
          className={cn(
            "-ml-1 inline-flex items-center gap-1 rounded-md py-1 pr-2 pl-1 transition-colors duration-(--dur-fast) hover:text-secondary force-hover:text-secondary",
            focusRing,
          )}
        >
          <ChevronRight
            strokeWidth={1.5}
            aria-hidden
            data-open={open || undefined}
            className="size-3.5 transition-transform duration-(--dur-fast) data-open:rotate-90"
          />
          백링크
          <span className="font-normal tabular-nums">
            <span className="sr-only">: 페이지 </span>
            {items.length}
            <span className="sr-only">개, 언급 {total}번</span>
          </span>
        </button>
      </h2>
      {open ? (
        <ul id={listId} className="mt-1 grid gap-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={(e) =>
                  onOpen(item.id, {
                    newTab: e.metaKey || e.ctrlKey,
                    pane: isModPressed(e, currentPlatform()) && e.altKey,
                  })
                }
                className={cn(
                  "grid w-full gap-0.5 rounded-lg px-2 py-2 text-left transition-colors duration-(--dur-fast) hover:bg-hover force-hover:bg-hover",
                  focusRing,
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-ui font-medium text-primary">
                  {item.emoji ? (
                    <span aria-hidden className="w-4.5 shrink-0 text-center leading-none">
                      <PageIcon icon={item.emoji} />
                    </span>
                  ) : (
                    <FileText
                      strokeWidth={1.5}
                      aria-hidden
                      className="size-4 shrink-0 text-tertiary"
                    />
                  )}
                  <span className={cn("truncate", !item.title && "text-tertiary")}>
                    {item.title || "제목 없음"}
                  </span>
                  {item.count > 1 ? (
                    <span className="shrink-0 text-label font-normal text-tertiary">
                      {item.count}번
                    </span>
                  ) : null}
                </span>
                {item.snippets.map((s, i) => (
                  <span
                    key={i}
                    className="line-clamp-2 pl-6.5 text-caption leading-relaxed text-secondary"
                  >
                    {s.text.slice(0, s.highlight[0])}
                    <strong className="font-medium text-primary">
                      {s.text.slice(s.highlight[0], s.highlight[1])}
                    </strong>
                    {s.text.slice(s.highlight[1])}
                  </span>
                ))}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export { Backlinks, type BacklinksProps };
