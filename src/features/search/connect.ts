import type { PagesStore } from "@/features/pages";
import type { Page } from "@/lib/storage";
import type { SearchIndex } from "./search-index";

/** 이만큼 넘게 한꺼번에 바뀌면(불러오기 등) 색인을 나눠 만든다 (SYS-10) */
const BULK_THRESHOLD = 64;
/** 한 번의 조각 작업이 메인 스레드를 잡는 시간 상한 (ms) */
const BUDGET_MS = 8;

type Options = {
  budgetMs?: number;
  /** 다음 조각을 예약한다. 기본은 유휴 시간(requestIdleCallback), 없으면 setTimeout */
  schedule?: (run: () => void) => void;
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
 * 한꺼번에 많이 바뀌면(첫 불러오기) 바로 다 만들지 않고 유휴 시간에 조각으로 나눠 만든다 (SYS-10).
 * 완료 전에도 검색은 된다. 아직 안 색인된 페이지는 빠지고, 바뀐 뒤 아직 못 고친 페이지는 예전 내용으로 맞을 수 있다.
 * 조각이 끝나면 결과는 전체를 한 번에 만든 것과 같다.
 * 반환값을 부르면 연결을 끊는다.
 */
export function connectSearchIndex(
  store: PagesStore,
  index: SearchIndex,
  { budgetMs = BUDGET_MS, schedule = defaultSchedule }: Options = {},
): () => void {
  let prev = store.getState().pages;
  index.build(Object.values(prev));
  /** id → 색인에 넣은 페이지 객체. 같은 객체면 다시 만들지 않는다 */
  const indexed = new Map<string, Page>(Object.entries(prev));
  /** 새 조각 작업이 시작되면 이전 작업은 멈춘다 */
  let generation = 0;
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

  const buildInSlices = (next: Record<string, Page>) => {
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
          index.upsert(page);
          index.flush();
          indexed.set(id, page);
        }
        if (clock() - start >= budgetMs) break;
      }
      if (at < ids.length) schedule(step);
    };
    schedule(step);
  };

  const unsubscribe = store.subscribe((state) => {
    const next = state.pages;
    if (next === prev) return;
    const before = prev;
    prev = next;
    const changed: string[] = [];
    for (const [id, page] of Object.entries(next)) if (before[id] !== page) changed.push(id);
    const gone = Object.keys(before).filter((id) => !(id in next));
    for (const id of gone) {
      index.remove(id);
      indexed.delete(id);
    }
    if (changed.length > BULK_THRESHOLD) {
      buildInSlices(next);
      return;
    }
    for (const id of changed) {
      index.upsert(next[id]!);
      indexed.set(id, next[id]!);
    }
    if (changed.length) queueFlush();
  });
  return unsubscribe;
}
