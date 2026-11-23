import { usePageIconProps } from "./page-icon-props";
import {
  BoardView,
  type BoardCalcKind,
  type BoardColumn,
} from "@/components/collection/board-view";
import { CalendarView } from "@/components/collection/calendar-view";
import { GridView } from "@/components/collection/grid-view";
import { RecordDetail } from "@/components/collection/record-detail";
import { Toolbar, type FilterGroup, type ToolbarFilter } from "@/components/collection/toolbar";
import { Resizer } from "@/components/shell/resizer";
import { Button } from "@/components/ui/button";
import { NoteEditor } from "@/components/editor/note-editor";
import { PageHeader } from "@/components/page/page-header";
import { Breadcrumb } from "@/components/shell/breadcrumb";
import { TopBar } from "@/components/shell/top-bar";
import {
  checklistProgress,
  BUILTIN_NAMES,
  collectionRecords,
  fieldFilterChoices,
  filterChoices,
  isoDate,
  monthGrid,
  boardGroups,
  groupCalc,
  groupKey,
  groupProps,
  moveProps,
  newStatusName,
  nextColor,
  queryRecords,
  reorder,
} from "@/features/collection/model";
import { metaStore, useMeta } from "@/features/meta";
import { pagesStore, usePages } from "@/features/pages";
import { sessionStore, useSession } from "@/features/session";
import { formatAgo } from "@/lib/format-date";
import {
  normalizeCollection,
  type BoardSettings,
  type CollectionFilter,
  type CollectionSettings,
  type FieldValue,
  type Page,
  isFieldId,
} from "@/lib/storage";
import type { JSONContent } from "@tiptap/core";
import * as React from "react";
import { ancestors, displayTitle, moveToTrash, openPage, toggleFavorite } from "./actions";
import { MoveDialog } from "./move-dialog";
import { useRestoreFocus } from "./use-restore-focus";
import {
  addTag,
  openEditorLink,
  removeTag,
  usePageImages,
  usePageMentions,
  usePageTags,
} from "./page-editing";
import { PageMenu } from "./page-menu";
import { collectionProperties } from "./collection-properties";
import { assigneeChoices, setRecordProps, toRecordItem } from "./record-fields";
import { openInBackgroundTab, openInNewTab } from "./tabs";
import { tagColor } from "./tag-colors";
import { TagEditor } from "./tag-editor";
import { useMainUi } from "./ui-store";
import { useTopBarTitleBar } from "./use-tab-bar";
import { useInactiveSide } from "./split";

/**
 * 컬렉션 화면 (COLL-01~06): 상단 바 + 이름 + CL-Toolbar + 표·보드·캘린더 + 레코드 상세.
 * 보기·정렬·필터는 컬렉션 파일(`collection`)에 남기고, 검색어·달·열린 레코드는 화면에만 둔다.
 */
