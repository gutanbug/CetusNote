import { RecentCard } from "@/components/page/recent-card";
import { TodayTodos, type TodayTodo } from "@/components/page/today-todos";
import { Breadcrumb } from "@/components/shell/breadcrumb";
import { TopBar } from "@/components/shell/top-bar";
import { Button } from "@/components/ui/button";
import { TagChip } from "@/components/ui/tag-chip";
import { focusRing } from "@/components/ui/styles";
import { useBottomTail } from "@/screens/main/use-bottom-tail";
import { SkyMark } from "@/screens/main/sky-mark";
import { useMeta } from "@/features/meta";
import { useAssetUrl } from "@/features/assets";
import { usePages } from "@/features/pages";
import { openTodosIn, summaryIndex, useSummaryVersion } from "@/features/pages/summary";
import { sessionStore, useSession } from "@/features/session";
import type { Page } from "@/lib/storage";
import { formatAgo } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { LayoutTemplate, Plus } from "lucide-react";
import * as React from "react";
import { msg, useMessages } from "@/lib/i18n";
import {
  createNearActive,
  displayTitle,
  openPage,
  openRecent,
  recordHome,
  setTodo,
} from "./actions";
import { openPageFrom } from "./tabs";
import { greeting } from "./home-model";
import { recentPages, visibleIds } from "./palette-model";
import { countTags, tagColor } from "./tag-colors";
import { useTopBarTitleBar } from "./use-tab-bar";
import { useMainUi } from "./ui-store";

const TODO_LIMIT = 7;
const RECENT_LIMIT = 8;

/** 홈 위쪽 공통 — 상단 바(경로 "홈"/태그), 사이드바 토글, 신호등 자리 */
export function HomeTopBar({ crumbs }: { crumbs: { id: string; title: string }[] }) {
  const collapsed = useSession((s) => s.sidebarCollapsed);
  const focusMode = useMainUi((s) => s.focusMode);
  const titleBar = useTopBarTitleBar();
  return (
    <TopBar
      breadcrumb={
        <Breadcrumb
          items={crumbs}
          onNavigate={(id) => id === "home" && useMainUi.getState().setView({ kind: "home" })}
        />
      }
      sidebarOpen={!collapsed && !focusMode}
      onToggleSidebar={() =>
        focusMode
          ? useMainUi.getState().setFocusMode(false)
          : sessionStore.getState().toggleSidebar()
      }
      titleBar={titleBar}
    />
  );
}

