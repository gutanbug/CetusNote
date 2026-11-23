import { ulid, type QuickNote, type Storage, type WorkspaceMeta } from "@/lib/storage";
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

export function createMetaStore(
  storage: Storage,
  { delay = 400, now = () => new Date().toISOString() } = {},
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return createStore<MetaState>()((set, get) => {
    const write = async () => {
      clearTimeout(timer);
      timer = undefined;
      const { meta } = get();
      if (!meta) return false;
      try {
        await storage.writeWorkspace(meta);
        return true;
      } catch {
        // 태그 색·순서는 다음 변경 때 다시 쓴다. 노트 내용은 페이지 파일에 따로 있다
        return false;
      }
    };
    const change = (meta: WorkspaceMeta) => {
      set({ meta });
      clearTimeout(timer);
      timer = setTimeout(() => void write(), delay);
    };
    return {
      meta: null,
      async reloadExternal() {
        if (timer !== undefined) return false;
        try {
          set({ meta: await storage.readWorkspace() });
          return true;
        } catch {
          return false;
        }
      },
      async load() {
        clearTimeout(timer);
        try {
          set({ meta: await storage.readWorkspace() });
        } catch {
          set({ meta: null });
        }
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
        if (meta && !meta.templatesSeeded) change({ ...meta, templatesSeeded: true });
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
        change({ ...meta, quickNotes: meta.quickNotes.filter((n) => n.id !== id) });
        return { note: meta.quickNotes[at]!, at };
      },
      restoreQuickNote({ note, at }) {
        const { meta } = get();
        if (!meta || meta.quickNotes.some((n) => n.id === note.id)) return;
        const quickNotes = [...meta.quickNotes];
        quickNotes.splice(Math.min(at, quickNotes.length), 0, note);
        change({ ...meta, quickNotes });
      },
      flush: write,
    };
  });
}

export type MetaStore = ReturnType<typeof createMetaStore>;
