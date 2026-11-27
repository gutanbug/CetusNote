import type { PagesStore } from "@/features/pages";
import { isBodyLoaded } from "@/features/pages/body";
import { summarizePage, type PageSummary, type SummaryIndex } from "@/features/pages/summary";
import type { Page } from "@/lib/storage";
import type { SearchIndex } from "./search-index";

/** 이만큼 넘게 한꺼번에 바뀌면(불러오기 등) 색인을 나눠 만든다 (SYS-10) */
const BULK_THRESHOLD = 64;
/** 한 번의 조각 작업이 메인 스레드를 잡는 시간 상한 (ms) */
const BUDGET_MS = 8;
/** 백그라운드에서 한 번에 읽는 본문 수 (SYS-10, ADR-022) */
const BODY_BATCH = 100;

type Options = {
  budgetMs?: number;
  /** 다음 조각을 예약한다. 기본은 유휴 시간(requestIdleCallback), 없으면 setTimeout */
  schedule?: (run: () => void) => void;
  /** 본문 읽기 (기본: 스토어의 readBodies). 본문 없이 시작한 페이지를 백그라운드에서 색인한다 */
  readBodies?: (ids: string[]) => Promise<Page[]>;
  /** 워크스페이스를 읽을 때마다, 본문 백그라운드 색인이 모두 끝나면 한 번 부른다 (검색 결과가 완전해진 때) */
  onComplete?: () => void;
  /** 본문 요약(백링크·홈 할 일·표지 그림)도 같은 읽기로 채운다 (SYS-10, ADR-022) */
  summaries?: SummaryIndex;
};

const defaultSchedule = (run: () => void) => {
  const ric = (
    globalThis as { requestIdleCallback?: (cb: () => void, o: { timeout: number }) => number }
  ).requestIdleCallback;
  if (ric) ric(run, { timeout: 200 });
  else setTimeout(run, 0);
};

const clock = () => (globalThis.performance ? globalThis.performance.now() : Date.now());

/**
 * 페이지 스토어 → 검색 인덱스 (ADR-003). 지금 페이지로 한 번 만들고, 그 뒤로는 바뀐 페이지만 고친다.
 * 페이지 객체는 고칠 때마다 새로 만들어지므로(불변) 참조가 달라진 것만 다시 색인한다.
 *
 * 워크스페이스를 읽으면(SYS-10, ADR-022) 제목만 먼저 만들고, 본문은 유휴 시간에 배치로 읽어 색인한다.
 * 읽은 본문은 스토어에 넣지 않고 색인에만 남긴다. 배치가 끝나기 전에도 검색은 된다(아직 못 읽은 본문의 낱말은 빠진다).
 * 모두 끝나면 결과는 전체를 한 번에 만든 것과 같고 `onComplete`를 부른다.
 *
 * 한꺼번에 많이 바뀌면(본문 일괄 읽기 등) 바로 다 만들지 않고 유휴 시간에 조각으로 나눠 만든다 (SYS-10).
 * 반환값을 부르면 연결을 끊는다.
 */
