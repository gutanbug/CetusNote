import { enterPage, leavePage } from "./page-leave";
import type { Editor } from "@tiptap/core";
import { usePageIconProps } from "./page-icon-props";
import { NoteEditor } from "@/components/editor/note-editor";
import { Backlinks, type BacklinkItem } from "@/components/page/backlinks";
import { EmptyStart } from "@/components/page/empty-start";
import { PageHeader } from "@/components/page/page-header";
import { TemplateBar } from "@/components/page/template-bar";
import { TEMPLATE_CATEGORIES } from "@/features/templates";
import { Properties } from "@/components/page/properties";
import { Breadcrumb } from "@/components/shell/breadcrumb";
import { TopBar } from "@/components/shell/top-bar";
import { useAssetUrl } from "@/features/assets";
import { useMeta } from "@/features/meta";
import { SkyMark } from "@/screens/main/sky-mark";
import { pagesStore, resolveBodyWidth, usePages } from "@/features/pages";
import { backlinksIn, useSummaryVersion } from "@/features/pages/summary";
import { sessionStore, useSession } from "@/features/session";
import { formatAgo, formatDate } from "@/lib/format-date";
import type { Page } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { FindBar } from "@/components/editor/find-bar";
import {
  currentHeading,
  getHeadings,
  goToHeading,
  type Heading,
} from "@/components/editor/outline";
import { OutlineItems } from "@/components/ui/outline";
import { docToMarkdown, type MdNode } from "@/features/export";
import { toast } from "@/components/ui/toast";
import type { JSONContent } from "@tiptap/core";
import { normalizeDocCodeLanguages } from "@/lib/code-language";
import * as React from "react";
import {
  ancestors,
  createSubpageOf,
  displayTitle,
  isBlankDoc,
  toggleFavorite,
  updateTemplateInfo,
} from "./actions";
import { MoveDialog } from "./move-dialog";
import { PageMenu } from "./page-menu";
import { TagEditor } from "./tag-editor";
import { openPageFrom } from "./tabs";
import { useTopBarTitleBar } from "./use-tab-bar";
import { useMainUi } from "./ui-store";
import { recordFields } from "./record-fields";
import { usePagePosition } from "./page-position";
import {
  addTag,
  openEditorLink,
  removeTag,
  usePageBreadcrumb,
  usePageAttachments,
  usePageImages,
  usePageMentions,
  usePageSubpages,
  usePageTags,
} from "./page-editing";

/** 1분마다 다시 그려 "n분 전 편집"을 맞춘다 */
function useMinuteTick() {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
}

/**
 * 백링크 (PAGE-09). 지금 페이지만 바뀐 경우(본문을 치는 중)는 다시 찾지 않는다 —
 * 자기 글은 자기 백링크에 들어가지 않으므로 결과가 같다.
 */
function useBacklinks(id: string, all: Record<string, Page>): BacklinkItem[] {
  // 본문 요약(SYS-10, ADR-022)으로 찾는다. 요약이 더 채워지면(version) 다시 찾는다
  const version = useSummaryVersion();
  const find = () =>
    backlinksIn(id, all).map((b) => ({
      id: b.page.id,
      title: b.page.title,
      emoji: b.page.icon,
      count: b.count,
      snippets: b.snippets,
    }));
  const [seen, setSeen] = React.useState(() => ({ id, all, version, items: find() }));
  const onlySelfChanged =
    seen.all === all ||
    (Object.keys(seen.all).length === Object.keys(all).length &&
      Object.entries(all).every(([k, v]) => k === id || seen.all[k] === v));
  if (seen.id !== id || seen.version !== version || !onlySelfChanged) {
    // 렌더 중에 이전 값과 비교해 맞춘다(설정 대화상자와 같은 방식)
    const next = { id, all, version, items: find() };
    setSeen(next);
    return next.items;
  }
  return seen.items;
}

/**
 * 본문 — 상단 바(경로·편집 시각) + 페이지 머리 + 속성 + 에디터 (SHELL-09).
 */
