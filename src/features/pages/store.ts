import {
  canContain,
  createPage,
  StorageError,
  type LoadError,
  type Page,
  type Storage,
} from "@/lib/storage";
import {
  assetOwner,
  assetRefs,
  attachmentFileName,
  isImageAssetPath,
  replaceAssetRefs,
} from "./assets";
import { createStore } from "zustand/vanilla";
import { createSaveQueue, type SaveState } from "./save-queue";
import { currentWorkspaceGeneration } from "@/features/workspace/generation";
import { createHistoryRecorder, fingerprint, type HistoryRecorder } from "../history/recorder";
import { isBodyLoaded, sameValue, UNLOADED_BODY } from "./body";
import { notifyKeptExternal } from "./kept-external";

/** 본문을 한 번에 읽는 페이지 수 (IPC 한 번의 크기와 화면 갱신 간격) */
const BODY_BATCH = 200;

/**
 * 구조 스냅샷 — 본문(content)과 수정 시각(updatedAt)을 뺀 페이지 정보 (SYS-10).
 * 본문만 바뀐 페이지는 이 객체가 같은 참조로 남아, 트리·사이드바처럼 구조만 보는 곳이 다시 계산하지 않는다.
 */
export type PageMeta = Omit<Page, "content" | "updatedAt">;

export type PagesState = {
  loaded: boolean;
  /** 워크스페이스를 읽을 때마다 올라간다. 검색 색인이 처음 읽기와 나중 바뀜을 가른다 (SYS-10) */
  loadSeq: number;
  pages: Record<string, Page>;
  /** id → 구조 스냅샷. 구조 필드가 바뀔 때만 객체가 새로 만들어진다 (SYS-10) */
  structure: Record<string, PageMeta>;
  /** 읽지 못한 파일 — 앱은 건드리지 않고 알리기만 한다 */
  loadErrors: LoadError[];
  /** SH-SaveStatus에 그대로 넘긴다 (DATA-02) */
  saveState: SaveState;
  load(): Promise<void>;
  /**
   * 본문을 연다 (SYS-10, ADR-022). 이미 읽었으면 바로 true. 읽지 못하면 false — 페이지는 본문 없이 남는다.
   * 같은 페이지를 여러 번 불러도 파일은 한 번만 읽는다.
   */
  ensureBody(id: string): Promise<boolean>;
  /** 모든 본문을 읽는다. 본문 전체가 필요한 기능(백링크·할 일·내보내기·바꿈 정리)이 쓴다 */
  ensureAllBodies(): Promise<void>;
  /** 본문만 읽어 돌려준다. 스토어에는 넣지 않는다 (검색 색인 백그라운드 읽기, SYS-10) */
  readBodies(ids: string[]): Promise<Page[]>;
  /** 새 문서·폴더·컬렉션. 컬렉션 아래에 폴더·컬렉션을 두려 하면 오류 (SHELL-14, COLL-01) */
  create(init?: Parameters<typeof createPage>[0]): Page;
  /** 페이지를 고친다. updatedAt을 갱신하고 자동 저장에 맡긴다. 옮길 때(parentId)도 같은 규칙 */
  update(id: string, patch: Partial<Omit<Page, "id" | "schemaVersion" | "createdAt">>): void;
  /**
   * 여러 페이지를 한 번에 고친다 (태그 관리 SHELL-18). update와 달리 updatedAt을 자동으로 바꾸지 않는다 —
   * 바뀐 시각은 patch에 담는다(실행 취소는 이전 시각을 되돌린다). 없는 페이지는 건너뛴다
   */
  patchMany(
    patches: Record<string, Partial<Omit<Page, "id" | "schemaVersion" | "createdAt">>>,
  ): void;
  trash(id: string): void;
  restore(id: string): void;
  /** 영구 삭제 — 휴지통에 있는 페이지만 */
  purge(id: string): Promise<void>;
  /** owner 페이지 폴더의 이미지를 빌려 쓰는 다른 페이지에 사본을 만들어 준다 (영구 삭제 전) */
  adoptAssets(owner: string): Promise<void>;
  /** 한 페이지 바로 저장 (페이지를 떠날 때) */
  flushPage(id: string): Promise<boolean>;
  /** 모두 바로 저장 (창을 닫을 때). 모두 저장됐으면 true */
  flushAll(): Promise<boolean>;
  retry(): Promise<boolean>;
  /**
   * 바깥에서 바뀐 파일 반영 (DATA-07). 이 앱에서 아직 저장하지 않은 변경이 있는 페이지는 덮지 않는다(conflicts).
   * 반영한 페이지는 externalRev를 올린다 — 열린 에디터가 본문을 다시 읽게.
   */
  applyExternal(changes: {
    pages: Page[];
    removed: string[];
    /** 확인을 시작할 때의 pages — 그 사이 이 앱에서 바뀐 페이지도 덮지 않는다 */
    base?: Record<string, Page>;
  }): {
    applied: string[];
    removed: string[];
    conflicts: string[];
  };
  /** 페이지별 바깥 변경 횟수 */
  externalRev: Record<string, number>;
  /** 버전 기록 정책 (DATA-09). 되돌리기 전 스냅샷에 쓴다 */
  history: HistoryRecorder;
};

