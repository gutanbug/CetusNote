import {
  canContain,
  createPage,
  StorageError,
  type LoadError,
  type Page,
  type Storage,
} from "@/lib/storage";
import { assetOwner, assetRefs, replaceAssetRefs } from "./assets";
import { createStore } from "zustand/vanilla";
import { createSaveQueue, type SaveState } from "./save-queue";
import { createHistoryRecorder, fingerprint, type HistoryRecorder } from "../history/recorder";

export type PagesState = {
  loaded: boolean;
  pages: Record<string, Page>;
  /** 읽지 못한 파일 — 앱은 건드리지 않고 알리기만 한다 */
  loadErrors: LoadError[];
  /** SH-SaveStatus에 그대로 넘긴다 (DATA-02) */
  saveState: SaveState;
  load(): Promise<void>;
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

type Options = {
  delay?: number;
  /** 지금 시각 (테스트용) */
  now?: () => string;
  /** 버전 기록 정책 (테스트용). 없으면 저장소에 남긴다 (DATA-09) */
  history?: HistoryRecorder;
};

export function createPagesStore(
  storage: Storage,
  { delay, now = () => new Date().toISOString(), history: injected }: Options = {},
) {
  return createStore<PagesState>()((set, get) => {
    const history = injected ?? createHistoryRecorder({ storage, latest: (id) => get().pages[id] });
    const queue = createSaveQueue({
      write: async (page) => {
        await storage.writePage(page);
        // 쓰기가 끝난 내용만 버전 후보로 본다 (DATA-09)
        history.observe(page);
      },
      delay,
      onStateChange: (saveState) => set({ saveState }),
    });

    const put = (page: Page) => {
      set((s) => ({ pages: { ...s.pages, [page.id]: page } }));
      queue.schedule(page);
    };

    return {
      history,
      loaded: false,
      pages: {},
      loadErrors: [],
      saveState: "saved",
      async load() {
        const { pages, errors } = await storage.loadPages();
        set({
          loaded: true,
          pages: Object.fromEntries(pages.map((p) => [p.id, p])),
          loadErrors: errors,
        });
      },
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
          queue.schedule(next[id]!);
        }
        set({ pages: next });
      },
      trash(id) {
        // 휴지통으로 가기 전 내용을 남긴다 (DATA-09). 실패해도 휴지통 이동은 막지 않는다
        const page = get().pages[id];
        if (page) void history.snapshot(page);
        get().update(id, { trashedAt: now() });
      },
      restore(id) {
        get().update(id, { trashedAt: null });
      },
      async purge(id) {
        const page = get().pages[id];
        if (!page?.trashedAt) return;
        // 휴지통으로 옮긴 내용이 아직 파일에 안 갔으면 먼저 쓴다(Rust는 trashedAt을 보고 지운다)
        if (!(await queue.flushPage(id))) throw new Error("휴지통 이동을 저장하지 못했어요");
        // assets/<id>가 지워지기 전에, 그 이미지를 쓰는 다른 페이지(복제·복사)에 사본을 준다
        await get().adoptAssets(id);
        await storage.purgePage(id);
        history.cancel(id);
        queue.discard(id);
        set((s) => {
          const pages = { ...s.pages };
          delete pages[id];
          return { pages };
        });
      },
      flushPage: (id) => queue.flushPage(id),
      async adoptAssets(owner) {
        for (const page of Object.values(get().pages)) {
          if (page.id === owner) continue;
          const borrowed = assetRefs(page).filter((src) => assetOwner(src) === owner);
          if (!borrowed.length) continue;
          const map = new Map<string, string>();
          for (const src of borrowed) {
            try {
              map.set(src, await storage.writeAsset(page.id, await storage.readAsset(src)));
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
        const pages = { ...get().pages };
        const rev = { ...get().externalRev };
        const busy = (id: string) => queue.isUnsaved(id) || (!!base && base[id] !== pages[id]);
        for (const page of incoming) {
          if (busy(page.id)) conflicts.push(page.id);
          else {
            const local = pages[page.id];
            // 덮이기 전의 이 앱 내용을 남긴다 (DATA-09). 내용이 같으면 남기지 않는다
            if (local && fingerprint(local) !== fingerprint(page)) void history.snapshot(local);
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
        if (applied.length || gone.length) set({ pages, externalRev: rev });
        return { applied, removed: gone, conflicts };
      },
      flushAll: () => queue.flush(),
      retry: () => queue.retry(),
    };
  });
}

export type PagesStore = ReturnType<typeof createPagesStore>;
