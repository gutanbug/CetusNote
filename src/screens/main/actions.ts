export { displayTitle } from "@/features/pages/title";
import { displayTitle } from "@/features/pages/title";
import { toast } from "@/components/ui/toast";
import { exportPageMarkdown } from "@/features/export";
import { metaStore } from "@/features/meta";
import type { DropPosition } from "@/components/shell/drop-indicator";
import { pagesStore, planDrop, type PageMeta } from "@/features/pages";
import { buildPageTree } from "@/features/pages/tree";
import { sessionStore } from "@/features/session";
import {
  builtinTemplatePages,
  isTemplate,
  TEMPLATES,
  templateResult,
  todayISO,
  type TemplateResult,
} from "@/features/templates";
import { setTodoChecked } from "@/features/todos";
import { mentionTitleOf, resolveMention } from "./mention-model";
import { canContain, type Page, type PageKind, type PageTemplate } from "@/lib/storage";
import { nextTagColor } from "./tag-colors";
import { runPdfExport } from "./pdf-export";
import { useMainUi } from "./ui-store";

/**
 * 메인 화면 동작 — 페이지 스토어(저장)와 세션 스토어(화면 상태)를 함께 움직인다.
 * 컴포넌트는 이 함수들을 콜백으로 받는다.
 */

const pages = () => pagesStore.getState().pages;
const structure = () => pagesStore.getState().structure;

/** 조상 id들(가까운 순) */
export function ancestors(id: string, all: Record<string, PageMeta> = structure()): PageMeta[] {
  const out: PageMeta[] = [];
  const seen = new Set([id]);
  for (let p = all[id]?.parentId; p && all[p] && !seen.has(p); p = all[p]!.parentId) {
    seen.add(p);
    out.push(all[p]!);
  }
  return out;
}

/** 하위 전부(깊이 순서 무관) */
export function descendants(id: string, all: Record<string, Page> = pages()): Page[] {
  const out: Page[] = [];
  const walk = (pid: string) => {
    for (const p of Object.values(all))
      if (p.parentId === pid && !out.includes(p)) {
        out.push(p);
        walk(p.id);
      }
  };
  walk(id);
  return out;
}

/** 페이지 열기 — 떠나는 페이지는 바로 저장하고, 조상 폴더·문서를 펼친다 */
export function openPage(id: string) {
  const { activeId } = sessionStore.getState();
  if (activeId && activeId !== id) void pagesStore.getState().flushPage(activeId);
  const page = pages()[id];
  if (!page || page.kind === "folder") return;
  useMainUi.getState().setView({ kind: "page" });
  sessionStore.getState().expand(...ancestors(id).map((p) => p.id));
  sessionStore.getState().open(id);
}

/** 컬렉션 안의 레코드인가 (보드·표 카드) */
export function isRecord(id: string) {
  const page = pages()[id];
  const parent = page?.parentId ? pages()[page.parentId] : undefined;
  return page?.kind === "page" && parent?.kind === "collection";
}

/** 레코드면 그 컬렉션 이름 (최근 항목에 "어느 보드의 카드인지" 적는다), 아니면 undefined */
export function recordHome(page: PageMeta, all: Record<string, PageMeta>): string | undefined {
  const parent = page.parentId ? all[page.parentId] : undefined;
  return page.kind === "page" && parent?.kind === "collection" ? displayTitle(parent) : undefined;
}

/**
 * 최근 항목 열기 — 레코드면 그 컬렉션을 열고 레코드 상세를 띄운다(보던 흐름 그대로).
 * 나머지는 페이지 열기와 같다.
 */
export function openRecent(id: string) {
  if (!isRecord(id)) return openPage(id);
  const parentId = pages()[id]!.parentId!;
  useMainUi.getState().setRecordToOpen(id);
  openPage(parentId);
  // 이미 그 컬렉션을 보고 있었으면 open이 최근 목록을 건드리지 않으니 레코드를 다시 올린다
  sessionStore.getState().touch(id);
}

/** 멘션·페이지 링크 열기 (EDIT-13). 지워졌거나 휴지통에 있으면 알린다 */
export function openPageLink(id: string) {
  if (resolveMention(pages(), id)) openPage(id);
  else toast("지워졌거나 휴지통에 있는 페이지예요.");
}

