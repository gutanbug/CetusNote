import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { chipBase, softColor, type SoftColor } from "@/components/ui/tag-chip";
import { StorageLab } from "./storage-lab";
import { PageIconProvider } from "@/components/ui/page-icon";
import { sampleResolveImage } from "@/components/ui/page-icon-sample";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./debug.css";
import { EditorSpecimen } from "./editor-specimen";
import { registry, type DebugEntry, type Layer, type Status } from "./registry";
import { SAMPLE_DOC } from "./sample-doc";
import {
  ACCENTS,
  parseSettings,
  serializeSettings,
  type DebugSettings,
  type Force,
  type Theme,
  type Width,
} from "./settings";
import { loadStories, type DebugStory } from "./stories";
import { TokensSection } from "./tokens-section";

// Debug 화면 (docs/dev/debug-screen.md). 개발 빌드에서만 존재한다 — App.tsx에서 동적 import.

const LAYERS: { layer: Layer; title: string }[] = [
  { layer: "L1", title: "L1 UI" },
  { layer: "L2", title: "L2 오버레이" },
  { layer: "L3", title: "L3 셸" },
  { layer: "L4", title: "L4 에디터" },
  { layer: "L5", title: "L5 페이지" },
  { layer: "L6", title: "L6 컬렉션" },
];

const STATUS_LABEL: Record<Status, string> = {
  planned: "계획",
  implemented: "구현",
  ready: "Ready",
  audited: "감사 완료",
};
const STATUS_COLOR: Record<Status, SoftColor> = {
  planned: "gray",
  implemented: "orange",
  ready: "blue",
  audited: "green",
};

type Entry = DebugEntry & { id: string };
const ENTRIES: Entry[] = Object.entries(registry).map(([id, e]) => ({ id, ...e }));
const isReady = (s: Status) => s === "ready" || s === "audited";

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn(chipBase, softColor({ color: STATUS_COLOR[status] }))}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** 견본 하나가 실패해도 화면 전체가 멈추지 않게 */
class StoryBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return <p className="text-caption text-danger">렌더링 오류: {this.state.error.message}</p>;
    return this.props.children;
  }
}

function useSettings() {
  const [settings, setSettings] = useState(() => parseSettings(window.location.hash));
  // 주소창에서 해시를 직접 바꿨을 때 (replaceState는 hashchange를 내지 않는다)
  useEffect(() => {
    const onHash = () => setSettings(parseSettings(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const update = (patch: Partial<DebugSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    window.history.replaceState(null, "", serializeSettings(next));
  };
  return [settings, update] as const;
}

/** 앱 전체(포털로 뜨는 오버레이 포함)에 테마·포인트 색·모션·글꼴 크기를 건다 */
function useRootAttributes(s: DebugSettings) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = s.theme === "dark" ? "dark" : "light";
    root.dataset.accent = s.accent;
    if (s.reduced) root.dataset.reducedMotion = "";
    else delete root.dataset.reducedMotion;
    root.style.setProperty("--font-scale", s.scale);
  }, [s.theme, s.accent, s.reduced, s.scale]);
}

/** 폭 프리셋: Tauri 창 크기를 바꾼다. 브라우저에서는 본문 폭만 제한한다. */
/** 폭 프리셋을 처음 고르기 전의 창 크기. "전체"로 돌아오면 이 크기로 되돌린다 */
let originalSize: { width: number; height: number } | null = null;

function useWindowWidth(width: Width) {
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    if (width === "full" && !originalSize) return;
    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow, LogicalSize }) => {
      const win = getCurrentWindow();
      if (width === "full") {
        const { width: w, height: h } = originalSize!;
        originalSize = null;
        return win.setSize(new LogicalSize(w, h));
      }
      if (!originalSize) {
        originalSize = (await win.innerSize()).toLogical(await win.scaleFactor());
      }
      return win.setSize(new LogicalSize(Number(width), 900));
    });
  }, [width]);
}

function ThemeColumns({ s, children }: { s: DebugSettings; children: () => ReactNode }) {
  const themes: Exclude<Theme, "both">[] = s.theme === "both" ? ["light", "dark"] : [s.theme];
  return (
    <div className={cn("grid gap-3", themes.length === 2 && "grid-cols-2")}>
      {themes.map((t) => (
        <div
          key={t}
          data-theme={t}
          data-accent={s.accent}
          data-force={s.force === "none" ? undefined : s.force}
          className={cn(
            "min-w-0 overflow-x-auto rounded-xl border border-line bg-app p-6 text-primary",
            s.grid && "debug-grid",
          )}
        >
          <StoryBoundary>{children()}</StoryBoundary>
        </div>
      ))}
    </div>
  );
}

