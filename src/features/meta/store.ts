import { ulid, type QuickNote, type Storage, type WorkspaceMeta } from "@/lib/storage";
import { currentWorkspaceGeneration } from "@/features/workspace/generation";
import { createStore } from "zustand/vanilla";

/**
 * workspace.json — 태그 색, 형제 순서, 즐겨찾기 (architecture §3).
 * 워크스페이스를 열 때 읽고, 바뀌면 잠깐 모았다가 쓴다.
 */
export type MetaState = {
  meta: WorkspaceMeta | null;
  load(): Promise<void>;
  /** 태그 색을 정한다(없던 태그면 새로 생긴다) */
  setTagColor(name: string, color: string): void;
  /** 태그 색 전체를 한 번에 바꾼다 (태그 관리 SHELL-18 — 이름 바꾸기·합치기·삭제 뒤) */
  replaceTagColors(tags: Record<string, string>): void;
  /** 즐겨찾기 넣기/빼기 (PAGE-05) */
  toggleFavorite(id: string): void;
  /** 즐겨찾기에서 지운다(영구 삭제한 페이지) */
  forget(id: string): void;
  /** 워크스페이스 이름(사이드바·설정). 빈 문자열이면 폴더 이름을 쓴다 */
  setName(name: string): void;
  /** 기본 템플릿 사본을 넣었다고 적는다 (PAGE-14) */
  markTemplatesSeeded(): void;
  /** 형제 순서. parentId가 null이면 최상위("root") */
  setOrder(parentId: string | null, ids: string[]): void;
  /** 빠른 메모 저장(QN-01). 바로 파일에 쓰고, 쓰지 못하면 false — 글을 잃지 않게 부르는 쪽이 들고 있는다 */
  addQuickNote(text: string): Promise<boolean>;
  /** 빠른 메모 지우기 — 지운 메모와 자리를 돌려준다(실행 취소용) */
  removeQuickNote(id: string): RemovedNote | undefined;
  /** 지운 메모를 원래 자리에 되돌린다 */
  restoreQuickNote(removed: RemovedNote): void;
  flush(): Promise<boolean>;
  /** 바깥에서 workspace.json이 바뀌었을 때 다시 읽는다 (DATA-07). 아직 쓰지 않은 변경이 있으면 그대로 두고 false */
  reloadExternal(): Promise<boolean>;
};

export type RemovedNote = { note: QuickNote; at: number };

/**
 * 빠른 메모 합치기. 빠른 입력 창이 디스크에 붙인 메모(`disk`)를 살리고, 이 창이 들고 있는 메모(`local`)를 더한다.
 * `deleted`에 든 id는 이 창에서 지운 것이므로 디스크에 남아 있어도 뺀다.
 */