/** 새 문서의 모양 기본값: 본문 폭(SET-03) · 본문 글꼴(SET-04) */
function applyNewPageLayout(page: Page) {
  const { appearance, editor } = sessionStore.getState();
  const layout = {
    ...page.layout,
    fullWidth: page.layout.fullWidth || appearance.newPageWide,
    font: editor.newPageFont,
  };
  if (layout.fullWidth !== page.layout.fullWidth || layout.font !== page.layout.font)
    pagesStore.getState().update(page.id, { layout });
}

/**
 * 새 문서를 만들기만 한다(열지 않는다) — 내용을 채운 뒤에 열어야 할 때(가져오기·일일 노트).
 * 열린 에디터는 처음 받은 내용을 쓰므로, 빈 문서로 먼저 열면 나중에 채운 내용이 안 보인다.
 */
export function createDocument(parentId: string | null = null): Page {
  const page = pagesStore.getState().create({ title: "", parentId });
  applyNewPageLayout(page);
  return pagesStore.getState().pages[page.id]!;
}

/** 새 문서·폴더·컬렉션. parentId가 없으면 맨 위. 문서·컬렉션이면 바로 연다 */
export function createIn(parentId: string | null, kind: PageKind = "page"): Page {
  const page = pagesStore
    .getState()
    .create(kind === "page" ? { title: "", parentId } : { kind, title: "", parentId });
  if (kind === "page") applyNewPageLayout(page);
  if (parentId) sessionStore.getState().expand(parentId, ...ancestors(parentId).map((p) => p.id));
  if (kind !== "folder") openPage(page.id);
  return page;
}

/**
 * 오늘의 일일 노트 (PAGE-13). 제목이 "일일 노트 YYYY-MM-DD"인 문서(휴지통 밖, 어디에 있든)가 있으면 열고,
 * 없으면 일일 노트 템플릿으로 맨 위에 만들어 연다. 이미 있었는지 돌려준다.
 */
export function openDailyNote(now = new Date()): { page: Page; created: boolean } {
  // 워크스페이스의 일일 노트 템플릿(고쳤으면 고친 모양), 지웠으면 기본 모양
  ensureTemplates();
  const daily = Object.values(pages()).find((p) => isTemplate(p) && p.template.builtin === "daily");
  const made = daily
    ? templateResult(daily, todayISO(now))
    : TEMPLATES.find((t) => t.id === "daily")!.make(todayISO(now));
  const existing = Object.values(pages()).find(
    (p) => p.kind === "page" && !p.trashedAt && p.title.trim() === made.title,
  );
  if (existing) {
    openPage(existing.id);
    return { page: existing, created: false };
  }
  const page = createDocument(null);
  pagesStore.getState().update(page.id, {
    icon: made.icon || null,
    title: made.title,
    props: { ...page.props, tags: made.tags, status: made.status },
    content: structuredClone(made.content) as Page["content"],
  });
  openPage(page.id);
  return { page: pages()[page.id]!, created: true };
}

/**
 * 기본 템플릿 사본을 워크스페이스에 넣는다 (PAGE-14) — 처음 한 번만. 지운 기본 템플릿은 다시 넣지 않는다
 * (되살리기는 restoreBuiltinTemplates). 워크스페이스를 아직 못 읽었으면 아무것도 하지 않는다.
 */
export function ensureTemplates() {
  const meta = metaStore.getState().meta;
  if (!meta || meta.templatesSeeded) return;
  const store = pagesStore.getState();
  const have = new Set(
    Object.values(pages()).flatMap((p) => (p.template?.builtin ? [p.template.builtin] : [])),
  );
  for (const init of builtinTemplatePages())
    if (!have.has(init.template.builtin)) store.create({ ...init, parentId: null });
  metaStore.getState().markTemplatesSeeded();
}

/** 템플릿을 편집한다 — 일반 에디터로 연다. 위에 템플릿 편집 띠가 보인다 (PAGE-14) */
export function editTemplate(id: string) {
  const page = pages()[id];
  if (!page || !isTemplate(page)) return;
  useMainUi.getState().setTemplatesOpen(false);
  openPage(id);
}

/** 빈 템플릿을 만들어 편집한다 */
export function createTemplate(category: string): Page {
  const page = pagesStore.getState().create({
    title: "새 템플릿",
    template: { category, description: "", builtin: null, pageTitle: "" },
  });
  editTemplate(page.id);
  return page;
}

/** 템플릿 복제 — 같은 분류에 "사본"으로. 기본 템플릿 표시는 옮기지 않는다 */
export function duplicateTemplate(id: string): Page | undefined {
  const src = pages()[id];
  if (!src || !isTemplate(src)) return;
  const store = pagesStore.getState();
  const copy = store.create({
    title: `${src.title || "제목 없음"} 사본`,
    icon: src.icon,
    content: structuredClone(src.content),
    props: structuredClone(src.props),
    template: { ...src.template, builtin: null },
  });
  toast(`“${src.title || "제목 없음"}” 템플릿을 복제했어요.`);
  return copy;
}