/** 모달 견본: 버튼으로 띄우고 Esc로 닫는다 (모달이 바깥 클릭을 막기 때문) */
function IsolatedStory({ story }: { story: DebugStory }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);
  const { Component: Story } = story;
  return (
    <div className="flex items-center gap-3">
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        열어 보기
      </Button>
      <span className="text-caption text-tertiary">모달은 화면 전체를 덮어요. Esc로 닫아요.</span>
      {open ? (
        <StoryBoundary>
          <Story />
        </StoryBoundary>
      ) : null}
    </div>
  );
}

function ComponentBlock({
  entry,
  stories,
  s,
}: {
  entry: Entry;
  stories: DebugStory[];
  s: DebugSettings;
}) {
  return (
    // 화면 밖 견본은 그리지 않는다(content-visibility). 에디터 81개·노드 1.6만 개라 스크롤이 끊겼다:
    // 측정(1440×900, 150프레임) 평균 19.4ms → 9.8ms, 20ms 넘는 프레임 49 → 7
    <section
      id={`debug-${entry.id}`}
      className="debug-specimen grid scroll-mt-4 gap-4"
      style={OFFSCREEN_SKIP}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="font-mono text-h3 font-semibold">{entry.id}</h3>
        <span className="text-ui text-secondary">{entry.name}</span>
        <StatusBadge status={entry.status} />
        <span className="ml-auto text-caption text-tertiary">
          {entry.priority}
          {entry.sheet ? ` · 시트 ${entry.sheet}` : ""}
        </span>
      </header>
      {stories.map((story) => (
        <div key={story.key} className="grid gap-2">
          <h4 className="text-label font-medium text-secondary">{story.name}</h4>
          {story.isolate ? (
            <IsolatedStory story={story} />
          ) : (
            <ThemeColumns s={s}>{() => <story.Component />}</ThemeColumns>
          )}
        </div>
      ))}
    </section>
  );
}

function Toolbar({ s, update }: { s: DebugSettings; update: (p: Partial<DebugSettings>) => void }) {
  const select = cn(inputClass, "w-auto min-w-0 pr-8");
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-6 py-3">
      <Segmented<Theme>
        label="테마"
        value={s.theme}
        onValueChange={(theme) => update({ theme })}
        options={[
          { value: "light", label: "라이트" },
          { value: "dark", label: "다크" },
          { value: "both", label: "나란히" },
        ]}
      />
      <label className="flex items-center gap-2 text-caption text-secondary">
        포인트 색
        <select
          className={select}
          value={s.accent}
          onChange={(e) => update({ accent: e.target.value as DebugSettings["accent"] })}
        >
          {ACCENTS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-caption text-secondary">
        글꼴 크기
        <select
          className={select}
          value={s.scale}
          onChange={(e) => update({ scale: e.target.value as DebugSettings["scale"] })}
        >
          <option value="0.9">90%</option>
          <option value="1">100%</option>
          <option value="1.1">110%</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-caption text-secondary">
        폭
        <select
          className={select}
          value={s.width}
          onChange={(e) => update({ width: e.target.value as Width })}
        >
          <option value="full">창 그대로</option>
          <option value="1440">1440</option>
          <option value="1024">1024</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-caption text-secondary">
        상태 강제
        <select
          className={select}
          value={s.force}
          onChange={(e) => update({ force: e.target.value as Force })}
        >
          <option value="none">없음</option>
          <option value="hover">hover</option>
          <option value="active">active</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-caption text-secondary">
        <Switch checked={s.reduced} onCheckedChange={(reduced) => update({ reduced })} />
        모션 줄이기
      </label>
      <label className="flex items-center gap-2 text-caption text-secondary">
        <Switch checked={s.grid} onCheckedChange={(grid) => update({ grid })} />
        그리드
      </label>
      <SearchInput
        className="ml-auto w-60"
        placeholder="ID·이름 검색"
        aria-label="컴포넌트 검색"
        value={s.q}
        onValueChange={(q) => update({ q })}
      />
    </div>
  );
}

function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: "start" });
}