export function PageView({ page }: { page: Page }) {
  const iconProps = usePageIconProps(page);
  useMinuteTick();
  const all = usePages((s) => s.pages);
  const collapsed = useSession((s) => s.sidebarCollapsed);
  const focusMode = useMainUi((s) => s.focusMode);
  const titleBar = useTopBarTitleBar();
  const setFocusMode = useMainUi((s) => s.setFocusMode);
  // 페이지 안 찾기 (EDIT-25): 본문 에디터를 받아 둔다. 페이지를 떠나면 닫는다
  const find = useMainUi((s) => s.find);
  const closeFind = useMainUi((s) => s.closeFind);
  const [findEditor, setFindEditor] = React.useState<Editor | null>(null);
  // 페이지를 떠나면 찾기·목차를 닫는다. 바깥 변경으로 같은 페이지의 화면이 다시 만들어질 때는 닫지 않는다 (page-leave.ts)
  const pageId = page.id;
  React.useEffect(() => {
    enterPage(pageId);
    return () =>
      leavePage(pageId, () => {
        const ui = useMainUi.getState();
        ui.closeFind();
        ui.setOutlineOpen(false);
      });
  }, [pageId]);
  // 목차 (PAGE-12) — 상단 바 메뉴. ⌥⌘O로도 연다
  const outlineOpen = useMainUi((s) => s.outlineOpen);
  const setOutlineOpen = (open: boolean) => useMainUi.getState().setOutlineOpen(open);
  // 고른 제목 — 메뉴가 닫힌 뒤(포커스 가둠이 풀린 뒤)에 그리로 간다
  const picked = React.useRef<Heading | null>(null);
  const [scrolled, setScrolled] = React.useState(false);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const { update } = pagesStore.getState();
  // 본문 에디터 (SYS-11): 에디터는 처음 받은 본문으로 만들어지고 그 뒤로는 스스로 문서를 갖는다.
  // 그래서 처음 본문과 고정된 콜백만 넘겨, 글자를 칠 때(페이지 객체가 바뀔 때) 에디터 쪽은 다시 그리지 않는다.
  // 바깥 변경·기록 복원은 부르는 쪽이 key로 이 화면을 새로 만든다
  const [initialContent] = React.useState(() =>
    normalizeDocCodeLanguages(page.content as JSONContent),
  );
  const onBodyChange = React.useCallback(
    (content: JSONContent) => update(pageId, { content: content as Page["content"] }),
    [update, pageId],
  );
  const createSubpage = React.useCallback(() => createSubpageOf(pageId).id, [pageId]);

  const crumbs = [...ancestors(page.id, all).reverse(), page].map((p) => ({
    id: p.id,
    title: displayTitle(p),
    emoji: p.kind !== "folder" ? (p.icon ?? undefined) : undefined,
  }));
  // 이미지 (EDIT-14) — 에디터는 경로만 알고, 읽기·저장·고르기는 이 함수들로
  const editorPrefs = useSession((s) => s.editor);
  // 본문 폭(PAGE-05·SHELL-14·SET-03): 페이지 → 상위 폴더 → 전체 설정 순서로 정한다
  const structure = usePages((s) => s.structure);
  const defaultWide = useSession((s) => s.appearance.defaultWide);
  const wide = resolveBodyWidth(page.id, structure, defaultWide).width === "wide";
  const images = usePageImages(page.id);
  const attachments = usePageAttachments(page.id);
  const coverUrl = useAssetUrl(page.cover);
  // 커버 (PAGE-03): 고르면 이 페이지 assets에 복사해 경로를 기록한다. 옛 파일은 지우지 않는다(실행 취소·복제가 쓸 수 있게)
  const chooseCover = () => void images.pick().then((cover) => cover && update(page.id, { cover }));

  // 페이지 멘션 (EDIT-13) — 에디터는 이 함수들로 찾고 제목을 읽고 연다
  const backlinks = useBacklinks(page.id, all);
  const mentions = usePageMentions(page.id);
  // 하위 페이지·경로 표시 블록 (EDIT-29, EDIT-30) — 구조를 구독해 이름·휴지통 변화를 바로 반영한다
  const subpages = usePageSubpages();
  const breadcrumb = usePageBreadcrumb(page.id);
  const favorite = useMeta((s) => s.meta?.favorites.includes(page.id) ?? false);
  const [moving, setMoving] = React.useState(false);
  // "빈 페이지로 시작"을 누른 페이지 — 안내를 닫는다(이 화면을 연 동안만. 다시 열면 비어 있으면 또 보인다)
  const [blankStarted, setBlankStarted] = React.useState<string | null>(null);
  const empty = isBlankDoc(page.content) && blankStarted !== page.id;
  // 제목 → 본문. DOM focus()만 하면 새 빈 문서는 "전체 선택"으로 남아 Tab·입력이 엉킨다 — 글자 칸에 캐럿을 둔다
  const focusEditor = () => {
    const dom = bodyRef.current?.querySelector<HTMLElement & { editor?: Editor }>(".ProseMirror");
    const editor = dom?.editor;
    if (!editor) return dom?.focus();
    const sel = editor.state.selection;
    editor.commands.focus(sel.empty && sel.$from.parent.inlineContent ? null : "start");
  };
  const { allTags, tags } = usePageTags(page);
  // 읽던 위치 (PAGE-15): 스크롤과 캐럿을 기억하고, 열 때 되돌린다(새 페이지·검색 결과 열기는 맨 위)
  usePagePosition({
    pageId: page.id,
    blank: isBlankDoc(page.content),
    editor: findEditor,
    scrollerRef: bodyRef,
  });

  // 새로 만든 빈 페이지면 제목에 바로 쓸 수 있게. 부르는 쪽이 페이지마다 key를 바꿔 다시 마운트한다
  React.useEffect(() => {
    const blank = !page.title && !(page.content.content?.length ?? 0);
    if (!blank) return;
    // 메뉴에서 만들었으면 메뉴가 닫히며 트리거로 포커스를 돌려준 뒤에 잡는다
    const t = setTimeout(() =>
      bodyRef.current?.querySelector<HTMLElement>('[aria-label="페이지 제목"]')?.focus(),
    );
    return () => clearTimeout(t);
    // 처음 열 때만 (제목을 지워도 다시 잡지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={cn(
        "grid h-full min-w-0 bg-app",
        page.template ? "grid-rows-[auto_auto_minmax(0,1fr)]" : "grid-rows-[auto_minmax(0,1fr)]",
      )}
    >
      <TopBar
        breadcrumb={
          <Breadcrumb
            items={crumbs}
            onNavigate={(id) => {
              if (all[id]?.kind === "folder") sessionStore.getState().expand(id);
              else if (id !== page.id) sessionStore.getState().open(id);
            }}
          />
        }
        editedAt={`${formatAgo(page.updatedAt)} 편집`}
        scrolled={scrolled}
        sidebarOpen={!collapsed && !focusMode}
        onToggleSidebar={() =>
          // 집중 모드에서 누르면 집중 모드를 끈다(사이드바가 돌아온다)
          focusMode ? setFocusMode(false) : sessionStore.getState().toggleSidebar()
        }
        focusMode={focusMode}
        titleBar={titleBar}
        onFocusMode={() => setFocusMode(!focusMode)}
        favorite={favorite}
        onToggleFavorite={() => toggleFavorite(page.id)}
        pageMenu={<PageMenu page={page} favorite={favorite} onMove={() => setMoving(true)} />}
        outline={
          findEditor ? (
            <PageOutline
              editor={findEditor}
              getScroller={() => bodyRef.current}
              onPick={(h) => (picked.current = h)}
            />
          ) : undefined
        }
        outlineOpen={outlineOpen}
        onOutlineOpenChange={setOutlineOpen}
        onOutlineCloseAutoFocus={(e) => {
          const h = picked.current;
          picked.current = null;
          if (!h || !findEditor) return;
          e.preventDefault();
          goToHeading(findEditor, h);
        }}
      />
      {page.template ? (
        <TemplateBar
          categories={TEMPLATE_CATEGORIES}
          category={page.template.category}
          onCategoryChange={(category) => updateTemplateInfo(page.id, { category })}
          description={page.template.description}
          onDescriptionChange={(description) => updateTemplateInfo(page.id, { description })}
          pageTitle={page.template.pageTitle}
          onPageTitleChange={(pageTitle) => updateTemplateInfo(page.id, { pageTitle })}
          onDone={() => {
            void pagesStore.getState().flushPage(page.id);
            useMainUi.getState().setView({ kind: "home" });
            useMainUi.getState().setTemplatesOpen(true);
          }}
        />
      ) : null}
      <MoveDialog pageId={moving ? page.id : null} onOpenChange={setMoving} />
      <div className="relative min-h-0">
        {find && findEditor ? (
          <FindBar
            key={findEditor.instanceId}
            editor={findEditor}
            replace={find.mode === "replace"}
            focusSignal={find.seq}
            initialQuery={selectedText(findEditor)}
            onClose={closeFind}
            onReplacedAll={(n) => toast(`${n}곳을 바꿨어요`, { id: "find-replaced" })}
            className="absolute top-2 right-4 z-20"
          />
        ) : null}
        <div
          ref={bodyRef}
          data-slot="page-scroller"
          className="h-full min-h-0 overflow-y-auto overscroll-contain"
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
        >
          {/* 페이지 머리는 커버를 꽉 채우려고 본문 폭·여백을 스스로 잡는다. 에디터만 같은 폭으로 감싼다 */}
          <article className="@container relative pb-[30vh]">
            {/* 고래자리는 제목 줄 오른쪽 여백에 둔다(concept.md §3). 커버 아래라 겹치지 않고, 여백이 모자라거나 전체 폭이면 숨긴다 */}
            <PageHeader
              aside={wide ? undefined : <SkyMark className="hidden @6xl:block" />}
              title={page.title}
              onTitleChange={(title) => update(page.id, { title })}
              onTitleExit={focusEditor}
              {...iconProps}
              cover={page.cover ? { src: coverUrl } : undefined}
              onAddCover={chooseCover}
              onChangeCover={chooseCover}
              onRemoveCover={() => update(page.id, { cover: null })}
              wide={wide}
            >
              <Properties
                tags={tags}
                tagEditor={
                  <TagEditor
                    all={allTags}
                    assigned={page.props.tags}
                    onAdd={(name) => addTag(page.id, name)}
                  />
                }
                onRemoveTag={(name) => removeTag(page.id, name)}
                status={page.props.status ?? undefined}
                onStatusChange={(status) =>
                  update(page.id, { props: { ...page.props, status: status ?? null } })
                }
                {...recordFields(page, all)}
                created={formatDate(page.createdAt)}
                updated={formatDate(page.updatedAt)}
                updatedAgo={formatAgo(page.updatedAt)}
              />
            </PageHeader>
            <div
              className={cn(
                "mx-auto mt-6 w-full",
                wide ? "px-16" : "max-w-(--content-w) px-12",
                // 페이지 글꼴(PAGE-05): 본문 글꼴 토큰만 바꾼다
                page.layout.font === "serif" && "[--font-body:var(--font-serif)]",
                page.layout.font === "mono" && "[--font-body:var(--font-mono)]",
              )}
            >
              <BodyEditor
                content={initialContent}
                label={`${page.title || "제목 없음"} 본문`}
                onChange={onBodyChange}
                onOpenLink={openEditorLink}
                mentions={mentions}
                images={images}
                attachments={attachments}
                subpages={subpages}
                createSubpage={createSubpage}
                breadcrumb={breadcrumb}
                spellCheck={editorPrefs.spellcheck}
                dimChecked={editorPrefs.dimChecked}
                calc={editorPrefs.calc}
                calcRight={editorPrefs.calcRight}
                onEditor={setFindEditor}
                copyAsText={copyAsMarkdown}
              />
              {empty && !page.template ? (
                <EmptyStart
                  onStartBlank={() => {
                    setBlankStarted(page.id);
                    focusEditor();
                  }}
                  onOpenTemplates={() => useMainUi.getState().setTemplatesOpen(true)}
                />
              ) : null}
              {backlinks.length ? (
                <Backlinks
                  key={page.id}
                  className="mt-16"
                  items={backlinks}
                  onOpen={(id, o) => openPageFrom(id, { metaKey: o.newTab, ctrlKey: false })}
                />
              ) : null}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

/** 본문 에디터 — props가 그대로면 다시 그리지 않는다 (SYS-11) */
const BodyEditor = React.memo(NoteEditor);

/** 여러 블록을 복사하면 다른 앱용 글자는 마크다운(이스케이프 없이, 멘션은 지금 제목) — EDIT-26 */
function copyAsMarkdown(doc: JSONContent): string {
  const pages = pagesStore.getState().pages;
  return docToMarkdown(doc as MdNode, {
    escape: false,
    titleOf: (id) => (pages[id] ? displayTitle(pages[id]) : undefined),
  });
}

/** 목차 내용 — 메뉴가 열릴 때 그린다. 그때의 제목과 지금 보고 있는 제목을 읽는다 */
function PageOutline({
  editor,
  getScroller,
  onPick,
}: {
  editor: Editor;
  getScroller: () => Element | null;
  onPick: (heading: Heading) => void;
}) {
  const [snap] = React.useState(() => {
    const headings = getHeadings(editor);
    return { headings, current: currentHeading(editor, headings, getScroller()) };
  });
  return (
    <OutlineItems
      headings={snap.headings}
      current={snap.current}
      onSelect={(i) => onPick(snap.headings[i]!)}
    />
  );
}

/** 찾기 칸에 미리 넣을 글자 — 본문에서 한 줄 안을 골랐을 때만 */
function selectedText(editor: Editor): string {
  const { from, to, empty } = editor.state.selection;
  if (empty) return "";
  const text = editor.state.doc.textBetween(from, to, "\n");
  return text.includes("\n") || text.length > 100 ? "" : text;
}