/** 템플릿 삭제 — 휴지통으로(되돌릴 수 있다). 편집 중이던 템플릿이면 홈으로 */
export function deleteTemplate(id: string) {
  const page = pages()[id];
  if (!page || !isTemplate(page)) return;
  pagesStore.getState().trash(id);
  if (sessionStore.getState().activeId === id) useMainUi.getState().setView({ kind: "home" });
  toast(`“${page.title || "제목 없음"}” 템플릿을 지웠어요.`, {
    action: { label: "실행 취소", onClick: () => pagesStore.getState().restore(id) },
  });
}

/** 지금 문서를 템플릿으로 저장 — 사본을 만든다(원본은 그대로). 하위 문서는 넣지 않는다 */
export function saveAsTemplate(id: string): Page | undefined {
  const src = pages()[id];
  if (!src || src.kind !== "page" || src.template) return;
  const copy = pagesStore.getState().create({
    title: src.title || "제목 없음",
    icon: src.icon,
    content: structuredClone(src.content),
    props: structuredClone(src.props),
    template: { category: "work", description: "", builtin: null, pageTitle: src.title },
  });
  toast(`“${copy.title}” 템플릿으로 저장했어요.`, {
    action: { label: "편집", onClick: () => editTemplate(copy.id) },
  });
  return copy;
}

/** 템플릿 정보(분류·설명·새 문서 제목)를 고친다 */
export function updateTemplateInfo(id: string, patch: Partial<PageTemplate>) {
  const page = pages()[id];
  if (!page?.template) return;
  pagesStore.getState().update(id, { template: { ...page.template, ...patch } });
}

/** 지웠거나 없는 기본 템플릿을 다시 넣는다. 넣은 개수 */
export function restoreBuiltinTemplates(): number {
  const have = new Set(
    Object.values(pages()).flatMap((p) =>
      isTemplate(p) && p.template.builtin ? [p.template.builtin] : [],
    ),
  );
  let n = 0;
  for (const init of builtinTemplatePages())
    if (!have.has(init.template.builtin)) {
      pagesStore.getState().create({ ...init, parentId: null });
      n++;
    }
  metaStore.getState().markTemplatesSeeded();
  return n;
}

/** 종류 + 목적격 조사 */
const kindObj = (p: Page) =>
  p.kind === "folder" ? "폴더를" : p.kind === "collection" ? "컬렉션을" : "페이지를";

/** 빈 문단 하나뿐인 문서 */
export function isBlankDoc(doc: Page["content"]): boolean {
  const c = doc.content as { type?: string; content?: unknown[] }[] | undefined;
  return !c?.length || (c.length === 1 && c[0]?.type === "paragraph" && !c[0].content?.length);
}

/**
 * 템플릿 적용 (PAGE-07). 지금 문서가 비어 있으면(제목·본문 모두) 그 문서에 채우고,
 * 아니면 ⌘N과 같은 자리에 새 문서를 만든다. 처음 보는 태그에는 색을 정해 준다.
 */
export function applyTemplate(templateId: string): Page | undefined {
  const template = pages()[templateId];
  if (!template || !isTemplate(template)) return;
  return applyTemplateResult(templateResult(template, todayISO()), template.title || "제목 없음");
}

function applyTemplateResult(made: TemplateResult, name: string): Page {
  const activeId = sessionStore.getState().activeId;
  const active = activeId ? pages()[activeId] : undefined;
  const reuse =
    active?.kind === "page" &&
    !active.trashedAt &&
    !active.template &&
    !active.title.trim() &&
    isBlankDoc(active.content);
  const page = reuse ? active : createNearActive();
  pagesStore.getState().update(page.id, {
    icon: made.icon || null,
    title: made.title,
    props: { ...page.props, tags: made.tags, status: made.status },
    content: made.content as Page["content"],
  });
  const meta = metaStore.getState();
  let known = Object.keys(meta.meta?.tags ?? {}).length;
  for (const tag of made.tags)
    if (!meta.meta?.tags[tag]) meta.setTagColor(tag, nextTagColor(known++));
  if (reuse) useMainUi.getState().bumpContent();
  openPage(page.id);
  toast(`“${name}” 템플릿을 적용했어요.`);
  return pagesStore.getState().pages[page.id]!;
}

