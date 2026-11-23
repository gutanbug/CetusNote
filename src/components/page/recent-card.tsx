import { focusRing, press } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { Clock, FileText, Table2 } from "lucide-react";
import type * as React from "react";
import { PageIcon } from "@/components/ui/page-icon";

type RecentCardProps = Omit<React.ComponentProps<"button">, "children"> & {
  title: string;
  emoji?: string | null;
  /** collection이면 이모지가 없을 때 표 아이콘 (보드·표·캘린더) */
  kind?: "page" | "collection";
  /** 아래 작은 글 — 예: "3분 전" */
  meta: string;
  /** 썸네일 주소 — 커버(PAGE-03), 없으면 본문 첫 이미지. 없으면 아이콘 */
  thumb?: string;
};

/**
 * PG-RecentCard — 썸네일(아이콘) · 제목 · 시간 (프로토타입 `.card`, 196px).
 * 썸네일 주소가 있으면 그 이미지를, 없으면 아이콘을 옅은 바탕에 둔다.
 */
function RecentCard({
  title,
  emoji,
  kind = "page",
  meta,
  thumb,
  className,
  type = "button",
  ...props
}: RecentCardProps) {
  return (
    <button
      type={type}
      data-slot="recent-card"
      data-press=""
      className={cn(
        "grid w-49 shrink-0 grid-rows-[auto_1fr] overflow-hidden rounded-lg border border-line bg-elevated text-left text-primary",
        "transition-colors duration-(--dur-fast) ease-(--ease) hover:bg-hover force-hover:bg-hover",
        focusRing,
        press,
        className,
      )}
      {...props}
    >
      {thumb ? (
        <img src={thumb} alt="" draggable={false} className="aspect-8/5 w-full object-cover" />
      ) : (
        <span
          aria-hidden
          className="grid aspect-8/5 place-items-center bg-subtle text-h2 leading-none"
        >
          {emoji ? (
            <PageIcon icon={emoji} />
          ) : kind === "collection" ? (
            <Table2 strokeWidth={1.5} className="size-5 text-tertiary" />
          ) : (
            <FileText strokeWidth={1.5} className="size-5 text-tertiary" />
          )}
        </span>
      )}
      <span className="grid gap-1 px-3 pt-2 pb-3">
        <span className="truncate text-ui font-medium">{title}</span>
        <span className="flex items-center gap-1 text-label text-tertiary">
          <Clock strokeWidth={1.5} aria-hidden className="size-3" />
          {meta}
        </span>
      </span>
    </button>
  );
}

export { RecentCard, type RecentCardProps };
