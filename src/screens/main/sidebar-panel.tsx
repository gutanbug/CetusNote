import { PageIcon } from "@/components/ui/page-icon";
import { RemindersSidebarItem } from "./reminders-view";
import { TrashPopover, type TrashItem } from "@/components/page/trash-popover";
import { PageTree, type PageNode } from "@/components/shell/page-tree";
import type { DropPosition } from "@/components/shell/drop-indicator";
import { Sidebar } from "@/components/shell/sidebar";
import { SidebarFooter, type SidebarFooterProps } from "@/components/shell/sidebar-footer";
import { SidebarItem } from "@/components/shell/sidebar-item";
import { SidebarSection } from "@/components/shell/sidebar-section";
import { TagItem } from "@/components/shell/tag-item";
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { useMeta } from "@/features/meta";
import { pagesStore, planDrop, usePages } from "@/features/pages";
import { buildPageTree } from "@/features/pages/tree";
import { sessionStore, useSession } from "@/features/session";
import {
  shortenHome,
  switchErrorMessage,
  useWorkspace,
  workspaceStore,
} from "@/features/workspace";
import { formatAgo } from "@/lib/format-date";
import { hasOverlayTitleBar } from "@/lib/platform";
import { canReveal, revealInFinder } from "@/lib/storage/open-link";
import { currentPlatform, revealLabel } from "@/lib/platform-labels";
import {
  Clock,
  Copy,
  FilePlus,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  FolderSearch,
  House,
  LayoutTemplate,
  MoveHorizontal,
  PenLine,
  Plus,
  Search,
  Settings,
  Star,
  Table2,
  StarOff,
  Trash2,
  SquarePlus,
} from "lucide-react";
import * as React from "react";
import {
  createIn,
  dropPage,
  duplicatePage,
  moveToTrash,
  openPage,
  openRecent,
  purgeWithChildren,
  recordHome,
  restore,
  setBodyWidth,
  toggleFavorite,
  displayTitle,
} from "./actions";
import { openInNewTab, openPageFrom } from "./tabs";
import { MoveDialog } from "./move-dialog";
import { recentPages, visibleIds } from "./palette-model";
import { RenameDialog } from "./rename-dialog";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { toast } from "@/components/ui/toast";
import { useRestoreFocus } from "./use-restore-focus";
import { QuickNotePopover } from "./quick-note-popover";
import { countTags, tagColor } from "./tag-colors";
import { openTagMenuFromKey } from "./tag-ui";
import { openTagMenuAt, useTagUi } from "./tag-ui";
import { useMainUi } from "./ui-store";
import { useMessages } from "@/lib/i18n";

const ic = { strokeWidth: 1.5 } as const;

/** 토큰 기본 폭(--sidebar-w). 리사이저는 숫자 폭이 있어야 보인다 */
function defaultSidebarWidth(): number {
  const v = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--sidebar-w"),
  );
  return Number.isFinite(v) ? v : 0;
}

/** 메인 화면 사이드바 — 워크스페이스, 페이지 트리(폴더 포함), 휴지통·저장 상태 (SHELL-01, 05, 08, 14) */
/** 트리 콜백은 모듈 수준이라 렌더마다 새로 만들지 않는다 (SYS-10) */
const treeExpandedChange = (ids: string[]) => sessionStore.getState().setExpanded(ids);
const treeOpen = (id: string, o?: { newTab: boolean }) =>
  o?.newTab ? openInNewTab(id) : openPage(id);

/**
 * 저장 상태만 따로 구독한다 — 저장 상태가 바뀌어도(본문 입력마다) 사이드바 전체를 다시 그리지 않는다 (SYS-10)
 */
function SaveAwareFooter(props: Omit<SidebarFooterProps, "saveState">) {
  const saveState = usePages((s) => s.saveState);
  return <SidebarFooter {...props} saveState={saveState} />;
}

/**
 * SH-Sidebar 패널. 구조(structure)·순서(order)·펼침만 구독한다. 본문 입력은 여기를 다시 그리지 않는다 (SYS-10)
 */