/** 홈의 할 일 체크 (SHELL-13) — 그 문서의 체크리스트 항목을 바꿔 저장한다 */
export function setTodo(pageId: string, path: number[], checked: boolean) {
  const page = pages()[pageId];
  if (!page) return;
  pagesStore.getState().update(pageId, { content: setTodoChecked(page.content, path, checked) });
}

/** ⌘N: 지금 문서가 폴더 안에 있으면 그 폴더에, 아니면 맨 위에 */
export function createNearActive(): Page {
  const active = sessionStore.getState().activeId;
  const parentId = active ? pages()[active]?.parentId : null;
  const parent = parentId ? pages()[parentId] : undefined;
  return createIn(parent?.kind === "folder" ? parent.id : null);
}

/** 휴지통으로 — 실행 취소 토스트를 띄운다 (PAGE-08) */
export function moveToTrash(id: string) {
  const page = pages()[id];
  if (!page) return;
  pagesStore.getState().trash(id);
  toast(`“${displayTitle(page)}” ${kindObj(page)} 휴지통으로 옮겼어요.`, {
    action: { label: "실행 취소", onClick: () => restore(id) },
  });
}

/** 화면에 보이는 형제 순서 (workspace.json의 order + 만든 순서) */
function siblingIds(parentId: string | null): string[] {
  const order = metaStore.getState().meta?.order ?? {};
  const tree = buildPageTree(Object.values(pages()), order);
  if (!parentId) return tree.map((n) => n.id);
  const find = (nodes: typeof tree): typeof tree | undefined => {
    for (const n of nodes) {
      if (n.id === parentId) return n.children ?? [];
      const hit = n.children && find(n.children);
      if (hit) return hit;
    }
  };
  return (find(tree) ?? []).map((n) => n.id);
}

/** 복제 ⌘D — 하위 페이지는 복사하지 않는다. 원본 바로 아래에 두고 연다 (PAGE-05) */
export function duplicatePage(id: string): Page | undefined {
  const src = pages()[id];
  if (!src || src.kind !== "page") return;
  if (src.template) return duplicateTemplate(id);
  const store = pagesStore.getState();
  const copy = store.create({
    title: src.title ? `${src.title} 사본` : "",
    icon: src.icon,
    parentId: src.parentId,
    content: structuredClone(src.content),
  });
  store.update(copy.id, { props: structuredClone(src.props), layout: { ...src.layout } });
  const ids = siblingIds(src.parentId).filter((x) => x !== copy.id);
  ids.splice(ids.indexOf(src.id) + 1, 0, copy.id);
  metaStore.getState().setOrder(src.parentId, ids);
  openPage(copy.id);
  return copy;
}

/** 옮길 수 있는 곳: 최상위(null) + 폴더 + (문서를 옮기면) 다른 문서. 자기 자신·하위·지금 부모는 뺀다 */
export function moveTargets(id: string): (Page | null)[] {
  const page = pages()[id];
  if (!page) return [];
  const blocked = new Set([id, ...descendants(id).map((p) => p.id)]);
  const visible = new Set<string>();
  const walk = (nodes: ReturnType<typeof buildPageTree>) =>
    nodes.forEach((n) => {
      visible.add(n.id);
      if (n.children) walk(n.children);
    });
  walk(buildPageTree(Object.values(pages())));
  const targets = Object.values(pages())
    .filter((p) => visible.has(p.id) && !blocked.has(p.id) && p.id !== page.parentId)
    .filter((p) => canContain(p, page.kind))
    .sort((a, b) =>
      a.kind === b.kind ? a.title.localeCompare(b.title, "ko") : a.kind === "folder" ? -1 : 1,
    );
  return page.parentId ? [null, ...targets] : targets;
}

export function movePage(id: string, parentId: string | null) {
  const page = pages()[id];
  if (!page) return;
  pagesStore.getState().update(id, { parentId });
  if (parentId) sessionStore.getState().expand(parentId, ...ancestors(parentId).map((p) => p.id));
  const target = parentId ? pages()[parentId] : undefined;
  const where = target ? `“${displayTitle(target)}” 안으로` : "맨 위로";
  toast(`${kindObj(page)} ${where} 옮겼어요.`);
}