export function mergeQuickNotes(
  disk: QuickNote[],
  local: QuickNote[],
  deleted: ReadonlySet<string>,
): QuickNote[] {
  const seen = new Set<string>();
  const out: QuickNote[] = [];
  for (const n of [...disk, ...local]) {
    if (seen.has(n.id) || deleted.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out;
}

type MetaOptions = {
  delay?: number;
  now?: () => string;
  /** 워크스페이스 세대 (테스트용). 없으면 앱 전체의 세대를 쓴다 (DATA-03) */
  generation?: () => number;
};

export function createMetaStore(
  storage: Storage,
  {
    delay = 400,
    now = () => new Date().toISOString(),
    generation = currentWorkspaceGeneration,
  }: MetaOptions = {},
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** 지금 들고 있는 meta가 읽힌 워크스페이스 세대. 다른 세대면 다른 폴더의 내용이므로 쓰지 않는다 */
  let loadedGen: number | null = null;
  /**
   * 사용자가 바꾼 내용이 아직 파일에 가지 않았는가. 열 때 채우는 값(templatesSeeded)은 여기에 넣지 않는다 —
   * 그 쓰기가 실패해도 워크스페이스 전환을 막지 않는다(DATA-03). 전환할 때는 이 값이 true일 때만 쓴다.
   */
  let dirty = false;
  /** 이 창에서 지운 빠른 메모 id. 디스크에 남은 같은 메모를 저장할 때 다시 살리지 않는다 */
  const deletedNotes = new Set<string>();
  return createStore<MetaState>()((set, get) => {
    const write = async () => {
      clearTimeout(timer);
      timer = undefined;
      const { meta } = get();
      if (!meta) return false;
      if (loadedGen !== generation()) return false;
      const wasDirty = dirty;
      dirty = false;
      try {
        // 빠른 입력 창(별도 창)이 쓴 메모가 디스크에 있을 수 있다. 덮어쓰지 않도록 다시 읽어 합친다
        let quickNotes = meta.quickNotes;
        try {
          const disk = await storage.readWorkspace();
          quickNotes = mergeQuickNotes(disk.quickNotes ?? [], meta.quickNotes, deletedNotes);
        } catch {
          // 읽지 못하면 이 창이 든 목록만 쓴다(이전 동작과 같다)
        }
        const next = { ...meta, quickNotes };
        await storage.writeWorkspace(next);
        // 합쳐진 목록을 이 창에도 반영한다(그 사이 메모를 다시 읽는 일을 줄인다)
        if (get().meta === meta) set({ meta: next });
        return true;
      } catch {
        // 태그 색·순서는 다음 변경 때 다시 쓴다. 노트 내용은 페이지 파일에 따로 있다
        dirty = dirty || wasDirty;
        return false;
      }
    };
    const change = (meta: WorkspaceMeta, userChange = true) => {
      set({ meta });
      if (userChange) dirty = true;
      clearTimeout(timer);
      timer = setTimeout(() => void write(), delay);
    };
    return {
      meta: null,
      async reloadExternal() {
        if (timer !== undefined) return false;
        const gen = generation();
        try {
          const next = await storage.readWorkspace();
          if (gen !== generation()) return false;
          set({ meta: next });
          loadedGen = gen;
          return true;
        } catch {
          return false;
        }
      },
      async load() {
        clearTimeout(timer);
        dirty = false;
        deletedNotes.clear();
        const gen = generation();
        let next: WorkspaceMeta | null;
        try {
          next = await storage.readWorkspace();
        } catch {
          next = null;
        }
        // 읽는 사이 워크스페이스가 바뀌었으면 이전 워크스페이스의 태그·순서로 덮지 않는다 (SYS-09)
        if (gen !== generation()) return;
        set({ meta: next });
        loadedGen = gen;
      },
      setTagColor(name, color) {
        const { meta } = get();
        if (!meta || meta.tags[name] === color) return;
        change({ ...meta, tags: { ...meta.tags, [name]: color } });
      },
      replaceTagColors(tags) {
        const { meta } = get();
        if (!meta) return;
        change({ ...meta, tags });
      },
      toggleFavorite(id) {
        const { meta } = get();
        if (!meta) return;
        const favorites = meta.favorites.includes(id)
          ? meta.favorites.filter((f) => f !== id)
          : [...meta.favorites, id];
        change({ ...meta, favorites });
      },
      forget(id) {
        const { meta } = get();
        if (!meta) return;
        const order = Object.fromEntries(
          Object.entries(meta.order)
            .filter(([k]) => k !== id)
            .map(([k, ids]) => [k, ids.filter((x) => x !== id)]),
        );
        change({ ...meta, favorites: meta.favorites.filter((f) => f !== id), order });
      },
      setName(name) {
        const { meta } = get();
        if (meta && meta.name !== name) change({ ...meta, name });
      },
      markTemplatesSeeded() {
        const { meta } = get();
        if (meta && !meta.templatesSeeded) change({ ...meta, templatesSeeded: true }, false);
      },
      setOrder(parentId, ids) {
        const { meta } = get();
        if (!meta) return;
        change({ ...meta, order: { ...meta.order, [parentId ?? "root"]: ids } });
      },
      async addQuickNote(text) {
        const { meta } = get();
        if (!meta || !text.trim()) return false;
        const note = { id: ulid(), text: text.trim(), createdAt: now() };
        set({ meta: { ...meta, quickNotes: [...meta.quickNotes, note] } });
        if (await write()) return true;
        // 못 썼으면 목록에서도 빼 둔다 — 입력 칸의 글은 부르는 쪽이 그대로 둔다
        const cur = get().meta;
        if (cur)
          set({ meta: { ...cur, quickNotes: cur.quickNotes.filter((n) => n.id !== note.id) } });
        return false;
      },
      removeQuickNote(id) {
        const { meta } = get();
        const at = meta?.quickNotes.findIndex((n) => n.id === id) ?? -1;
        if (!meta || at < 0) return undefined;
        deletedNotes.add(id);
        change({ ...meta, quickNotes: meta.quickNotes.filter((n) => n.id !== id) });
        return { note: meta.quickNotes[at]!, at };
      },
      restoreQuickNote({ note, at }) {
        const { meta } = get();
        if (!meta || meta.quickNotes.some((n) => n.id === note.id)) return;
        deletedNotes.delete(note.id);
        const quickNotes = [...meta.quickNotes];
        quickNotes.splice(Math.min(at, quickNotes.length), 0, note);
        change({ ...meta, quickNotes });
      },
      /** 전환 전 저장 (DATA-03). 사용자가 바꾼 내용이 없으면 쓰지 않고 통과한다 */
      flush: async () => (dirty ? write() : true),
    };
  });
}

export type MetaStore = ReturnType<typeof createMetaStore>;