/** 섹션 머리 — 작은 라벨 + 오른쪽 버튼들 (프로토타입 `.home-section-head`) */
function SectionHead({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2
        id={id}
        className="flex-1 text-label font-semibold tracking-(--tracking-label) text-tertiary uppercase"
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * 홈 (SHELL-13) — 인사 · 최근 방문 · 오늘의 할 일 · 태그별 바로가기.
 * 할 일은 모든 문서의 체크하지 않은 항목(최근에 고친 문서부터). 여기서 체크한 것은 홈을 떠날 때까지 취소선으로 남긴다.
 */
export function HomeView() {
  const m = useMessages();
  const pages = usePages((s) => s.pages);
  // 할 일은 본문 요약을 본다 (SYS-10, ADR-022). 요약이 채워지는 대로 다시 그린다
  useSummaryVersion();
  const recentIds = useSession((s) => s.recent);
  const tagColors = useMeta((s) => s.meta?.tags);
  const [hour] = React.useState(() => new Date().getHours());
  // 홈에서 체크한 항목 — 목록에서 바로 빠지지 않게 잠깐 들고 있는다
  const [done, setDone] = React.useState<Record<string, TodayTodo & { at: number }>>({});
  const { scrollRef, bodyRef, tailRef, tailOpen } = useBottomTail();

  const visible = React.useMemo(() => visibleIds(pages), [pages]);
  const docs = React.useMemo(
    () => [...visible].map((id) => pages[id]!).filter((p) => p.kind === "page"),
    [visible, pages],
  );
  const recents = recentPages(recentIds, pages, visible).slice(0, RECENT_LIMIT);
  // 요약이 채워지면 이 화면도 다시 그려지므로 따로 메모하지 않는다 (SYS-10)
  const allOpen = openTodosIn(docs);
  const todos: TodayTodo[] = React.useMemo(() => {
    const toItem = (t: (typeof allOpen)[number]): TodayTodo => ({
      id: t.key,
      text: t.text,
      checked: false,
      pageId: t.pageId,
      pageTitle: pages[t.pageId]?.title ?? "",
      pageEmoji: pages[t.pageId]?.icon,
    });
    const shown = allOpen.slice(0, TODO_LIMIT).map(toItem);
    // 방금 체크한 것은 원래 자리에 취소선으로 (체크할 때의 순번에 끼운다)
    const out = [...shown];
    for (const d of Object.values(done).sort((a, b) => a.at - b.at))
      if (!out.some((s) => s.id === d.id)) out.splice(d.at, 0, { ...d, checked: true });
    return out;
  }, [allOpen, done, pages]);
  const tagCounts = React.useMemo(() => countTags(docs), [docs]);

  const toggle = (id: string, checked: boolean) => {
    const ref = allOpen.find((t) => t.key === id);
    const kept = done[id];
    const pageId = ref?.pageId ?? kept?.pageId;
    const path =
      ref?.path ??
      (kept
        ? id
            .slice(id.indexOf(":") + 1)
            .split(".")
            .map(Number)
        : null);
    if (!pageId || !path) return;
    setTodo(pageId, path, checked);
    setDone((d) => {
      const next = { ...d };
      if (checked) {
        const at = todos.findIndex((t) => t.id === id);
        if (at >= 0) next[id] = { ...todos[at]!, checked: true, at };
      } else delete next[id];
      return next;
    });
  };

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
      <HomeTopBar crumbs={[{ id: "home", title: m.screens.home.title }]} />
      <div ref={scrollRef} data-slot="home" className="overflow-y-auto overscroll-contain">
        {/* 아래 여백은 고정 padding이 아니다. 고정 여백은 내용이 화면에 딱 맞을 때도 스크롤을 만든다(SHELL-17).
            넘칠 때만 tail(--s16)을 펼친다 */}
        <div ref={bodyRef} className="@container mx-auto w-full max-w-240 px-12 pt-12">
          <div className="flex items-start gap-6">
            <div className="min-w-0 flex-1">
              <h1
                id="home-title"
                tabIndex={-1}
                className="text-h1 font-bold tracking-tight text-primary outline-none"
              >
                {greeting(hour)}
              </h1>
              <p className="mt-2 text-ui text-secondary">
                {m.screens.home.openSummary(allOpen.length, docs.length)}
              </p>
            </div>
            {/* 좁으면 숨긴다(concept.md §3). 모양·빛은 SkyMark가 정한다 */}
            <SkyMark className="hidden @3xl:block" />
          </div>

          <section aria-labelledby="home-recent" className="mt-12">
            <SectionHead id="home-recent" title={m.screens.home.recentVisit}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => useMainUi.getState().setTemplatesOpen(true)}
              >
                <LayoutTemplate strokeWidth={1.5} aria-hidden />
                {m.screens.home.templates}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => createNearActive()}>
                <Plus strokeWidth={1.5} aria-hidden />
                {m.screens.sidebar.newPage}
              </Button>
            </SectionHead>
            {recents.length ? (
              <div className="-mx-12 flex snap-x scroll-px-12 [scrollbar-width:none] gap-3 overflow-x-auto overscroll-contain px-12 pb-1">
                {recents.map((p, i) => (
                  <RecentThumbCard
                    key={p.id}
                    page={p}
                    title={displayTitle(p)}
                    emoji={p.icon}
                    kind={p.kind === "collection" ? "collection" : "page"}
                    meta={[formatAgo(p.updatedAt), recordHome(p, pages)]
                      .filter(Boolean)
                      .join(" · ")}
                    onClick={(e) =>
                      e.metaKey || e.ctrlKey ? openPageFrom(p.id, e) : openRecent(p.id)
                    }
                    style={{ "--i": i } as React.CSSProperties}
                    className="animate-rise snap-start [animation-delay:calc(min(var(--i),10)*var(--dur-fast)/4)] [animation-fill-mode:backwards]"
                  />
                ))}
              </div>
            ) : (
              <p className="text-ui text-tertiary">{m.screens.home.noRecent}</p>
            )}
          </section>

          <section aria-labelledby="home-todos" className="mt-12">
            <SectionHead id="home-todos" title={m.screens.home.todayTodos} />
            <TodayTodos items={todos} onCheckedChange={toggle} onOpenPage={openPage} />
            {allOpen.length > TODO_LIMIT ? (
              <p className="mt-2 text-label text-tertiary">
                {m.screens.home.moreTodos(allOpen.length - TODO_LIMIT)}
              </p>
            ) : null}
          </section>

          {tagCounts.length ? (
            <section aria-labelledby="home-tags" className="mt-12">
              <SectionHead id="home-tags" title={m.screens.home.tagShortcuts} />
              <ul className="flex flex-wrap gap-2">
                {tagCounts.map(([tag, count]) => (
                  <li key={tag}>
                    <TagButton tag={tag} count={count} color={tagColor(tagColors?.[tag])} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {/* 넘칠 때만 펼치는 아래 여백(SHELL-17). 토큰 --s16 */}
          <div ref={tailRef} aria-hidden className={tailOpen ? "h-16" : "hidden"} />
        </div>
      </div>
    </div>
  );
}

/** 태그 바로가기 — UI-TagChip + 개수를 담은 버튼 (프로토타입 `.tag-link`) */
function TagButton({
  tag,
  count,
  color,
}: {
  tag: string;
  count: number;
  color: ReturnType<typeof tagColor>;
}) {
  return (
    <button
      type="button"
      aria-label={msg().screens.home.tagAria(tag, count)}
      onClick={() => useMainUi.getState().setView({ kind: "tag", tag })}
      className={cn(
        "inline-flex min-h-7.5 items-center gap-2 rounded-pill border border-line py-1 pr-3 pl-1 text-caption text-tertiary",
        "transition-colors duration-(--dur-fast) hover:bg-hover force-hover:bg-hover",
        focusRing,
      )}
    >
      <TagChip color={color}>{tag}</TagChip>
      <span aria-hidden>{count}</span>
    </button>
  );
}

/** 최근 카드 + 썸네일: 커버, 없으면 본문 첫 이미지 (프로토타입 `.card-thumb`와 같은 규칙) */
function RecentThumbCard({
  page,
  ...props
}: { page: Page } & Omit<React.ComponentProps<typeof RecentCard>, "thumb">) {
  // 표지가 없으면 본문 요약의 첫 그림 (요약이 채워지면 다시 그린다)
  useSummaryVersion();
  const thumb = useAssetUrl(page.cover ?? summaryIndex.get(page.id)?.asset ?? null);
  return <RecentCard thumb={thumb} {...props} />;
}
