import type { Page, Storage } from "@/lib/storage";

/** 자동 스냅샷 간격 (DATA-09): 페이지마다 최대 10분에 한 번 */
export const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;

/** 시간 — 테스트에서 가짜 시계로 바꾼다 */
export type HistoryClock = {
  now(): number;
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export const systemClock: HistoryClock = {
  now: () => Date.now(),
  setTimeout: (run, ms) => globalThis.setTimeout(run, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * 내용 지문: 제목·아이콘·본문 JSON의 cyrb53 해시 + 길이.
 * 바뀌었는지만 보는 용도라 충돌하면 스냅샷 한 번을 건너뛸 뿐이다.
 */
export function fingerprint(page: Pick<Page, "title" | "icon" | "content">): string {
  const s = JSON.stringify([page.title, page.icon, page.content]);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `${hash.toString(36)}:${s.length}`;
}

export type HistoryRecorder = {
  /** 저장된 페이지를 본다. 내용이 바뀌었고 10분이 지났으면 바로, 아니면 그 시각에 맞춰 한 번 남긴다 */
  observe(page: Page): void;
  /** 지금 남긴다(되돌리기·휴지통 전). 마지막 스냅샷과 같으면 건너뛴다. 남겼거나 같으면 true */
  snapshot(page: Page): Promise<boolean>;
  /** 이 내용을 방금 되돌렸다 — 되돌린 버전을 기준으로 삼아 바로 다시 남기지 않는다 */
  markSaved(page: Page): void;
  /** 페이지를 영구 삭제했다 — 예약된 스냅샷을 지운다 */
  cancel(pageId: string): void;
};

type Track = {
  /** 마지막으로 남긴 내용의 지문 */
  hash: string | null;
  /** 마지막으로 남긴 시각 */
  at: number | null;
  timer: unknown;
  /** 한 페이지의 스냅샷은 차례로 — 같은 내용이면 뒤의 것은 건너뛴다 */
  chain: Promise<boolean>;
};

/** 스냅샷 정책 (DATA-09). 페이지 파일을 쓸 때마다 observe를 부른다 */
export function createHistoryRecorder({
  storage,
  latest,
  clock = systemClock,
  intervalMs = SNAPSHOT_INTERVAL_MS,
}: {
  storage: Pick<Storage, "saveVersion">;
  /** 지금 메모리의 페이지 (예약된 스냅샷이 마지막 내용을 읽는다) */
  latest: (pageId: string) => Page | undefined;
  clock?: HistoryClock;
  intervalMs?: number;
}): HistoryRecorder {
  const tracks = new Map<string, Track>();
  const track = (id: string): Track => {
    let t = tracks.get(id);
    if (!t) {
      t = { hash: null, at: null, timer: undefined, chain: Promise.resolve(true) };
      tracks.set(id, t);
    }
    return t;
  };
  const clearTimer = (t: Track) => {
    if (t.timer !== undefined) clock.clearTimeout(t.timer);
    t.timer = undefined;
  };
  /** 문서만 남긴다 — 폴더·컬렉션은 본문이 없어 뺀다 */
  const eligible = (p: Page) => p.kind === "page";

  const take = (id: string, page: Page, fp: string): Promise<boolean> => {
    const t = track(id);
    t.chain = t.chain.then(async () => {
      if (fp === t.hash) return true;
      try {
        await storage.saveVersion(page);
        t.hash = fp;
        t.at = clock.now();
        // 방금 남겼으니 예약은 다시 계산한다
        clearTimer(t);
        return true;
      } catch {
        return false;
      }
    });
    return t.chain;
  };

  return {
    observe(page) {
      if (!eligible(page) || page.trashedAt) return;
      const t = track(page.id);
      const fp = fingerprint(page);
      if (fp === t.hash) return;
      const now = clock.now();
      if (t.at === null || now - t.at >= intervalMs) {
        void take(page.id, page, fp);
        return;
      }
      if (t.timer === undefined) {
        t.timer = clock.setTimeout(
          () => {
            t.timer = undefined;
            const cur = latest(page.id);
            if (cur && eligible(cur) && !cur.trashedAt) void take(page.id, cur, fingerprint(cur));
          },
          t.at + intervalMs - now,
        );
      }
    },
    snapshot(page) {
      if (!eligible(page)) return Promise.resolve(true);
      return take(page.id, page, fingerprint(page));
    },
    markSaved(page) {
      const t = track(page.id);
      t.hash = fingerprint(page);
      t.at = clock.now();
      clearTimer(t);
    },
    cancel(pageId) {
      const t = tracks.get(pageId);
      if (t) clearTimer(t);
      tracks.delete(pageId);
    },
  };
}