/** 트리에서 끌어다 놓기 (SHELL-06). 부모가 바뀌면 알리고, 순서만 바뀌면 조용히 */
export function dropPage(id: string, targetId: string, position: DropPosition) {
  const all = pages();
  const tree = buildPageTree(Object.values(all), metaStore.getState().meta?.order ?? {});
  const plan = planDrop(all, tree, id, targetId, position);
  const page = all[id];
  if (!plan || !page) return;
  const moved = (page.parentId ?? null) !== plan.parentId;
  metaStore.getState().setOrder(plan.parentId, plan.ids);
  if (moved) movePage(id, plan.parentId);
}

export function toggleFavorite(id: string) {
  metaStore.getState().toggleFavorite(id);
}

/** 앱 안 링크 (멘션·딥 링크는 P1). 지금은 주소를 복사해 둔다 */
export async function copyPageLink(id: string) {
  try {
    await navigator.clipboard.writeText(`cetusnote://page/${id}`);
    toast("링크를 복사했어요.");
  } catch {
    toast.error("링크를 복사하지 못했어요.");
  }
}

export async function exportMarkdown(id: string) {
  const page = pages()[id];
  if (!page || page.kind !== "page") return;
  try {
    const name = await exportPageMarkdown(page, { titleOf: mentionTitleOf(pages()) });
    if (name) toast(`“${name}” 파일로 내보냈어요.`);
  } catch {
    toast.error("내보내지 못했어요. 다른 위치를 골라 보세요.");
  }
}

/** PDF 내보내기 (DATA-06): 미리보기 대화상자를 열고 PDF를 만든다. 저장은 대화상자의 "PDF로 저장"으로 한다 */
export function exportPdf(id: string) {
  return runPdfExport(id);
}

export function restore(id: string) {
  pagesStore.getState().restore(id);
}

/**
 * 영구 삭제 — 하위도 함께 지운다(휴지통에 넣은 폴더 안의 문서들). 되돌릴 수 없다.
 * 휴지통 목록에서 한 번 더 확인한 뒤에만 부른다(PG-TrashPopover).
 */
export async function purgeWithChildren(id: string) {
  const store = pagesStore.getState();
  const kids = descendants(id);
  for (const k of kids) if (!k.trashedAt) store.trash(k.id);
  for (const k of kids.reverse()) {
    await store.purge(k.id);
    metaStore.getState().forget(k.id);
  }
  await store.purge(id);
  metaStore.getState().forget(id);
  sessionStore.getState().forgetPositions([...kids.map((k) => k.id), id]);
}

/** 빠른 메모 제목 길이 (QN-02, 프로토타입과 같다) */
const NOTE_TITLE_MAX = 60;

/**
 * 빠른 메모 → 페이지 (QN-02). 첫 줄이 제목, 나머지 줄은 문단. 첫 줄이 길어 잘리면 본문에도 남긴다.
 * 최상위에 만들고 연다. 메모는 목록에서 빠진다.
 */
export function promoteQuickNote(id: string): Page | undefined {
  const note = metaStore.getState().meta?.quickNotes.find((n) => n.id === id);
  if (!note) return;
  const [first = "", ...rest] = note.text.split("\n");
  const title = first.trim().slice(0, NOTE_TITLE_MAX).trim();
  const lines = [...(first.trim().length > NOTE_TITLE_MAX ? [first] : []), ...rest].filter((l) =>
    l.trim(),
  );
  const page = pagesStore.getState().create({
    title,
    icon: "🗒️",
    parentId: null,
    content: {
      type: "doc",
      content: lines.length
        ? lines.map((l) => ({ type: "paragraph", content: [{ type: "text", text: l }] }))
        : [{ type: "paragraph" }],
    },
  });
  applyNewPageLayout(page);
  metaStore.getState().removeQuickNote(id);
  useMainUi.getState().setQuickNoteOpen(false);
  openPage(page.id);
  toast(`“${title || "제목 없음"}” 페이지를 만들었어요.`);
  return page;
}

/** 빠른 메모 지우기 — 실행 취소 토스트 */
export function deleteQuickNote(id: string) {
  const removed = metaStore.getState().removeQuickNote(id);
  if (!removed) return;
  toast("메모를 지웠어요.", {
    action: { label: "실행 취소", onClick: () => metaStore.getState().restoreQuickNote(removed) },
  });
}

/** ⌘⇧N — 빠른 메모 열기. 사이드바가 접혔거나 집중 모드면 먼저 사이드바를 보인다 */
export function openQuickNote() {
  const ui = useMainUi.getState();
  if (ui.focusMode) ui.setFocusMode(false);
  if (sessionStore.getState().sidebarCollapsed) sessionStore.getState().toggleSidebar();
  ui.setQuickNoteOpen(true);
}