function Nav({ entries }: { entries: Entry[] }) {
  return (
    <nav
      aria-label="Debug 목차"
      className="flex w-64 shrink-0 flex-col border-r border-line bg-sidebar"
    >
      <div className="px-4 pt-4 pb-2 text-ui font-semibold">Debug</div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 px-2 pb-4">
          <NavLink target="debug-tokens">Tokens</NavLink>
          {LAYERS.map(({ layer, title }) => {
            const items = entries.filter((e) => e.layer === layer);
            if (!items.length) return null;
            return (
              <div key={layer} className="grid gap-0.5">
                <NavLink target={`debug-${layer}`} strong>
                  {title}
                </NavLink>
                {items.map((e) => (
                  <NavLink key={e.id} target={`debug-${e.id}`} status={e.status}>
                    {e.id}
                  </NavLink>
                ))}
              </div>
            );
          })}
          <NavLink target="debug-playground">Playground</NavLink>
          <NavLink target="debug-storage">저장 실험</NavLink>
        </div>
      </ScrollArea>
      <Summary />
    </nav>
  );
}

function NavLink({
  target,
  children,
  status,
  strong,
}: {
  target: string;
  children: ReactNode;
  status?: Status;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => jump(target)}
      className={cn(
        "flex min-h-7 items-center gap-2 rounded-md px-2 text-left text-caption hover:bg-hover",
        strong ? "font-semibold text-primary" : "text-secondary",
        status === "planned" && "text-tertiary",
      )}
    >
      <span className="truncate font-mono">{children}</span>
      {status ? (
        <span
          aria-label={STATUS_LABEL[status]}
          className={cn(
            "ml-auto size-2 shrink-0 rounded-pill",
            status === "planned" && "bg-active",
            status === "implemented" && "bg-orange-fg",
            status === "ready" && "bg-accent",
            status === "audited" && "bg-green-fg",
          )}
        />
      ) : null}
    </button>
  );
}

/** 계층별 Ready 수 / 전체 수 — 로드맵 게이트 판단용 */
function Summary() {
  return (
    <div className="grid gap-1 border-t border-line px-4 py-3 text-caption">
      <span className="font-semibold text-secondary">진행 요약 (Ready / 구현 / 전체)</span>
      {LAYERS.map(({ layer, title }) => {
        const all = ENTRIES.filter((e) => e.layer === layer);
        const ready = all.filter((e) => isReady(e.status)).length;
        const built = all.filter((e) => e.status !== "planned").length;
        return (
          <div key={layer} className="flex justify-between text-secondary">
            <span>{title}</span>
            <span className="font-mono tabular-nums">
              {ready} / {built} / {all.length}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 견본이 스스로 가져가는 포커스와 스크롤(autoFocus, 에디터 autofocus의 scrollIntoView)을 무시한다.
 * 견본이 수십 개라, 막지 않으면 마지막으로 포커스를 잡은 견본 위치로 화면이 내려가 버린다.
 * 사용자가 처음 누르거나·키를 치거나·휠을 굴릴 때까지만 막는다 — 그 뒤는 그대로 둔다.
 */
/** 견본 블록 높이를 모를 때 쓰는 자리 크기. 한 번 그려지면 브라우저가 실제 높이를 기억한다(auto) */
const OFFSCREEN_SKIP: CSSProperties = {
  contentVisibility: "auto",
  containIntrinsicSize: "auto 800px",
};

/**
 * 화면 밖 견본의 무한 애니메이션(로딩 스피너·미라 반짝임)을 멈춘다. 창이 가려져도 멈춘다.
 * Debug 화면을 띄워 두기만 해도 CPU를 쓰던 원인(무한 애니메이션 28개, 2026-11-19 측정).
 */
function usePauseOffscreenAnimations(
  main: React.RefObject<HTMLElement | null>,
  /** 견본 목록이 바뀔 때마다 다시 관찰한다(null이면 아직 안 그려짐) */
  listKey: string | null,
) {
  useEffect(() => {
    const box = main.current;
    if (!box || listKey === null) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.toggleAttribute("data-offscreen", !e.isIntersecting);
      },
      { root: box, rootMargin: "200px 0px" },
    );
    box.querySelectorAll(".debug-specimen").forEach((el) => io.observe(el));
    const onVisibility = () =>
      document.documentElement.toggleAttribute("data-debug-hidden", document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      document.documentElement.removeAttribute("data-debug-hidden");
    };
  }, [main, listKey]);
}

function useIgnoreSpecimenAutofocus(main: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const box = main.current;
    if (!box) return;
    const top = box.scrollTop;
    const onScroll = () => {
      if (box.scrollTop !== top) box.scrollTop = top;
    };
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && box.contains(e.target)) e.target.blur();
    };
    const userEvents = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    const stop = () => {
      document.removeEventListener("focusin", onFocus, true);
      box.removeEventListener("scroll", onScroll);
      for (const t of userEvents) window.removeEventListener(t, stop, true);
    };
    document.addEventListener("focusin", onFocus, true);
    box.addEventListener("scroll", onScroll, { passive: true });
    for (const t of userEvents) window.addEventListener(t, stop, { capture: true, passive: true });
    return stop;
  }, [main]);
}

