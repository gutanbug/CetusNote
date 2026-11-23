import { currentPlatform, isModPressed } from "@/lib/platform-labels";
import {
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { pagesStore, usePages } from "@/features/pages";
import { searchIndex } from "@/features/search";
import { useMeta } from "@/features/meta";
import { markJump, sessionStore, useSession, type ThemePref } from "@/features/session";
import { openInRightPane } from "./split";
import {
  ArrowDownUp,
  Copy,
  History,
  CornerDownLeft,
  Download,
  Printer,
  FilePlus2,
  FileText,
  Focus,
  House,
  SquarePlus,
  Keyboard,
  LayoutTemplate,
  NotebookPen,
  CalendarDays,
  FileDown,
  Monitor,
  Moon,
  PanelLeft,
  Settings,
  Star,
  StarOff,
  Sun,
  Trash2,
  type LucideIcon,
  X,
  PanelRight,
  RefreshCw,
} from "lucide-react";
import { checkForUpdates } from "@/features/updater";
import * as React from "react";
import {
  openDailyNote,
  createIn,
  duplicatePage,
  exportMarkdown,
  exportPdf,
  moveToTrash,
  openPage,
  toggleFavorite,
  openQuickNote,
} from "./actions";
import { importDocuments } from "./import-document";
import { openImportAppPicker } from "./import-app-picker";
import { exportWorkspaceMarkdown } from "./export-workspace";
import { isCommandQuery, matchCommands, paletteItems, visibleIds } from "./palette-model";
import { closeTabAt, newTab } from "./tabs";
import { useMainUi } from "./ui-store";
import { PageIcon } from "@/components/ui/page-icon";

const ic = { strokeWidth: 1.5 } as const;

/** 강조 범위를 <mark>로 (OV-CommandPalette의 Highlight와 같은 모양) */
function Marked({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([a, b], i) => {
    if (a < at) return;
    parts.push(text.slice(at, a));
    parts.push(
      <mark
        key={i}
        // 단어 중간에서도 글자 사이가 벌어지지 않게 여백만큼 바깥 여백을 당긴다
        className="-mx-0.5 rounded-xs bg-accent-soft px-0.5 font-medium text-accent"
      >
        {text.slice(a, b)}
      </mark>,
    );
    at = b;
  });
  parts.push(text.slice(at));
  return <>{parts}</>;
}

type Command = {
  id: string;
  title: string;
  keywords?: string[];
  icon: LucideIcon;
  keys?: string[];
  run: () => void;
};

const THEMES: { value: ThemePref; title: string; icon: LucideIcon; keywords: string[] }[] = [
  {
    value: "light",
    title: "라이트 테마로 바꾸기",
    icon: Sun,
    keywords: ["theme", "light", "밝게"],
  },
  { value: "dark", title: "다크 테마로 바꾸기", icon: Moon, keywords: ["theme", "dark", "어둡게"] },
  {
    value: "system",
    title: "시스템 테마 따르기",
    icon: Monitor,
    keywords: ["theme", "system", "테마", "자동"],
  },
];

/** 팔레트에서 실행할 명령 (SRCH-02). 지금 상태에 맞는 것만 — 이미 켜진 테마는 빼고, 페이지 명령은 열린 페이지가 있을 때만 */
function useCommands(): Command[] {
  const pages = usePages((s) => s.pages);
  const activeId = useSession((s) => s.activeId);
  const theme = useSession((s) => s.appearance.theme);
  const collapsed = useSession((s) => s.sidebarCollapsed);
  const focusMode = useMainUi((s) => s.focusMode);
  const favorites = useMeta((s) => s.meta?.favorites);
  return React.useMemo(() => {
    const page =
      activeId && visibleIds(pages).has(activeId) && pages[activeId]?.kind === "page"
        ? pages[activeId]
        : undefined;
    const ui = useMainUi.getState();
    const list: Command[] = [
      {
        id: "home",
        title: "홈으로",
        keywords: ["home", "dashboard", "대시보드", "할 일"],
        icon: House,
        run: () => ui.setView({ kind: "home" }),
      },
      {
        id: "new-tab",
        title: "새 탭",
        keywords: ["tab", "new tab", "탭"],
        icon: SquarePlus,
        keys: ["⌘", "T"],
        run: () => newTab(),
      },
      {
        id: "close-tab",
        title: "탭 닫기",
        keywords: ["tab", "close", "탭"],
        icon: X,
        keys: ["⌘", "W"],
        run: () => closeTabAt(),
      },
      {
        id: "templates",
        title: "템플릿에서 새 페이지",
        keywords: ["template", "gallery", "템플릿", "회의록", "일일 노트"],
        icon: LayoutTemplate,
        keys: ["⌘", "⇧", "T"],
        run: () => ui.setTemplatesOpen(true),
      },
      {
        id: "pane-open",
        title: "오른쪽에 열기",
        keywords: ["split", "pane", "side", "오른쪽", "분할", "패널"],
        icon: PanelRight,
        keys: ["⌥", "⌘", "↵"],
        // 페이지 고르기 상태로 다시 연다 — 고른 페이지가 오른쪽 패널에 열린다
        run: () => {
          useMainUi.getState().setPalettePane(true);
          useMainUi.getState().setPaletteOpen(true);
        },
      },
      {
        id: "quick-note",
        title: "빠른 메모",
        keywords: ["quick", "note", "memo", "메모", "생각"],
        icon: NotebookPen,
        keys: ["⌘", "⇧", "N"],
        run: () => openQuickNote(),
      },
      {
        id: "daily-note",
        title: "오늘의 일일 노트",
        keywords: ["daily", "today", "journal", "오늘", "일기", "일지", "데일리"],
        icon: CalendarDays,
        keys: ["⌥", "⌘", "T"],
        run: () => openDailyNote(),
      },
      {
        id: "import-document",
        title: "문서 가져오기…",
        keywords: [
          "import",
          "document",
          "markdown",
          "md",
          "txt",
          "html",
          "docx",
          "pdf",
          "가져오기",
          "불러오기",
          "문서",
          "파일",
        ],
        icon: FileDown,
        run: () => void importDocuments(),
      },
      {
        id: "import-app",
        title: "다른 앱에서 가져오기…",
        keywords: [
          "import",
          "notion",
          "obsidian",
          "appflowy",
          "affine",
          "가져오기",
          "노션",
          "옵시디언",
          "앱",
        ],
        icon: FileDown,
        run: () => openImportAppPicker(),
      },
      {
        id: "export-workspace-markdown",
        title: "워크스페이스를 Markdown으로 내보내기",
        keywords: [
          "export",
          "markdown",
          "md",
          "workspace",
          "내보내기",
          "전체",
          "모두",
          "백업",
          "워크스페이스",
        ],
        icon: Download,
        run: () => void exportWorkspaceMarkdown(),
      },
      {
        id: "settings",
        title: "설정 열기",
        keywords: ["settings", "preferences", "환경설정"],
        icon: Settings,
        keys: ["⌘", ","],
        run: () => ui.openSettings(),
      },
      {
        id: "shortcuts",
        title: "단축키 보기",
        keywords: ["shortcuts", "keyboard", "키보드"],
        icon: Keyboard,
        run: () => ui.openSettings("shortcuts"),
      },
      {
        id: "check-update",
        title: "업데이트 확인",
        keywords: ["update", "upgrade", "version", "업데이트", "버전", "새 버전", "최신"],
        icon: RefreshCw,
        run: () => void checkForUpdates(),
      },
      ...THEMES.filter((t) => t.value !== theme).map((t) => ({
        id: `theme-${t.value}`,
        title: t.title,
        keywords: t.keywords,
        icon: t.icon,
        run: () => sessionStore.getState().setAppearance({ theme: t.value }),
      })),
      {
        id: "sidebar",
        title: collapsed ? "사이드바 펼치기" : "사이드바 접기",
        keywords: ["sidebar", "panel"],
        icon: PanelLeft,
        keys: ["⌘", "\\"],
        run: () => sessionStore.getState().toggleSidebar(),
      },
      {
        id: "focus",
        title: focusMode ? "집중 모드 끄기" : "집중 모드 켜기",
        keywords: ["focus", "zen", "집중"],
        icon: Focus,
        keys: ["⌘", "."],
        run: () => useMainUi.getState().setFocusMode(!focusMode),
      },
    ];
    if (page) {
      const fav = favorites?.includes(page.id);
      list.push(
        {
          id: "favorite",
          title: fav ? "즐겨찾기에서 빼기" : "즐겨찾기에 추가",
          keywords: ["favorite", "star", "즐겨찾기"],
          icon: fav ? StarOff : Star,
          run: () => toggleFavorite(page.id),
        },
        {
          id: "duplicate",
          title: "페이지 복제",
          keywords: ["duplicate", "copy", "복사"],
          icon: Copy,
          keys: ["⌘", "D"],
          run: () => void duplicatePage(page.id),
        },
        {
          id: "export",
          title: "Markdown으로 내보내기",
          keywords: ["export", "markdown", "md", "내보내기"],
          icon: Download,
          run: () => void exportMarkdown(page.id),
        },
        {
          id: "export-pdf",
          title: "PDF로 내보내기",
          keywords: ["export", "pdf", "print", "인쇄", "내보내기"],
          icon: Printer,
          run: () => void exportPdf(page.id),
        },
        // 버전 기록은 문서만 (DATA-09)
        ...(page.kind === "page"
          ? [
              {
                id: "history",
                title: "버전 기록",
                keywords: ["history", "version", "restore", "버전", "되돌리기", "기록"],
                icon: History,
                run: () => useMainUi.getState().setHistoryPageId(page.id),
              },
            ]
          : []),
        {
          id: "trash",
          title: "휴지통으로 옮기기",
          keywords: ["delete", "trash", "삭제", "지우기"],
          icon: Trash2,
          run: () => moveToTrash(page.id),
        },
      );
    }
    return list;
  }, [pages, activeId, theme, collapsed, focusMode, favorites]);
}

/** 열고 난 뒤 본문으로 (렌더가 끝난 다음 프레임) */
function focusBody() {
  setTimeout(
    () =>
      document
        .querySelector<HTMLElement>("[data-side=main] [data-slot=page-scroller] .ProseMirror")
        ?.focus(),
    0,
  );
}

/**
 * ⌘K 명령 팔레트 (SRCH-01·02) — 최근 문서, 제목·본문 검색(발췌문·강조·경로), 새 페이지, 명령.
 * `>`로 시작하면 명령만 찾는다.
 * 거르기는 cmdk가 아니라 메모리 검색 인덱스가 한다(ADR-003).
 */
export function CommandPalette() {
  const open = useMainUi((s) => s.paletteOpen);
  const setOpen = useMainUi((s) => s.setPaletteOpen);
  const pages = usePages((s) => s.pages);
  const [query, setQuery] = React.useState("");
  /** ⌥⌘Enter · ⌥⌘클릭으로 고른 결과를 오른쪽 패널에 연다 (SHELL-19) */
  const paneNext = React.useRef(false);
  const palettePane = useMainUi((s) => s.palettePane);
  // 닫을 때 돌아갈 곳 — 트리거 없는 대화상자라 Radix가 돌려주지 않는다
  const returnTo = React.useRef<HTMLElement | null>(null);
  const commandMode = isCommandQuery(query);
  const items = React.useMemo(
    () => (open && !commandMode ? paletteItems(query, pages, searchIndex) : []),
    [open, commandMode, query, pages],
  );
  const allCommands = useCommands();
  const commands = React.useMemo(() => matchCommands(query, allCommands), [query, allCommands]);
  const q = commandMode ? "" : query.trim();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useMainUi.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // 레이아웃 효과: Radix가 포커스를 대화상자 안으로 옮기기 전에 잡는다
  React.useLayoutEffect(() => {
    if (open) returnTo.current = document.activeElement as HTMLElement | null;
  }, [open]);

  const close = (restore: boolean) => {
    setOpen(false);
    paneNext.current = false;
    useMainUi.getState().setPalettePane(false);
    setQuery(""); // 다음에 열 때는 빈 검색어로
    const el = returnTo.current;
    returnTo.current = null;
    if (restore && el && el !== document.body) setTimeout(() => el.isConnected && el.focus(), 0);
  };
  const go = (id: string) => {
    // ⌥⌘로 골랐거나 "오른쪽에 열기" 다음이면 오른쪽 패널에 연다 (SHELL-19)
    const pane = paneNext.current || useMainUi.getState().palettePane;
    paneNext.current = false;
    if (pane) {
      close(false);
      openInRightPane(id);
      return;
    }
    // 검색 결과를 골랐으면 맨 위에서 연다 — 읽던 위치 복원보다 앞선다 (PAGE-15)
    if (q) markJump(id);
    close(false);
    openPage(id);
    focusBody();
  };
  /** 포커스를 원래 자리로 돌린 다음 실행한다 — 설정 같은 대화상자가 그 자리를 기억하도록 */
  const runCommand = (c: Command) => {
    close(true);
    setTimeout(c.run, 0);
  };
  const create = () => {
    close(false);
    const page = createIn(null);
    if (q) {
      pagesStore.getState().update(page.id, { title: q });
      focusBody();
    }
  };

  const createItem = (
    <CommandItem
      value="__create"
      onSelect={create}
      icon={<FilePlus2 {...ic} />}
      right={<Kbd keys={q ? ["⌘", "↵"] : ["⌘", "N"]} />}
    >
      {q ? `“${q}” 페이지 만들기` : "새 페이지"}
    </CommandItem>
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close(true))}
      shouldFilter={false}
      label="명령 팔레트"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={palettePane ? "오른쪽에 열 페이지를 고르세요" : "페이지 검색 · > 명령"}
        onKeyDown={(e) => {
          // ⌥⌘Enter: 고른 페이지를 오른쪽 패널에 연다 (목록의 Enter는 cmdk가 고른다)
          if (e.key === "Enter" && isModPressed(e, currentPlatform()) && e.altKey)
            paneNext.current = true;
          if (
            e.key === "Enter" &&
            (e.metaKey || e.ctrlKey) &&
            !e.altKey &&
            !e.nativeEvent.isComposing &&
            !commandMode
          ) {
            e.preventDefault();
            create();
          }
        }}
      />
      <CommandList>
        {commandMode ? (
          <CommandEmpty>맞는 명령이 없어요.</CommandEmpty>
        ) : q ? (
          <CommandEmpty>“{q}”에 맞는 페이지가 없어요.</CommandEmpty>
        ) : null}
        {items.length ? (
          <CommandGroup heading={q ? "결과" : "최근"}>
            {items.map((it) => (
              <CommandItem
                key={it.id}
                value={it.id}
                onSelect={() => go(it.id)}
                onMouseDown={(e) => {
                  paneNext.current = isModPressed(e, currentPlatform()) && e.altKey;
                }}
                icon={
                  it.icon ? (
                    <span aria-hidden className="w-4 shrink-0 text-center leading-none">
                      <PageIcon icon={it.icon} />
                    </span>
                  ) : (
                    <FileText {...ic} />
                  )
                }
                description={
                  it.path || it.snippet ? (
                    <>
                      {it.path}
                      {it.path && it.snippet ? " · " : null}
                      {it.snippet ? <Marked text={it.snippet} ranges={it.highlights} /> : null}
                    </>
                  ) : undefined
                }
              >
                <Marked
                  text={it.title || "제목 없음"}
                  ranges={it.title ? it.titleHighlights : []}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {!q && !commandMode && !items.length ? (
          <p className="px-4 py-6 text-center text-ui text-tertiary">아직 페이지가 없어요.</p>
        ) : null}
        <CommandGroup heading="명령" forceMount={!commandMode}>
          {/* 검색어가 있으면 맞는 명령이 먼저 — "가져오기"를 치고 Enter면 그 명령이 실행된다(만들기는 ⌘↵) */}
          {commandMode || q ? null : createItem}
          {commands.map((c) => (
            <CommandItem
              key={c.id}
              value={`__cmd-${c.id}`}
              onSelect={() => runCommand(c)}
              icon={<c.icon {...ic} />}
              right={c.keys ? <Kbd keys={c.keys} /> : undefined}
            >
              {c.title}
            </CommandItem>
          ))}
          {!commandMode && q ? createItem : null}
        </CommandGroup>
      </CommandList>
      <CommandFooter>
        <span>
          <ArrowDownUp {...ic} className="size-4" aria-hidden /> 이동
        </span>
        <span>
          <CornerDownLeft {...ic} className="size-4" aria-hidden /> 열기
        </span>
        <span>
          <Kbd keys={["Esc"]} /> 닫기
        </span>
      </CommandFooter>
    </CommandDialog>
  );
}