export function connectSearchIndex(
  store: PagesStore,
  index: SearchIndex,
  {
    budgetMs = BUDGET_MS,
    schedule = defaultSchedule,
    readBodies = (ids) => store.getState().readBodies(ids),
    onComplete,
    summaries,
  }: Options = {},
): () => void {
  const titleOf = (id: string) => store.getState().pages[id]?.title;
  let prev = store.getState().pages;
  let seenLoad = store.getState().loadSeq;
  index.build(Object.values(prev));
  /** id → 색인에 넣은 페이지 객체. 같은 객체면 다시 만들지 않는다 */
  const indexed = new Map<string, Page>(Object.entries(prev));
  /** 새 조각 작업이 시작되면 이전 작업은 멈춘다 */
  let generation = 0;
  /** 새 본문 읽기 작업이 시작되면 이전 작업은 멈춘다 */
  let bodyPass = 0;
  /** 고친 페이지의 본문 색인을 유휴 시간에 한 번 비운다 (찾기는 밀린 것을 스스로 먼저 비운다, SYS-11) */
  let flushQueued = false;
  const queueFlush = () => {
    if (flushQueued) return;
    flushQueued = true;
    schedule(() => {
      flushQueued = false;
      index.flush();
    });
  };

  /** 요약을 다시 뽑을 본문 있는 페이지 — 유휴 시간에 한꺼번에 뽑는다 (입력 경로에서 본문을 훑지 않는다) */
  const summaryQueue = new Set<string>();
  let summaryQueued = false;
  const queueSummary = (id: string) => {
    if (!summaries) return;
    summaryQueue.add(id);
    if (summaryQueued) return;
    summaryQueued = true;
    schedule(() => {
      summaryQueued = false;
      const entries: [string, PageSummary][] = [];
      for (const pid of summaryQueue) {
        const page = store.getState().pages[pid];
        if (page && isBodyLoaded(page)) entries.push([pid, summarizePage(page, titleOf)]);
      }
      summaryQueue.clear();
      summaries.setMany(entries);
    });
  };

  /** 본문을 읽은 페이지는 본문째로, 아직 안 읽은 페이지는 제목만 색인한다 */
  const put = (page: Page) => {
    if (isBodyLoaded(page)) {
      index.upsert(page);
      queueSummary(page.id);
    } else index.upsertTitle(page);
  };

  /** 조각으로 나눠 만든다. 다 만들면 done을 부른다(세대가 바뀌어 멈추면 부르지 않는다) */
  const buildInSlices = (next: Record<string, Page>, done?: () => void) => {
    const gen = ++generation;
    const ids = Object.keys(next);
    let at = 0;
    const step = () => {
      if (gen !== generation) return;
      const start = clock();
      while (at < ids.length) {
        const id = ids[at++]!;
        // 조각 사이에 바뀌거나 지워진 페이지는 최신 상태를 본다
        const page = store.getState().pages[id];
        if (page && indexed.get(id) !== page) {
          // 조각마다 바로 만들어야 조각 예산이 맞는다
          put(page);
          index.flush();
          indexed.set(id, page);
        }
        if (clock() - start >= budgetMs) break;
      }
      if (at < ids.length) schedule(step);
      else done?.();
    };
    schedule(step);
  };

  /**
   * 본문 없이 들어온 페이지의 본문을 배치로 읽어 색인한다. 읽는 동안 스토어에서 본문이 채워진 페이지는
   * 스토어 구독이 이미 색인했으므로 건너뛴다. 읽는 목록은 시작할 때 정하고, 워크스페이스가 다시 읽히면 처음부터 다시 한다.
   */
  const startBodies = () => {
    const pass = ++bodyPass;
    const queue = Object.keys(store.getState().pages).filter(
      (id) => !isBodyLoaded(store.getState().pages[id]!),
    );
    let at = 0;
    const step = async () => {
      if (pass !== bodyPass) return;
      if (at >= queue.length) {
        onComplete?.();
        return;
      }
      const batch = queue.slice(at, at + BODY_BATCH);
      at += batch.length;
      let disk: Page[] = [];
      try {
        disk = await readBodies(batch);
      } catch (e) {
        // 읽지 못한 페이지는 제목만 남는다. 다른 배치는 계속 읽는다
        console.warn("Search index: couldn't read the page body", e);
      }
      if (pass !== bodyPass) return;
      const now = store.getState().pages;
      const fresh: [string, PageSummary][] = [];
      for (const got of disk) {
        const page = now[got.id];
        if (!page || isBodyLoaded(page)) continue;
        // 구조(제목 등)는 스토어의 것을, 본문은 디스크의 것을 쓴다
        const full = { ...page, content: got.content };
        index.upsert(full);
        if (summaries) fresh.push([page.id, summarizePage(full, titleOf)]);
      }
      summaries?.setMany(fresh);
      queueFlush();
      schedule(() => void step());
    };
    schedule(() => void step());
  };

  const unsubscribe = store.subscribe((state) => {
    const next = state.pages;
    if (state.loadSeq !== seenLoad) {
      // 워크스페이스를 다시 읽었다: 제목부터 다시 만들고 본문은 백그라운드에서 읽는다
      seenLoad = state.loadSeq;
      prev = next;
      // 제목부터 조각으로 만든다. 제목이 다 들어간 뒤에 본문 읽기를 시작한다 (본문이 제목 색인보다 먼저 들어가지 않게)
      index.build([]);
      indexed.clear();
      summaries?.clear();
      buildInSlices(next, startBodies);
      return;
    }
    if (next === prev) return;
    const before = prev;
    prev = next;
    const changed: string[] = [];
    for (const [id, page] of Object.entries(next)) if (before[id] !== page) changed.push(id);
    const gone = Object.keys(before).filter((id) => !(id in next));
    for (const id of gone) {
      index.remove(id);
      indexed.delete(id);
      summaries?.remove(id);
    }
    if (changed.length > BULK_THRESHOLD) {
      buildInSlices(next);
      return;
    }
    for (const id of changed) {
      put(next[id]!);
      indexed.set(id, next[id]!);
    }
    if (changed.length) queueFlush();
  });
  startBodies();
  return () => {
    bodyPass++;
    generation++;
    unsubscribe();
  };
}