export default function DebugScreen() {
  const [s, update] = useSettings();
  const [stories, setStories] = useState<Map<string, DebugStory[]> | null>(null);
  useRootAttributes(s);
  useWindowWidth(s.width);
  const mainRef = useRef<HTMLElement>(null);
  useIgnoreSpecimenAutofocus(mainRef);

  useEffect(() => {
    let alive = true;
    void loadStories().then((map) => alive && setStories(map));
    return () => {
      alive = false;
    };
  }, []);
  // 견본 블록이 다 그려진 뒤(stories) 관찰을 시작한다. 검색으로 목록이 바뀌어도 다시
  usePauseOffscreenAnimations(mainRef, stories ? s.q : null);

  const entries = useMemo(() => {
    const q = s.q.trim().toLowerCase();
    if (!q) return ENTRIES;
    return ENTRIES.filter(
      (e) => e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
    );
  }, [s.q]);

  return (
    <TooltipProvider>
      <PageIconProvider resolveImage={sampleResolveImage}>
        {/* relative·overflow-hidden: 안쪽의 sr-only(absolute) 글자가 body 기준으로 빠져나가 문서 전체가 스크롤되지 않게 */}
        <div className="relative flex h-(--fit-h) overflow-hidden bg-app text-primary">
          <Nav entries={entries} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Toolbar s={s} update={update} />
            <main ref={mainRef} className="relative min-h-0 flex-1 overflow-y-auto">
              <div
                className="mx-auto grid gap-12 px-6 py-8"
                style={s.width === "full" ? undefined : { maxWidth: `${s.width}px` }}
              >
                {!s.q ? (
                  <section id="debug-tokens" className="grid scroll-mt-4 gap-4">
                    <h2 className="text-h2 font-semibold">Tokens</h2>
                    <ThemeColumns s={s}>{() => <TokensSection />}</ThemeColumns>
                  </section>
                ) : null}

                {LAYERS.map(({ layer, title }) => {
                  const items = entries.filter((e) => e.layer === layer);
                  if (!items.length) return null;
                  const built = items.filter((e) => stories?.get(e.id)?.length);
                  const planned = items.filter((e) => !stories?.get(e.id)?.length);
                  return (
                    <section key={layer} id={`debug-${layer}`} className="grid scroll-mt-4 gap-10">
                      <h2 className="text-h2 font-semibold">{title}</h2>
                      {stories === null ? (
                        <p className="text-caption text-tertiary">스토리를 불러오는 중…</p>
                      ) : (
                        built.map((e) => (
                          <ComponentBlock
                            key={e.id}
                            entry={e}
                            stories={stories.get(e.id) ?? []}
                            s={s}
                          />
                        ))
                      )}
                      {stories && planned.length ? (
                        <div className="grid gap-2">
                          <h3 className="text-label font-semibold text-secondary">
                            아직 견본이 없는 컴포넌트 ({planned.length})
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {planned.map((e) => (
                              <span
                                key={e.id}
                                id={`debug-${e.id}`}
                                className="inline-flex scroll-mt-4 items-center gap-2 rounded-pill border border-line px-3 py-1 text-caption"
                              >
                                <span className="font-mono">{e.id}</span>
                                <span className="text-tertiary">{e.name}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </section>
                  );
                })}

                {!s.q ? (
                  <section id="debug-playground" className="grid scroll-mt-4 gap-4">
                    <h2 className="text-h2 font-semibold">Playground</h2>
                    <p className="text-caption text-secondary">
                      모든 블록이 들어간 문서예요. 단축 입력과 편집을 직접 확인해요.
                    </p>
                    <div
                      data-accent={s.accent}
                      className={cn(
                        "rounded-xl border border-line bg-app px-6 py-10",
                        s.grid && "debug-grid",
                      )}
                    >
                      <EditorSpecimen content={SAMPLE_DOC} label="Playground 문서" />
                    </div>
                  </section>
                ) : null}

                {!s.q ? (
                  <section id="debug-storage" className="grid scroll-mt-4 gap-4">
                    <h2 className="text-h2 font-semibold">저장 실험</h2>
                    <p className="text-caption text-secondary">
                      저장 계층(Phase 5)을 화면 없이 끝까지 확인해요. 편집이 멈추고 0.8초 뒤
                      저장돼요.
                    </p>
                    <StorageLab />
                  </section>
                ) : null}
              </div>
            </main>
          </div>
        </div>
      </PageIconProvider>
    </TooltipProvider>
  );
}