/** 본문과 수정 시각을 뺀 구조 스냅샷 (SYS-10) */
function metaOf(page: Page): PageMeta {
  const meta: Partial<Page> = { ...page };
  delete meta.content;
  delete meta.updatedAt;
  return meta as PageMeta;
}

/** 본문·수정 시각을 빼고 구조 필드가 모두 같은지 본다. 필드 객체도 참조로 비교한다(불변 갱신 전제) */
function sameMeta(a: Page, b: Page): boolean {
  for (const key of Object.keys(b) as (keyof Page)[]) {
    if (key === "content" || key === "updatedAt") continue;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * 바뀐 id만 구조 스냅샷을 고친다 (SYS-10). 구조가 그대로면 입력 객체를 그대로 돌려줘서
 * 본문만 고친 편집은 structure 참조를 바꾸지 않는다.
 */
function withMeta(
  structure: Record<string, PageMeta>,
  prev: Record<string, Page>,
  next: Record<string, Page>,
  ids: Iterable<string>,
): Record<string, PageMeta> {
  let out: Record<string, PageMeta> | null = null;
  for (const id of ids) {
    const page = next[id];
    if (!page) {
      if (!(id in structure)) continue;
      out ??= { ...structure };
      delete out[id];
      continue;
    }
    const before = prev[id];
    if (before && sameMeta(before, page)) continue;
    out ??= { ...structure };
    out[id] = metaOf(page);
  }
  return out ?? structure;
}

type Options = {
  delay?: number;
  /** 지금 시각 (테스트용) */
  now?: () => string;
  /** 버전 기록 정책 (테스트용). 없으면 저장소에 남긴다 (DATA-09) */
  history?: HistoryRecorder;
  /** 워크스페이스 세대 (테스트용). 없으면 앱 전체의 세대를 쓴다 (DATA-03, SYS-09) */
  generation?: () => number;
};

export function createPagesStore(
  storage: Storage,
  {
    delay,
    now = () => new Date().toISOString(),
    history: injected,
    generation = currentWorkspaceGeneration,
  }: Options = {},
) {
  return createStore<PagesState>()((set, get) => {
    const history = injected ?? createHistoryRecorder({ storage, latest: (id) => get().pages[id] });
    const queue = createSaveQueue({
      write: async (page) => {
        const keptExternal = await storage.writePage(page);
        // 바깥 내용을 버전 기록에 남겼으면 알린다 (DATA-07). 같은 충돌은 한 번만 남으므로 한 번만 알린다
        if (keptExternal) notifyKeptExternal(page.id);
        // 쓰기가 끝난 내용만 버전 후보로 본다 (DATA-09)
        history.observe(page);
      },
      delay,
      onStateChange: (saveState) => set({ saveState }),
      generation,
    });

    /** 읽는 중인 본문 — 페이지 id → 그 읽기 (같은 페이지를 두 번 읽지 않는다) */
    const inflight = new Map<string, Promise<void>>();
    /**
     * 본문이 없는 동안 구조만 고친 페이지. 본문이 도착하면 합쳐서 한 번 저장한다.
     * 자리 값 본문을 그대로 쓰면 파일의 본문이 지워지므로, 본문이 있을 때만 저장 큐에 넣는다.
     */
    const pendingMeta = new Set<string>();

    const put = (page: Page) => {
      set((s) => {
        const pages = { ...s.pages, [page.id]: page };
        return { pages, structure: withMeta(s.structure, s.pages, pages, [page.id]) };
      });
      if (isBodyLoaded(page)) {
        pendingMeta.delete(page.id);
        queue.schedule(page);
      } else pendingMeta.add(page.id);
    };

    /** 읽은 본문을 현재 페이지에 붙인다. 구조는 스토어의 것을 그대로 쓴다(그 사이 고친 내용이 있을 수 있다) */
    /**
     * 본문을 읽기만 한다. 스토어에는 넣지 않는다 — 검색 색인처럼 한 번 훑고 버리는 쪽이 쓴다 (SYS-10).
     * 기다리는 사이 워크스페이스가 바뀌었으면 빈 목록 (SYS-09)
     */
    const fetchPages = async (ids: string[]): Promise<Page[]> => {
      const gen = generation();
      const { pages: disk, errors } = await storage.readPages(ids);
      if (gen !== generation()) return [];
      if (errors.length) set({ loadErrors: [...get().loadErrors, ...errors] });
      return disk;
    };

    const readBodies = async (ids: string[]): Promise<void> => {
      const disk = await fetchPages(ids);
      const body = new Map(disk.map((p) => [p.id, p]));
      const pages = { ...get().pages };
      const loaded: string[] = [];
      for (const id of ids) {
        const cur = pages[id];
        const got = body.get(id);
        if (!cur || !got || isBodyLoaded(cur)) continue;
        pages[id] = { ...cur, content: got.content };
        loaded.push(id);
      }
      if (!loaded.length) return;
      set({ pages });
      for (const id of loaded) if (pendingMeta.delete(id)) queue.schedule(pages[id]!);
    };

    const ensureBodies = async (ids: string[]): Promise<void> => {
      const waits: Promise<void>[] = [];
      const todo: string[] = [];
      for (const id of ids) {
        const page = get().pages[id];
        if (!page || isBodyLoaded(page)) continue;
        const running = inflight.get(id);
        if (running) waits.push(running);
        else todo.push(id);
      }
      for (let i = 0; i < todo.length; i += BODY_BATCH) {
        const batch = todo.slice(i, i + BODY_BATCH);
        const run = readBodies(batch).catch((e) => {
          // 읽지 못한 페이지는 본문 없이 남고, 여는 쪽이 false로 안다
          console.warn("본문을 읽지 못했어요", e);
        });
        for (const id of batch) inflight.set(id, run);
        void run.then(() => {
          for (const id of batch) if (inflight.get(id) === run) inflight.delete(id);
        });
        waits.push(run);
      }
      await Promise.all(waits);
    };

    const ensureBody = async (id: string): Promise<boolean> => {
      await ensureBodies([id]);
      const page = get().pages[id];
      return !!page && isBodyLoaded(page);
    };

    return {
      history,
      loaded: false,
      loadSeq: 0,
      pages: {},
      structure: {},
      loadErrors: [],
      saveState: "saved",
      readBodies: fetchPages,
      async load() {
        const gen = generation();
        // 이전 워크스페이스의 대기·실패 저장은 이 목록과 함께 버린다
        queue.reset();
        inflight.clear();
        pendingMeta.clear();
        // 구조만 읽는다 (SYS-10, ADR-022). 본문은 여는 때 읽는다
        const { pages, errors } = await storage.loadPageMeta();
        // 기다리는 사이 워크스페이스가 바뀌었으면 이 결과는 이전 폴더의 것이다 (SYS-09)
        if (gen !== generation()) return;
        set({
          loaded: true,
          loadSeq: get().loadSeq + 1,
          pages: Object.fromEntries(pages.map((p) => [p.id, { ...p, content: UNLOADED_BODY }])),
          structure: Object.fromEntries(pages.map((p) => [p.id, metaOf(p)])),
          loadErrors: errors,
        });
      },
      ensureBody,
      ensureAllBodies: () => ensureBodies(Object.keys(get().pages)),
      create(init) {
        const page = createPage(init);
        if (!canContain(page.parentId ? get().pages[page.parentId] : null, page.kind))
          throw new Error("컬렉션 안에는 문서만 둘 수 있어요");
        put(page);
        return page;
      },
      update(id, patch) {
        const page = get().pages[id];
        if (!page) return;
        // 값이 그대로인 갱신은 편집이 아니다: 저장·updatedAt 갱신·버전 기록을 일으키지 않는다 (DATA-07 열기 쓰기 방지)
        if (Object.entries(patch).every(([k, v]) => sameValue(v, page[k as keyof Page]))) return;
        if (patch.parentId !== undefined && patch.parentId !== page.parentId) {
          const parent = patch.parentId ? get().pages[patch.parentId] : null;
          if (!canContain(parent, page.kind)) throw new Error("컬렉션 안에는 문서만 둘 수 있어요");
        }
        put({ ...page, ...patch, updatedAt: now() });
      },
      patchMany(patches) {
        const current = get().pages;
        const next = { ...current };
        for (const [id, patch] of Object.entries(patches)) {
          const page = current[id];
          if (!page) continue;
          next[id] = { ...page, ...patch };
          if (isBodyLoaded(next[id]!)) {
            pendingMeta.delete(id);
            queue.schedule(next[id]!);
          } else pendingMeta.add(id);
        }
        set((s) => ({
          pages: next,
          structure: withMeta(s.structure, current, next, Object.keys(patches)),
        }));
      },
      trash(id) {
        // 휴지통으로 가기 전 내용을 남긴다 (DATA-09). 실패해도 휴지통 이동은 막지 않는다
        const page = get().pages[id];
        if (page && isBodyLoaded(page)) void history.snapshot(page);
        else if (page)
          void ensureBody(id).then(() => {
            const latest = get().pages[id];
            if (latest && isBodyLoaded(latest)) void history.snapshot(latest);
          });
        get().update(id, { trashedAt: now() });
      },
      restore(id) {
        get().update(id, { trashedAt: null });
      },
      async purge(id) {
        const page = get().pages[id];
        if (!page?.trashedAt) return;
        // 저장 전에 본문이 있어야 한다. 구조만 고친 채 지우면 본문 없는 파일이 남을 수 있다
        if (!(await ensureBody(id))) throw new Error("본문을 읽지 못해 영구 삭제하지 못했어요");
        // 휴지통으로 옮긴 내용이 아직 파일에 안 갔으면 먼저 쓴다(Rust는 trashedAt을 보고 지운다)
        if (!(await queue.flushPage(id))) throw new Error("휴지통 이동을 저장하지 못했어요");
        // assets/<id>가 지워지기 전에, 그 이미지를 쓰는 다른 페이지(복제·복사)에 사본을 준다
        await get().adoptAssets(id);
        await storage.purgePage(id);
        history.cancel(id);
        queue.discard(id);
        pendingMeta.delete(id);
        set((s) => {
          const pages = { ...s.pages };
          delete pages[id];
          return { pages, structure: withMeta(s.structure, s.pages, pages, [id]) };
        });
      },
      flushPage: async (id) => {
        if (pendingMeta.has(id)) await ensureBody(id);
        return queue.flushPage(id);
      },
      async adoptAssets(owner) {
        // 다른 페이지가 이 페이지 폴더의 그림을 쓰는지 본문을 모두 봐야 안다
        await ensureBodies(Object.keys(get().pages));
        for (const page of Object.values(get().pages)) {
          if (page.id === owner) continue;
          const borrowed = assetRefs(page, { attachments: true }).filter(
            (src) => assetOwner(src) === owner,
          );
          if (!borrowed.length) continue;
          const map = new Map<string, string>();
          for (const src of borrowed) {
            try {
              const bytes = await storage.readAsset(src);
              // 이미지(img-…)는 이미지로, 파일 첨부는 첨부로 복사한다 (이미지 형식 검사를 피한다)
              map.set(
                src,
                isImageAssetPath(src)
                  ? await storage.writeAsset(page.id, bytes)
                  : (
                      await storage.importAttachmentBytes(page.id, {
                        name: attachmentFileName(src),
                        bytes,
                      })
                    ).path,
              );
            } catch (e) {
              // 이미 없는 이미지는 옮길 것이 없다
              if (!(e instanceof StorageError && e.code === "not_found")) throw e;
            }
          }
          if (!map.size) continue;
          const latest = get().pages[page.id]!;
          get().update(page.id, replaceAssetRefs(latest, map));
          if (!(await queue.flushPage(page.id))) throw new Error("이미지 사본을 저장하지 못했어요");
        }
      },
      externalRev: {},
      applyExternal({ pages: incoming, removed, base }) {
        const applied: string[] = [];
        const gone: string[] = [];
        const conflicts: string[] = [];
        const before = get().pages;
        const pages = { ...before };
        const rev = { ...get().externalRev };
        const busy = (id: string) =>
          queue.isUnsaved(id) || pendingMeta.has(id) || (!!base && base[id] !== pages[id]);
        for (const page of incoming) {
          if (busy(page.id)) {
            // 덮지 않은 바깥 내용도 버전 기록에 남긴다 (DATA-07·DATA-09): 나중에 버전 기록에서 되돌릴 수 있다
            void history.snapshot(page);
            conflicts.push(page.id);
          } else {
            const local = pages[page.id];
            // 덮이기 전의 이 앱 내용을 남긴다 (DATA-09). 내용이 같으면 남기지 않는다.
            // 본문을 연 적 없는 페이지는 덮이기 전 내용이 메모리에 없어 남기지 못한다
            if (local && isBodyLoaded(local) && fingerprint(local) !== fingerprint(page))
              void history.snapshot(local);
            pages[page.id] = page;
            rev[page.id] = (rev[page.id] ?? 0) + 1;
            applied.push(page.id);
          }
        }
        for (const id of removed) {
          if (!pages[id]) continue;
          // 고치는 중에 바깥에서 지워졌으면 이 앱의 내용을 남긴다(다음 저장 때 다시 쓴다)
          if (busy(id)) {
            if (!conflicts.includes(id)) conflicts.push(id);
          } else {
            delete pages[id];
            gone.push(id);
          }
        }
        if (applied.length || gone.length)
          set({
            pages,
            externalRev: rev,
            structure: withMeta(get().structure, before, pages, [...applied, ...gone]),
          });
        return { applied, removed: gone, conflicts };
      },
      flushAll: async () => {
        // 구조만 고친 페이지의 본문이 아직 오는 중이면 기다린 뒤 저장한다
        await ensureBodies([...pendingMeta]);
        // 본문을 못 읽은 페이지(pendingMeta)는 저장하지 못한 것이다 — 성공으로 보고하지 않는다
        const stuck = pendingMeta.size > 0;
        const ok = await queue.flush();
        return ok && !stuck;
      },
      retry: () => queue.retry(),
    };
  });
}

export type PagesStore = ReturnType<typeof createPagesStore>;