export function CollectionView({ page }: { page: Page }) {
  const iconProps = usePageIconProps(page);
  const all = usePages((s) => s.pages);
  const order = useMeta((s) => s.meta?.order[page.id]);
  const tagColors = useMeta((s) => s.meta?.tags);
  const collapsed = useSession((s) => s.sidebarCollapsed);
  const focusMode = useMainUi((s) => s.focusMode);
  const setFocusMode = useMainUi((s) => s.setFocusMode);
  const titleBar = useTopBarTitleBar();
  const dimmed = useInactiveSide("main");
  const favorite = useMeta((s) => s.meta?.favorites.includes(page.id) ?? false);
  const [moving, setMoving] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [month, setMonth] = React.useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  // 최근 항목에서 이 컬렉션의 레코드를 눌렀으면 상세를 바로 띄운다 — 화면이 새로 열릴 때는 처음 값으로
  const [openId, setOpenId] = React.useState<string | null>(() => {
    const id = useMainUi.getState().recordToOpen;
    return id && pagesStore.getState().pages[id]?.parentId === page.id ? id : null;
  });
  // 이 컬렉션을 보고 있는 중에 눌렀을 때 — 요청을 받아 상세를 바꾼다
  React.useEffect(() => {
    const take = (id: string | null) => {
      if (!id || pagesStore.getState().pages[id]?.parentId !== page.id) return;
      useMainUi.getState().setRecordToOpen(null);
      setOpenId(id);
    };
    take(useMainUi.getState().recordToOpen);
    return useMainUi.subscribe((s) => take(s.recordToOpen));
  }, [page.id]);
  // 상세로 연 레코드도 최근 항목에 남긴다
  React.useEffect(() => {
    if (openId) sessionStore.getState().touch(openId);
  }, [openId]);
  const { update } = pagesStore.getState();
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  // 새로 만든 컬렉션이면 이름에 바로 쓸 수 있게 (처음 열 때만)
  React.useEffect(() => {
    if (page.title) return;
    // 메뉴에서 만들었으면 메뉴가 닫히며 트리거로 포커스를 돌려준 뒤에 잡는다
    const t = setTimeout(() =>
      scrollerRef.current?.querySelector<HTMLElement>('[aria-label="페이지 제목"]')?.focus(),
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settings = React.useMemo<CollectionSettings>(
    () => page.collection ?? normalizeCollection(null),
    [page.collection],
  );
  const setSettings = (patch: Partial<CollectionSettings>) =>
    update(page.id, { collection: { ...settings, ...patch } });

  /* ---------- 레코드 열기 (COLL-07): 모달 · 사이드 패널 · 새 탭 ---------- */
  const defaultMode = useSession((s) => s.recordOpen);
  const mode = settings.openMode ?? defaultMode;
  /** ⌘(⌃)클릭이면 지금 화면은 두고 뒤 탭에. 새로 만든 레코드는 탭 방식이어도 곁에서 연다 */
  const openRecord = (
    id: string,
    e?: { metaKey: boolean; ctrlKey: boolean } | null,
    created = false,
  ) => {
    if (e && (e.metaKey || e.ctrlKey)) {
      void pagesStore.getState().flushPage(id);
      openInBackgroundTab(id);
      return;
    }
    if (mode === "tab" && !created) {
      setOpenId(null);
      openInNewTab(id);
      return;
    }
    setOpenId(id);
  };
  const today = isoDate(new Date());
  const records = React.useMemo(
    () => collectionRecords(all, page.id, order),
    [all, page.id, order],
  );
  const shown = React.useMemo(
    () => queryRecords(records, settings, search),
    [records, settings, search],
  );
  const statuses = settings.statuses;
  const items = shown.map((p) => toRecordItem(p, tagColors, today, statuses));
  const props = collectionProperties({ settings, setSettings, records, today });
  const statusOptions = statuses.map((o) => ({ name: o.name, color: tagColor(o.color) }));
  const names = React.useMemo(() => assigneeChoices(all), [all]);

  const crumbs = [...ancestors(page.id, all).reverse(), page].map((p) => ({
    id: p.id,
    title: displayTitle(p),
    emoji: p.kind !== "folder" ? (p.icon ?? undefined) : undefined,
  }));

  /** 새 레코드 — 상태·마감을 미리 채우고 상세를 연다 */
  const createRecord = (init: Partial<Page["props"]> = {}) => {
    const rec = pagesStore.getState().create({ title: "", parentId: page.id });
    // 필터가 걸려 있으면 그 값을 채워 새 레코드가 바로 보이게
    const pick = (field: CollectionFilter["field"]) =>
      settings.filters.find((f) => f.field === field)?.value;
    const tag = pick("tags");
    // 사용자 속성 필터(선택·다중 선택·체크박스)도 채운다
    const values: Record<string, FieldValue> = {};
    for (const f of settings.filters) {
      if (!isFieldId(f.field) || f.field in values) continue;
      const def = settings.fields.find((x) => x.id === f.field);
      if (def?.type === "select") values[f.field] = f.value;
      else if (def?.type === "multi") values[f.field] = [f.value];
      else if (def?.type === "checkbox" && f.value === "true") values[f.field] = true;
    }
    update(rec.id, {
      props: {
        ...rec.props,
        status: pick("status") ?? statuses[0]?.name ?? null,
        assignee: pick("assignee") ?? null,
        due: null,
        tags: tag ? [tag] : [],
        values,
        ...init,
      },
    });
    setSearch("");
    openRecord(rec.id, null, true);
  };

  /* ---------- 보드 (COLL-03): 칸 나누기·옮기기·상태 편집 ---------- */
  const board = settings.board;
  const setBoard = (patch: Partial<BoardSettings>) =>
    setSettings({ board: { ...board, ...patch } });
  const groups = boardGroups(shown, {
    groupBy: board.groupBy,
    statuses,
    colors: board.colors,
    tagColors: tagColors ?? {},
  });
  const groupOf = (key: string) => groups.find((g) => g.key === key);
  // 보드 카드: 숨겼거나 카드 표시를 끈 기본 속성은 빼고, 고른 사용자 속성을 작게 (COLL-08)
  const itemById = new Map(
    shown.map((p, i) => {
      const it = { ...items[i]!, extra: props.cardExtra(p) };
      if (props.cardHidesBuiltin("assignee")) delete it.assignee;
      if (props.cardHidesBuiltin("due")) delete it.due;
      if (props.cardHidesBuiltin("tags")) it.tags = [];
      return [p.id, it];
    }),
  );
  const columns: BoardColumn[] = groups
    .filter((g) => !board.hidden.includes(g.key))
    .map((g) => ({
      key: g.key,
      label: g.label,
      color: tagColor(g.color),
      items: g.records.map((p) => itemById.get(p.id)!),
      calc: groupCalc(g.records, board.calc, today),
      none: g.value === null,
      editable: board.groupBy === "status" && g.value !== null,
    }));
  const hiddenColumns = groups
    .filter((g) => board.hidden.includes(g.key))
    .map((g) => ({
      key: g.key,
      label: g.label,
      color: tagColor(g.color),
      count: g.records.length,
      none: g.value === null,
    }));
  const moveCard = (
    id: string,
    from: string,
    to: string,
    place: { beforeId?: string | null; afterId?: string | null },
  ) => {
    const rec = all[id];
    if (!rec) return;
    const patch = moveProps(
      rec,
      board.groupBy,
      groupOf(from)?.value ?? null,
      groupOf(to)?.value ?? null,
    );
    if (patch) setRecordProps(id, patch);
    // 직접 정한 순서 (정렬이 없을 때만) — workspace.json order[컬렉션 id]
    if (!settings.sort)
      metaStore.getState().setOrder(
        page.id,
        reorder(
          records.map((r) => r.id),
          id,
          place,
        ),
      );
  };
  const statusName = (key: string) => groupOf(key)?.value ?? null;
  /** 상태 이름이 바뀌거나 지워지면 레코드·필터·숨김·색 키도 함께 고친다 */
  const replaceStatus = (from: string, to: string | null, next: typeof statuses) => {
    for (const r of records) if (r.props.status === from) setRecordProps(r.id, { status: to });
    const fromKey = groupKey("status", from);
    const toKey = to === null ? null : groupKey("status", to);
    setSettings({
      statuses: next,
      filters: settings.filters.flatMap((f) =>
        f.field === "status" && f.value === from ? (to ? [{ ...f, value: to }] : []) : [f],
      ),
      board: {
        ...board,
        hidden: board.hidden.flatMap((k) => (k === fromKey ? (toKey ? [toKey] : []) : [k])),
      },
    });
  };
  const addStatus = () =>
    setSettings({
      statuses: [...statuses, { name: newStatusName(statuses), color: nextColor(statuses) }],
    });
  const renameStatus = (key: string, name: string) => {
    const from = statusName(key);
    const to = name.trim().slice(0, 40);
    if (!from || !to || statuses.some((o) => o.name === to)) return;
    replaceStatus(
      from,
      to,
      statuses.map((o) => (o.name === from ? { ...o, name: to } : o)),
    );
  };
  const deleteStatus = (key: string) => {
    const from = statusName(key);
    if (!from) return;
    replaceStatus(
      from,
      null,
      statuses.filter((o) => o.name !== from),
    );
  };
  const moveStatus = (key: string, dir: -1 | 1) => {
    const i = statuses.findIndex((o) => o.name === statusName(key));
    const j = i + dir;
    if (i < 0 || j < 0 || j >= statuses.length) return;
    const next = [...statuses];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setSettings({ statuses: next });
  };
  const setColumnColor = (key: string, color: string) => {
    const g = groupOf(key);
    if (!g) return;
    if (board.groupBy === "status" && g.value !== null)
      setSettings({
        statuses: statuses.map((o) => (o.name === g.value ? { ...o, color } : o)),
      });
    else if (board.groupBy === "tags" && g.value !== null)
      metaStore.getState().setTagColor(g.value, color);
    else setBoard({ colors: { ...board.colors, [key]: color } });
  };

  const narrowed = settings.filters.length > 0 || search.trim() !== "";
  const empty = (
    <div className="grid justify-items-center gap-3 text-center">
      <p className="text-ui text-secondary">
        {!records.length
          ? "아직 레코드가 없어요."
          : narrowed
            ? "조건에 맞는 레코드가 없어요."
            : "이번 달에 마감인 레코드가 없어요."}
      </p>
      {records.length && narrowed ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setSearch("");
            setSettings({ filters: [] });
          }}
        >
          필터와 검색 풀기
        </Button>
      ) : !records.length ? (
        <Button size="sm" onClick={() => createRecord()}>
          새 레코드
        </Button>
      ) : (
        <Button size="sm" onClick={() => createRecord({ due: isoDate(new Date()) })}>
          오늘 마감으로 새 레코드
        </Button>
      )}
    </div>
  );

  const toggleFilter = (f: CollectionFilter | ToolbarFilter) => {
    const has = settings.filters.some((x) => x.field === f.field && x.value === f.value);
    setSettings({
      filters: has
        ? settings.filters.filter((x) => !(x.field === f.field && x.value === f.value))
        : [...settings.filters, f as CollectionFilter],
    });
  };

  /* ---------- 필터·정렬 메뉴 (사용자 속성 포함) ---------- */
  const choices = filterChoices(records, statuses);
  const filterGroups: FilterGroup[] = [
    ...(["status", "assignee", "tags"] as const).map((field) => ({
      field,
      name: BUILTIN_NAMES[field],
      values: choices[field].map((v) => ({ value: v, label: v })),
    })),
    ...fieldFilterChoices(settings.fields),
  ];
  const sortFields = [
    { field: "title", name: "제목" },
    ...props.entries.map((e) => ({ field: e.key, name: e.name })),
    { field: "updated", name: "수정일" },
  ];

  const panelWidth = useSession((s) => s.recordPanelWidth);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBodyWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 패널은 360px부터, 목록이 320px은 남게
  const PANEL_MIN = 360;
  const panelMax = Math.max(PANEL_MIN, bodyWidth - 320);
  const sideWidth = Math.min(
    panelMax,
    Math.max(PANEL_MIN, panelWidth ?? Math.round(bodyWidth * 0.4)),
  );

  const tagEditorFor = (id: string) => {
    const rec = all[id];
    return rec ? <RecordTagEditor page={rec} /> : null;
  };

  const days = monthGrid(month.year, month.month).map((d) => ({
    ...d,
    today: d.date === today,
    items: items.filter((r) => r.due?.date === d.date),
  }));
  const shiftMonth = (by: number) =>
    setMonth((m) => {
      const d = new Date(m.year, m.month + by, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const openIndex = openId ? shown.findIndex((p) => p.id === openId) : -1;
  const opened = openId ? all[openId] : undefined;
  // 레코드 상세는 트리거(표 칸·보드 카드) 없이 열리므로 닫으면 포커스를 그 자리로 돌린다
  useRestoreFocus(openId !== null);
  const side = mode === "side";
  const detailOf = (rec: Page, variant: "modal" | "side") => (
    <RecordDetail
      variant={variant}
      open
      onOpenChange={(o) => {
        if (!o) {
          void pagesStore.getState().flushPage(rec.id);
          setOpenId(null);
        }
      }}
      item={toRecordItem(rec, tagColors, today, statuses)}
      statusOptions={statusOptions}
      position={{ index: openIndex + 1 || 1, total: Math.max(shown.length, 1) }}
      onPrev={openIndex > 0 ? () => setOpenId(shown[openIndex - 1]!.id) : undefined}
      onNext={
        openIndex >= 0 && openIndex < shown.length - 1
          ? () => setOpenId(shown[openIndex + 1]!.id)
          : undefined
      }
      onOpenPage={() => {
        setOpenId(null);
        openPage(rec.id);
      }}
      onTitleChange={(title) => update(rec.id, { title })}
      onStatusChange={(status) => setRecordProps(rec.id, { status: status ?? null })}
      onAssigneeChange={(name) => setRecordProps(rec.id, { assignee: name ?? null })}
      onDueChange={(due) => setRecordProps(rec.id, { due: due ?? null })}
      assigneeChoices={names}
      tagEditor={<RecordTagEditor page={rec} />}
      onRemoveTag={(name) => removeTag(rec.id, name)}
      progress={progressOf(rec)}
      rows={props.rows(rec)}
      addProperty={props.addRow}
      className={variant === "side" ? "h-full" : undefined}
    >
      <RecordBody key={rec.id} page={rec} />
    </RecordDetail>
  );

  return (
    <div className="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)] bg-app">
      <TopBar
        dimmed={dimmed}
        breadcrumb={
          <Breadcrumb
            items={crumbs}
            dimmed={dimmed}
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
          focusMode ? setFocusMode(false) : sessionStore.getState().toggleSidebar()
        }
        focusMode={focusMode}
        titleBar={titleBar}
        onFocusMode={() => setFocusMode(!focusMode)}
        favorite={favorite}
        onToggleFavorite={() => toggleFavorite(page.id)}
        pageMenu={<PageMenu page={page} favorite={favorite} onMove={() => setMoving(true)} />}
      />
      <MoveDialog pageId={moving ? page.id : null} onOpenChange={setMoving} />
      {/* 사이드 패널(COLL-07)은 오른쪽에 붙어 목록을 밀어낸다 */}
      <div ref={bodyRef} className="flex min-h-0 min-w-0">
        <div
          ref={scrollerRef}
          data-slot="page-scroller"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
        >
          <PageHeader
            title={page.title}
            placeholder={displayTitle({ title: "", kind: "collection" })}
            onTitleChange={(title) => update(page.id, { title })}
            {...iconProps}
            wide
            className="pb-2"
          />
          {/* 좌우 여백은 PageHeader(wide)의 px-16과 맞춘다 — 프로토타입 .db-bar(32px)보다 넓지만 제목과 한 줄에 선다 */}
          <Toolbar
            view={settings.view}
            onViewChange={(view) => setSettings({ view })}
            filters={settings.filters}
            filterGroups={filterGroups}
            onToggleFilter={toggleFilter}
            onClearFilters={() => setSettings({ filters: [] })}
            sort={settings.sort}
            sortFields={sortFields}
            onSortChange={(sort) => setSettings({ sort: sort as CollectionSettings["sort"] })}
            search={search}
            onSearchChange={setSearch}
            shown={shown.length}
            total={records.length}
            onNew={() => createRecord()}
            groupBy={board.groupBy}
            onGroupByChange={(groupBy) => setBoard({ groupBy })}
            openMode={settings.openMode}
            defaultOpenMode={defaultMode}
            onOpenModeChange={(openMode) => {
              setSettings({ openMode });
              // 탭 방식으로 바꾸면 곁에 연 상세는 닫는다
              if ((openMode ?? defaultMode) === "tab") setOpenId(null);
            }}
            onOpenModeDefault={(m) => {
              sessionStore.getState().setRecordOpen(m);
              setSettings({ openMode: null });
            }}
            properties={props.list}
            className="px-16"
          />
          <div className="px-16 pt-4 pb-[20vh]">
            {settings.view === "grid" ? (
              <GridView
                items={items}
                onOpen={openRecord}
                onOpenPage={openPage}
                onStatusChange={(id, status) => setRecordProps(id, { status: status ?? null })}
                statusOptions={statusOptions}
                onAssigneeChange={(id, name) => setRecordProps(id, { assignee: name ?? null })}
                onDueChange={(id, due) => setRecordProps(id, { due: due ?? null })}
                assigneeChoices={names}
                tagEditor={tagEditorFor}
                onNew={() => createRecord()}
                empty={empty}
                columns={props.columns(all)}
                addColumn={props.addColumn}
              />
            ) : settings.view === "board" ? (
              <BoardView
                columns={columns}
                hidden={hiddenColumns}
                onOpen={openRecord}
                onOpenPage={openPage}
                onTrash={moveToTrash}
                onMove={moveCard}
                reorderable={!settings.sort}
                onNew={(key) => {
                  const g = groupOf(key);
                  createRecord(
                    g?.value == null
                      ? board.groupBy === "status"
                        ? { status: null }
                        : board.groupBy === "assignee"
                          ? { assignee: null }
                          : { tags: [] }
                      : groupProps(board.groupBy, g.value),
                  );
                }}
                onAddColumn={board.groupBy === "status" ? addStatus : undefined}
                onRenameColumn={renameStatus}
                onDeleteColumn={deleteStatus}
                onMoveColumn={moveStatus}
                onHideColumn={(key) => setBoard({ hidden: [...board.hidden, key] })}
                onShowColumn={(key) => setBoard({ hidden: board.hidden.filter((k) => k !== key) })}
                onColorChange={setColumnColor}
                calc={board.calc}
                onCalcChange={(calc: BoardCalcKind) => setBoard({ calc })}
              />
            ) : (
              <CalendarView
                monthLabel={`${month.year}년 ${month.month + 1}월`}
                days={days}
                onPrev={() => shiftMonth(-1)}
                onNext={() => shiftMonth(1)}
                onToday={() => {
                  const d = new Date();
                  setMonth({ year: d.getFullYear(), month: d.getMonth() });
                }}
                onOpen={openRecord}
                onNew={(due) => createRecord({ due })}
                empty={empty}
              />
            )}
          </div>
        </div>
        {opened && side ? (
          // 폭은 끌어서 정하는 런타임 값이라 인라인 스타일 (토큰 규칙 예외, 사이드바 폭과 같음)
          <div className="relative h-full shrink-0" style={{ width: sideWidth }}>
            <Resizer
              edge="left"
              label="레코드 패널 너비 조절"
              width={sideWidth}
              min={PANEL_MIN}
              max={panelMax}
              onWidthChange={(w) => sessionStore.getState().setRecordPanelWidth(w)}
              onReset={() => sessionStore.getState().setRecordPanelWidth(null)}
            />
            {detailOf(opened, "side")}
          </div>
        ) : null}
      </div>
      {opened && !side ? detailOf(opened, "modal") : null}
    </div>
  );
}

function progressOf(page: Page) {
  const p = checklistProgress(page.content);
  return p.total ? p : undefined;
}

function RecordTagEditor({ page }: { page: Page }) {
  const { allTags } = usePageTags(page);
  return (
    <TagEditor all={allTags} assigned={page.props.tags} onAdd={(name) => addTag(page.id, name)} />
  );
}

/** 레코드 본문 — 페이지와 같은 에디터 (COLL-05) */
function RecordBody({ page }: { page: Page }) {
  const images = usePageImages(page.id);
  const mentions = usePageMentions(page.id);
  const prefs = useSession((s) => s.editor);
  // 바깥 변경(DATA-07)이면 다시 만든다
  const rev = usePages((s) => s.externalRev[page.id] ?? 0);
  return (
    <div
      className={
        page.layout.font === "serif"
          ? "[--font-body:var(--font-serif)]"
          : page.layout.font === "mono"
            ? "[--font-body:var(--font-mono)]"
            : undefined
      }
    >
      <NoteEditor
        key={rev}
        content={page.content as JSONContent}
        label={`${page.title || "제목 없음"} 본문`}
        onChange={(content) =>
          pagesStore.getState().update(page.id, { content: content as Page["content"] })
        }
        onOpenLink={openEditorLink}
        mentions={mentions}
        images={images}
        spellCheck={prefs.spellcheck}
        dimChecked={prefs.dimChecked}
      />
    </div>
  );
}