function SidebarPanelImpl({ hidden = false }: { hidden?: boolean }) {
  const m = useMessages();
  // 사이드바는 구조만 쓴다 — 본문 입력마다 트리를 다시 만들지 않는다 (SYS-10)
  const pages = usePages((s) => s.structure);
  const folderName = useWorkspace((s) => s.workspace?.name ?? "");
  const workspacePath = useWorkspace((s) => s.workspace?.path ?? "");
  const metaName = useMeta((s) => s.meta?.name ?? "");
  const name = metaName || folderName;
  const recentIds = useSession((s) => s.recent);
  const view = useMainUi((s) => s.view);
  // 홈·태그 화면에서는 트리의 문서를 "지금 보는 곳"으로 칠하지 않는다
  const sessionActive = useSession((s) => s.activeId);
  const activeId = view.kind === "page" ? sessionActive : null;
  const expanded = useSession((s) => s.expanded);
  const width = useSession((s) => s.sidebarWidth);
  // 집중 모드는 저장된 접힘 상태를 건드리지 않고 잠깐 숨긴다
  const collapsed = useSession((s) => s.sidebarCollapsed) || hidden;
  const [trashOpen, setTrashOpen] = React.useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = React.useState(false);
  const recentWorkspaces = useWorkspace((s) => s.recent);
  const [renaming, setRenaming] = React.useState<string | null>(null);

  const order = useMeta((s) => s.meta?.order);
  const favoriteIds = useMeta((s) => s.meta?.favorites);
  const [moving, setMoving] = React.useState<string | null>(null);
  const tree = React.useMemo(() => buildPageTree(Object.values(pages), order), [pages, order]);
  const visible = React.useMemo(() => visibleIds(pages), [pages]);
  const pageCount = [...visible].filter((id) => pages[id]?.kind === "page").length;
  const workspaceDetail = [m.screens.sidebar.pageCount(pageCount), shortenHome(workspacePath)]
    .filter(Boolean)
    .join(" · ");
  const recent = recentPages(recentIds, pages, visible);
  const favorites = (favoriteIds ?? [])
    .map((id) => pages[id])
    .filter((p): p is NonNullable<typeof p> => !!p && visible.has(p.id));
  const canDropInTree = React.useCallback(
    (id: string, target: string, position: DropPosition) =>
      !!planDrop(pages, tree, id, target, position),
    [pages, tree],
  );
  const tagColors = useMeta((s) => s.meta?.tags);
  // 태그 섹션(SHELL-07): 보이는 문서에 붙은 태그만, 이름순(사이드바는 자리가 바뀌지 않게)
  const tags = React.useMemo(
    () =>
      countTags([...visible].map((id) => pages[id]!).filter((p) => p.kind === "page")).sort(
        (a, b) => a[0].localeCompare(b[0], "ko"),
      ),
    [visible, pages],
  );
  const trashed = React.useMemo(
    () =>
      Object.values(pages)
        .filter((p) => p.trashedAt)
        .sort((a, b) => b.trashedAt!.localeCompare(a.trashedAt!)),
    [pages],
  );
  const trashItems: TrashItem[] = trashed.map((p) => ({
    id: p.id,
    title: p.kind === "page" ? p.title : displayTitle(p),
    emoji: p.kind !== "folder" ? (p.icon ?? undefined) : undefined,
    deletedAt: formatAgo(p.trashedAt!),
  }));

  const newFolder = (parentId: string | null) => setRenaming(createIn(parentId, "folder").id);

  // 행의 ＋ — 섹션 ＋와 같은 메뉴. 컬렉션 아래에는 레코드(문서)만 두므로 새 폴더·새 컬렉션을 끈다
  const addMenu = (node: PageNode) => (
    <>
      <DropdownMenuItem icon={<FilePlus {...ic} />} onSelect={() => createIn(node.id)}>
        {node.kind === "collection" ? m.screens.sidebar.newRecord : m.screens.sidebar.newPage}
      </DropdownMenuItem>
      <DropdownMenuItem
        icon={<FolderPlus {...ic} />}
        disabled={node.kind === "collection"}
        onSelect={() => newFolder(node.id)}
      >
        {m.screens.sidebar.newFolder}
      </DropdownMenuItem>
      <DropdownMenuItem
        icon={<Table2 {...ic} />}
        disabled={node.kind === "collection"}
        onSelect={() => createIn(node.id, "collection")}
      >
        {m.screens.sidebar.newCollection}
      </DropdownMenuItem>
      {node.kind === "collection" ? (
        <p className="px-2 pt-1 pb-1.5 text-caption text-tertiary">
          {m.screens.sidebar.collectionHint}
        </p>
      ) : null}
    </>
  );

  const rowMenu = (node: PageNode) =>
    node.kind === "folder" ? (
      <>
        <DropdownMenuItem icon={<FilePlus {...ic} />} onSelect={() => createIn(node.id)}>
          {m.screens.sidebar.row.addPageToFolder}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<FolderPlus {...ic} />} onSelect={() => newFolder(node.id)}>
          {m.screens.sidebar.row.addSubfolder}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<PenLine {...ic} />} onSelect={() => setRenaming(node.id)}>
          {m.screens.sidebar.row.rename}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<FolderInput {...ic} />} onSelect={() => setMoving(node.id)}>
          {m.screens.sidebar.row.move}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* 안의 페이지가 따를 본문 폭 (SHELL-14). 전체 설정을 따르면 값을 비운다 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={<MoveHorizontal {...ic} />}>
            {m.screens.sidebar.row.bodyWidth}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={pages[node.id]?.layout.width ?? "inherit"}
              onValueChange={(v) =>
                setBodyWidth(node.id, v === "inherit" ? undefined : (v as "default" | "wide"))
              }
            >
              <DropdownMenuRadioItem value="inherit">
                {m.screens.sidebar.row.followDefault}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="default">
                {m.screens.sidebar.row.widthDefault}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="wide">
                {m.screens.sidebar.row.widthFull}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="danger"
          icon={<Trash2 {...ic} />}
          onSelect={() => moveToTrash(node.id)}
        >
          {m.screens.sidebar.row.trash}
        </DropdownMenuItem>
      </>
    ) : (
      <>
        <DropdownMenuItem icon={<SquarePlus {...ic} />} onSelect={() => openInNewTab(node.id)}>
          {m.screens.sidebar.row.openInNewTab}
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={favoriteIds?.includes(node.id) ? <StarOff {...ic} /> : <Star {...ic} />}
          onSelect={() => toggleFavorite(node.id)}
        >
          {favoriteIds?.includes(node.id)
            ? m.screens.sidebar.row.removeFromFavorites
            : m.screens.sidebar.row.addToFavorites}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Plus {...ic} />} onSelect={() => createIn(node.id)}>
          {m.screens.sidebar.row.addSubpage}
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<FolderPlus {...ic} />}
          disabled={node.kind === "collection"}
          onSelect={() => newFolder(node.id)}
        >
          {m.screens.sidebar.row.addSubfolder}
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<Copy {...ic} />}
          shortcut={<Kbd keys={["⌘", "D"]} />}
          onSelect={() => duplicatePage(node.id)}
        >
          {m.screens.sidebar.row.duplicate}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<FolderInput {...ic} />} onSelect={() => setMoving(node.id)}>
          {m.screens.sidebar.row.move}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="danger"
          icon={<Trash2 {...ic} />}
          onSelect={() => moveToTrash(node.id)}
        >
          {m.screens.sidebar.row.trash}
        </DropdownMenuItem>
      </>
    );

  const renamingPage = renaming ? pages[renaming] : undefined;
  // 이름 바꾸기 대화상자는 대상마다 다시 만들어지므로 포커스 복원은 여기서 한다
  useRestoreFocus(!!renamingPage);

  return (
    <>
      <Sidebar
        titleBarInset={hasOverlayTitleBar()}
        collapsed={collapsed}
        width={width ?? defaultSidebarWidth()}
        onWidthChange={(w) => sessionStore.getState().setSidebarWidth(w)}
        onWidthReset={() => sessionStore.getState().setSidebarWidth(null)}
        header={
          <WorkspaceSwitcher
            name={name}
            // 메뉴를 열 때마다 최근 목록을 새로 읽는다(다른 창·Finder에서 폴더가 없어졌을 수 있다)
            onOpenChange={(o) => o && void workspaceStore.getState().loadRecent()}
            // 워크스페이스 만들기·전환 (SHELL-15) — 지금 것이 목록에 아직 없으면(첫 실행 직후) 맨 앞에 둔다
            workspaces={(recentWorkspaces.some((w) => w.current)
              ? recentWorkspaces
              : [{ name, path: workspacePath, current: true }, ...recentWorkspaces]
            ).map((w) => ({
              id: w.path,
              name: w.current ? name : w.name,
              detail: w.current ? workspaceDetail : shortenHome(w.path),
              current: w.current,
              onSelect: w.current
                ? undefined
                : () =>
                    void workspaceStore
                      .getState()
                      .switchTo(w.path)
                      .catch((e) => toast.error(switchErrorMessage(w.name, e))),
              // 목록에서 빼기 (SHELL-16) — 폴더는 그대로 둔다
              onRemove: w.current
                ? undefined
                : () =>
                    void workspaceStore
                      .getState()
                      .forget(w.path)
                      .then(() => toast(m.screens.sidebar.removed(w.name)))
                      .catch(() => toast.error(m.screens.sidebar.removeFail)),
            }))}
            onCreate={() => setCreatingWorkspace(true)}
            onOpenFolder={() => void workspaceStore.getState().pick()}
          >
            <DropdownMenuItem
              icon={<Settings {...ic} />}
              shortcut={<Kbd keys={["⌘", ","]} />}
              onSelect={() => useMainUi.getState().openSettings()}
            >
              {m.screens.sidebar.settings}
            </DropdownMenuItem>
            {canReveal() ? (
              <DropdownMenuItem
                icon={<FolderSearch {...ic} />}
                onSelect={() => void revealInFinder(workspacePath)}
              >
                {revealLabel(currentPlatform())}
              </DropdownMenuItem>
            ) : null}
          </WorkspaceSwitcher>
        }
        footer={
          <SaveAwareFooter
            trashCount={trashed.length}
            // 열려 있을 때 누르면 바깥 클릭으로 닫힌 뒤 다시 열리지 않게 — 여는 것만 한다
            onOpenTrash={() => setTrashOpen(true)}
            onRetrySave={() => void pagesStore.getState().retry()}
          >
            <QuickNotePopover />
            <TrashPopover
              open={trashOpen}
              onOpenChange={(open) => {
                setTrashOpen(open);
                // 트리거 없이 위치만 잡은 팝오버라 닫힐 때 포커스를 휴지통 항목으로 돌려준다
                // (바깥을 눌러 닫았으면 그쪽에 포커스가 있으니 건드리지 않는다)
                if (!open)
                  setTimeout(() => {
                    const lost =
                      !document.activeElement || document.activeElement === document.body;
                    if (lost)
                      document
                        .querySelector<HTMLElement>(
                          '[data-slot=sidebar-footer] [aria-haspopup="dialog"]',
                        )
                        ?.focus();
                  });
              }}
              items={trashItems}
              onRestore={restore}
              onPurge={(id) => void purgeWithChildren(id)}
            />
          </SaveAwareFooter>
        }
      >
        <SidebarSection title={m.screens.sidebar.quickActions} untitled>
          <SidebarItem
            icon={House}
            label={m.screens.sidebar.home}
            active={view.kind === "home"}
            aria-current={view.kind === "home" ? "page" : undefined}
            onClick={() => useMainUi.getState().setView({ kind: "home" })}
          />
          <RemindersSidebarItem active={view.kind === "reminders"} />
          <SidebarItem
            icon={Search}
            label={m.screens.sidebar.search}
            shortcut={["⌘", "K"]}
            aria-haspopup="dialog"
            onClick={() => useMainUi.getState().setPaletteOpen(true)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarItem icon={Clock} label={m.screens.sidebar.recent} />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-64">
              {recent.length ? (
                recent.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    icon={
                      p.icon ? (
                        <span aria-hidden className="w-4 text-center leading-none">
                          <PageIcon icon={p.icon} />
                        </span>
                      ) : p.kind === "collection" ? (
                        <Table2 {...ic} />
                      ) : (
                        <FileText {...ic} />
                      )
                    }
                    shortcut={recordHome(p, pages)}
                    onSelect={() => openRecent(p.id)}
                  >
                    <span className="truncate">{displayTitle(p)}</span>
                  </DropdownMenuItem>
                ))
              ) : (
                <p className="px-2 py-1 text-caption text-tertiary">{m.screens.sidebar.noRecent}</p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* 설정은 워크스페이스 메뉴(⌘,)에만 둔다 — 2026-11-20 사용자 요청 */}
          <SidebarItem
            icon={Plus}
            label={m.screens.sidebar.newPage}
            shortcut={["⌘", "N"]}
            onClick={() => createIn(null)}
          />
          <SidebarItem
            icon={LayoutTemplate}
            label={m.screens.sidebar.templates}
            shortcut={["⌘", "⇧", "T"]}
            aria-haspopup="dialog"
            onClick={() => useMainUi.getState().setTemplatesOpen(true)}
          />
        </SidebarSection>
        {favorites.length ? (
          <SidebarSection title={m.screens.sidebar.favorites}>
            {favorites.map((p) => (
              <SidebarItem
                key={p.id}
                // 트리와 같은 기본 아이콘 — 컬렉션은 표, 폴더는 폴더
                icon={p.kind === "collection" ? Table2 : p.kind === "folder" ? Folder : FileText}
                emoji={p.kind !== "folder" ? (p.icon ?? undefined) : undefined}
                label={displayTitle(p)}
                active={p.id === activeId}
                aria-current={p.id === activeId ? "page" : undefined}
                onClick={(e) => openPageFrom(p.id, e)}
              />
            ))}
          </SidebarSection>
        ) : null}
        <SidebarSection
          // 지금 워크스페이스의 문서 트리 — 문서 하나(페이지)와 헷갈리지 않게 "문서" (SHELL-15)
          title={m.screens.sidebar.documents}
          action={{
            label: m.screens.sidebar.add,
            icon: Plus,
            alwaysVisible: true,
            menu: (
              <>
                <DropdownMenuItem
                  icon={<FilePlus {...ic} />}
                  shortcut={<Kbd keys={["⌘", "N"]} />}
                  onSelect={() => createIn(null)}
                >
                  {m.screens.sidebar.newPage}
                </DropdownMenuItem>
                <DropdownMenuItem icon={<FolderPlus {...ic} />} onSelect={() => newFolder(null)}>
                  {m.screens.sidebar.newFolder}
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<Table2 {...ic} />}
                  onSelect={() => createIn(null, "collection")}
                >
                  {m.screens.sidebar.newCollection}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon={<LayoutTemplate {...ic} />}
                  shortcut={<Kbd keys={["⌘", "⇧", "T"]} />}
                  onSelect={() => useMainUi.getState().setTemplatesOpen(true)}
                >
                  {m.screens.sidebar.fromTemplate}
                </DropdownMenuItem>
              </>
            ),
          }}
        >
          {tree.length ? (
            <PageTree
              pages={tree}
              canDrop={canDropInTree}
              onDrop={dropPage}
              activeId={activeId ?? undefined}
              expanded={expanded}
              onExpandedChange={treeExpandedChange}
              onOpen={treeOpen}
              addMenu={addMenu}
              rowMenu={rowMenu}
            />
          ) : (
            // 섹션 제목 글자(화살표 자리 뒤)와 줄을 맞춘다
            <p className="py-1 pr-2 pl-6.5 text-caption text-tertiary">
              {m.screens.sidebar.noPages}
            </p>
          )}
        </SidebarSection>
        {tags.length ? (
          <SidebarSection title={m.screens.sidebar.tags}>
            {tags.map(([tag, count]) => {
              const active = view.kind === "tag" && view.tag === tag;
              return (
                <TagItem
                  key={tag}
                  data-tag-anchor={tag}
                  name={tag}
                  color={tagColor(tagColors?.[tag])}
                  count={count}
                  active={active}
                  onClick={() => useMainUi.getState().setView({ kind: "tag", tag })}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    useTagUi.getState().openMenu(tag, e.clientX, e.clientY, e.currentTarget);
                  }}
                  onKeyDown={(e) => openTagMenuFromKey(tag, e)}
                  onMenu={(row) => openTagMenuAt(tag, row)}
                />
              );
            })}
          </SidebarSection>
        ) : null}
      </Sidebar>
      <CreateWorkspaceDialog open={creatingWorkspace} onOpenChange={setCreatingWorkspace} />
      <MoveDialog pageId={moving} onOpenChange={(o) => !o && setMoving(null)} />
      <RenameDialog
        key={renaming ?? "none"}
        open={!!renamingPage}
        initial={renamingPage?.title ?? ""}
        onOpenChange={(o) => !o && setRenaming(null)}
        onSubmit={(title) => renaming && pagesStore.getState().update(renaming, { title })}
      />
    </>
  );
}

/** 본문만 고친 입력에는 다시 그리지 않는다 — props(hidden)만 본다 (SYS-10) */
export const SidebarPanel = React.memo(SidebarPanelImpl);
