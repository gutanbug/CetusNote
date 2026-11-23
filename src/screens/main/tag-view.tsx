import { RecentCard } from "@/components/page/recent-card";
import { TagChip } from "@/components/ui/tag-chip";
import { useMeta } from "@/features/meta";
import { usePages } from "@/features/pages";
import { formatAgo } from "@/lib/format-date";
import * as React from "react";
import { openPageFrom } from "./tabs";
import { HomeTopBar } from "./home-view";
import { visibleIds } from "./palette-model";
import { tagColor } from "./tag-colors";
import { openTagMenuAt } from "./tag-ui";
import { useBottomTail } from "./use-bottom-tail";
import { IconButton } from "@/components/ui/icon-button";
import { Ellipsis } from "lucide-react";

const ic = { strokeWidth: 1.5 } as const;

/** 태그별 문서 (홈의 태그 바로가기 → SHELL-07 태그 보기의 첫 모습). 최근에 고친 순 */
export function TagView({ tag }: { tag: string }) {
  const pages = usePages((s) => s.pages);
  const color = useMeta((s) => s.meta?.tags[tag]);
  const items = React.useMemo(() => {
    const visible = visibleIds(pages);
    return [...visible]
      .map((id) => pages[id]!)
      .filter((p) => p.kind === "page" && p.props.tags.includes(tag))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [pages, tag]);
  const { scrollRef, bodyRef, tailRef, tailOpen } = useBottomTail();

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
      <HomeTopBar
        crumbs={[
          { id: "home", title: "홈" },
          { id: "tag", title: `#${tag}` },
        ]}
      />
      <div ref={scrollRef} data-slot="tag-view" className="overflow-y-auto overscroll-contain">
        <div ref={bodyRef} className="mx-auto w-full max-w-240 px-12 pt-12">
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2">
              <TagChip color={tagColor(color)} className="h-7 px-3 text-ui">
                {tag}
              </TagChip>
              <span className="sr-only">태그</span>
            </h1>
            <IconButton
              label="태그 메뉴"
              aria-haspopup="menu"
              data-tag-anchor={tag}
              className="ml-1"
              onClick={(e) => openTagMenuAt(tag, e.currentTarget)}
            >
              <Ellipsis {...ic} />
            </IconButton>
          </div>
          <p className="mt-2 text-ui text-secondary">페이지 {items.length}개</p>
          {items.length ? (
            <ul className="mt-6 flex flex-wrap gap-3">
              {items.map((p) => (
                <li key={p.id}>
                  <RecentCard
                    title={p.title || "제목 없음"}
                    emoji={p.icon}
                    meta={formatAgo(p.updatedAt)}
                    onClick={(e) => openPageFrom(p.id, e)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-ui text-tertiary">이 태그가 붙은 페이지가 없어요.</p>
          )}
          {/* 넘칠 때만 펼치는 아래 여백(SHELL-13). 토큰 --s16 */}
          <div ref={tailRef} aria-hidden className={tailOpen ? "h-16" : "hidden"} />
        </div>
      </div>
    </div>
  );
}
