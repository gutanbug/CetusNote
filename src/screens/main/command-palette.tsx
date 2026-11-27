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
import {
  ArrowDownUp,
  Bell,
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
  RefreshCw,
  ScrollText,
} from "lucide-react";
import { checkForUpdates } from "@/features/updater";
import { openWhatsNewForCurrent } from "@/features/release-notes";
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
import type { Page } from "@/lib/storage";
import { useMessages } from "@/lib/i18n";

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

type ThemeTitleKey = "lightTheme" | "darkTheme" | "systemTheme";
const THEMES: {
  value: ThemePref;
  titleKey: ThemeTitleKey;
  icon: LucideIcon;
  keywords: string[];
}[] = [
  {
    value: "light",
    titleKey: "lightTheme",
    icon: Sun,
    keywords: ["theme", "light", "밝게"], // i18n-ignore
  },
  { value: "dark", titleKey: "darkTheme", icon: Moon, keywords: ["theme", "dark", "어둡게"] }, // i18n-ignore
  {
    value: "system",
    titleKey: "systemTheme",
    icon: Monitor,
    keywords: ["theme", "system", "테마", "자동"], // i18n-ignore
  },
];

const NO_PAGES: Record<string, Page> = {};

/** 팔레트에서 실행할 명령 (SRCH-02). 지금 상태에 맞는 것만 — 이미 켜진 테마는 빼고, 페이지 명령은 열린 페이지가 있을 때만 */
function useCommands(): Command[] {
  const m = useMessages();
  const pages = usePages((s) => s.structure);
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
        title: m.screens.palette.cmd.home,
        keywords: ["home", "dashboard", "대시보드", "할 일"], // i18n-ignore
        icon: House,
        run: () => ui.setView({ kind: "home" }),
      },
      {
        id: "reminders",
        title: m.screens.remindersView.paletteTitle,
        keywords: ["reminder", "alarm", "timer", "알림", "타이머"], // i18n-ignore
        icon: Bell,
        run: () => ui.setView({ kind: "reminders" }),
      },
      {
        id: "new-tab",
        title: m.screens.palette.cmd.newTab,
        keywords: ["tab", "new tab", "탭"], // i18n-ignore
        icon: SquarePlus,
        keys: ["⌘", "T"],
        run: () => newTab(),
      },
      {
        id: "close-tab",
        title: m.screens.palette.cmd.closeTab,
        keywords: ["tab", "close", "탭"], // i18n-ignore
        icon: X,
        keys: ["⌘", "W"],
        run: () => closeTabAt(),
      },
      {
        id: "templates",
        title: m.screens.palette.cmd.templateNewPage,
        keywords: ["template", "gallery", "템플릿", "회의록", "일일 노트"], // i18n-ignore
        icon: LayoutTemplate,
        keys: ["⌘", "⇧", "T"],
        run: () => ui.setTemplatesOpen(true),
      },
      {
        id: "quick-note",
        title: m.screens.palette.cmd.quickNote,
        keywords: ["quick", "note", "memo", "메모", "생각"], // i18n-ignore
        icon: NotebookPen,
        keys: ["⌘", "⇧", "N"],
        run: () => openQuickNote(),
      },
      {
        id: "daily-note",
        title: m.screens.palette.cmd.todayDaily,
        keywords: ["daily", "today", "journal", "오늘", "일기", "일지", "데일리"], // i18n-ignore
        icon: CalendarDays,
        keys: ["⌥", "⌘", "T"],
        run: () => openDailyNote(),
      },
      {
        id: "import-document",
        title: m.screens.palette.cmd.importDocs,
        keywords: [
          "import",
          "document",
          "markdown",
          "md",
          "txt",
          "html",
          "docx",
          "pdf",
          "가져오기", // i18n-ignore
          "불러오기", // i18n-ignore
          "문서", // i18n-ignore
          "파일", // i18n-ignore
        ],
        icon: FileDown,
        run: () => void importDocuments(),
      },
      {
        id: "import-app",
        title: m.screens.palette.cmd.importApps,
        keywords: [
          "import",
          "notion",
          "obsidian",
          "appflowy",
          "affine",
          "가져오기", // i18n-ignore
          "노션", // i18n-ignore
          "옵시디언", // i18n-ignore
          "앱", // i18n-ignore
        ],
        icon: FileDown,
        run: () => openImportAppPicker(),
      },
      {
        id: "export-workspace-markdown",
        title: m.screens.palette.cmd.exportWorkspace,
        keywords: [
          "export",
          "markdown",
          "md",
          "workspace",
          "내보내기", // i18n-ignore
          "전체", // i18n-ignore
          "모두", // i18n-ignore
          "백업", // i18n-ignore
          "워크스페이스", // i18n-ignore
        ],
        icon: Download,
        run: () => void exportWorkspaceMarkdown(),
      },
      {
        id: "settings",
        title: m.screens.palette.cmd.openSettings,
        keywords: ["settings", "preferences", "환경설정"], // i18n-ignore
        icon: Settings,
        keys: ["⌘", ","],
        run: () => ui.openSettings(),
      },
      {
        id: "shortcuts",
        title: m.screens.palette.cmd.shortcuts,
        keywords: ["shortcuts", "keyboard", "키보드"], // i18n-ignore
        icon: Keyboard,
        run: () => ui.openSettings("shortcuts"),
      },
      {
        id: "check-update",
        title: m.screens.palette.cmd.checkUpdate,
        keywords: ["update", "upgrade", "version", "업데이트", "버전", "새 버전", "최신"], // i18n-ignore
        icon: RefreshCw,
        run: () => void checkForUpdates(),
      },
      {
        id: "release-notes",
        title: m.screens.palette.cmd.releaseNotes,
        keywords: [
          "release notes",
          "changelog",
          "what's new",
          "update",
          "릴리스", // i18n-ignore
          "업데이트 내용", // i18n-ignore
          "변경", // i18n-ignore
          "새 기능", // i18n-ignore
        ],
        icon: ScrollText,
        run: () => void openWhatsNewForCurrent(),
      },
      ...THEMES.filter((t) => t.value !== theme).map((t) => ({
        id: `theme-${t.value}`,
        title: m.screens.palette.cmd[t.titleKey],
        keywords: t.keywords,
        icon: t.icon,
        run: () => sessionStore.getState().setAppearance({ theme: t.value }),
      })),
      {
        id: "sidebar",
        title: collapsed
          ? m.screens.palette.cmd.expandSidebar
          : m.screens.palette.cmd.collapseSidebar,
        keywords: ["sidebar", "panel"],
        icon: PanelLeft,
        keys: ["⌘", "\\"],
        run: () => sessionStore.getState().toggleSidebar(),
      },
      {
        id: "focus",
        title: focusMode ? m.screens.palette.cmd.focusOff : m.screens.palette.cmd.focusOn,
        keywords: ["focus", "zen", "집중"], // i18n-ignore
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
          title: fav ? m.screens.palette.cmd.unfavorite : m.screens.palette.cmd.favorite,
          keywords: ["favorite", "star", "즐겨찾기"], // i18n-ignore
          icon: fav ? StarOff : Star,
          run: () => toggleFavorite(page.id),
        },
        {
          id: "duplicate",
          title: m.screens.palette.cmd.duplicate,
          keywords: ["duplicate", "copy", "복사"], // i18n-ignore
          icon: Copy,
          keys: ["⌘", "D"],
          run: () => void duplicatePage(page.id),
        },
        {
          id: "export",
          title: m.screens.palette.cmd.exportMd,
          keywords: ["export", "markdown", "md", "내보내기"], // i18n-ignore
          icon: Download,
          run: () => void exportMarkdown(page.id),
        },
        {
          id: "export-pdf",
          title: m.screens.palette.cmd.exportPdf,
          keywords: ["export", "pdf", "print", "인쇄", "내보내기"], // i18n-ignore
          icon: Printer,
          run: () => void exportPdf(page.id),
        },
        // 버전 기록은 문서만 (DATA-09)
        ...(page.kind === "page"
          ? [
              {
                id: "history",
                title: m.screens.palette.cmd.history,
                keywords: ["history", "version", "restore", "버전", "되돌리기", "기록"], // i18n-ignore
                icon: History,
                run: () => useMainUi.getState().setHistoryPageId(page.id),
              },
            ]
          : []),
        {
          id: "trash",
          title: m.screens.palette.cmd.trash,
          keywords: ["delete", "trash", "삭제", "지우기"], // i18n-ignore
          icon: Trash2,
          run: () => moveToTrash(page.id),
        },
      );
    }
    return list;
  }, [pages, activeId, theme, collapsed, focusMode, favorites, m]);
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
  const m = useMessages();
  const open = useMainUi((s) => s.paletteOpen);
  const setOpen = useMainUi((s) => s.setPaletteOpen);
  // 팔레트가 닫혀 있으면 본문 변경(타이핑)에 다시 그리지 않는다 (SYS-10)
  const pages = usePages((s) => (open ? s.pages : NO_PAGES));
  const [query, setQuery] = React.useState("");
  /** 지금 강조된 행 — 아래 Enter 힌트가 "열기"인지 "만들기"인지 정한다 */
  const [active, setActive] = React.useState("");
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
    setQuery(""); // 다음에 열 때는 빈 검색어로
    const el = returnTo.current;
    returnTo.current = null;
    if (restore && el && el !== document.body) setTimeout(() => el.isConnected && el.focus(), 0);
  };
  const go = (id: string) => {
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
      title={q ? m.screens.palette.createPage(q) : m.screens.palette.newPage}
    >
      {q ? m.screens.palette.createPage(q) : m.screens.palette.newPage}
    </CommandItem>
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close(true))}
      shouldFilter={false}
      label={m.screens.palette.label}
      value={active}
      onValueChange={setActive}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={m.screens.palette.placeholder}
        onKeyDown={(e) => {
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
          <CommandEmpty>{m.screens.palette.emptyCommands}</CommandEmpty>
        ) : q ? (
          <CommandEmpty>{m.screens.palette.emptyQuery(q)}</CommandEmpty>
        ) : null}
        {items.length ? (
          <CommandGroup heading={q ? m.screens.palette.results : m.screens.palette.recent}>
            {items.map((it) => (
              <CommandItem
                key={it.id}
                value={it.id}
                onSelect={() => go(it.id)}
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
                title={it.title || m.screens.palette.untitled}
              >
                <Marked
                  text={it.title || m.screens.palette.untitled}
                  ranges={it.title ? it.titleHighlights : []}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {!q && !commandMode && !items.length ? (
          <p className="px-4 py-6 text-center text-ui text-tertiary">{m.screens.palette.noPages}</p>
        ) : null}
        <CommandGroup heading={m.screens.palette.commandsHeading} forceMount={!commandMode}>
          {/* 검색어가 있으면 맞는 명령이 먼저 — "가져오기"를 치고 Enter면 그 명령이 실행된다(만들기는 ⌘↵) */}
          {commandMode || q ? null : createItem}
          {commands.map((c) => (
            <CommandItem
              key={c.id}
              value={`__cmd-${c.id}`}
              onSelect={() => runCommand(c)}
              icon={<c.icon {...ic} />}
              right={c.keys ? <Kbd keys={c.keys} /> : undefined}
              title={c.title}
            >
              {c.title}
            </CommandItem>
          ))}
          {!commandMode && q ? createItem : null}
        </CommandGroup>
      </CommandList>
      <CommandFooter>
        <span>
          <ArrowDownUp {...ic} className="size-4" aria-hidden /> {m.screens.palette.move}
        </span>
        <span>
          <CornerDownLeft {...ic} className="size-4" aria-hidden />{" "}
          {active === "__create" ? m.screens.palette.create : m.screens.palette.open}
        </span>
        <span>
          <Kbd keys={["Esc"]} /> {m.screens.palette.close}
        </span>
      </CommandFooter>
    </CommandDialog>
  );
}
