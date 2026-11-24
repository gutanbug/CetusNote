import "@/styles/globals.css";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/*
 * 컬렉션 성능 측정 (SYS-11) — 레코드 1만 건 컬렉션을 실제 App에서 열어 잰다.
 * React Fiber 트리를 DevTools 훅으로 받아, 한 번의 조작에서 다시 그려진 표 행(tr) 수를 센다.
 * 시간은 콘솔에 [perf] 줄로 남긴다 (회귀 판정은 행 수·DOM 수로만 한다 — 시간은 기기마다 달라서).
 *
 * React를 가져오기 전에 훅을 달아야 해서, App은 동적으로 가져온다.
 */

type Fiber = {
  tag: number;
  type: unknown;
  flags: number;
  child: Fiber | null;
  sibling: Fiber | null;
  memoizedProps?: Record<string, unknown> & { role?: string };
};
let committed: { current: Fiber } | null = null;
(globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
  isDisabled: false,
  supportsFiber: true,
  renderers: new Map(),
  inject: () => 1,
  onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
    committed = root;
  },
  onCommitFiberUnmount: () => {},
  onPostCommitFiberRoot: () => {},
  checkDCE: () => {},
};

/** 깊이 우선으로 모든 Fiber를 돈다 */
function eachFiber(fn: (f: Fiber) => void) {
  const stack: Fiber[] = committed ? [committed.current] : [];
  while (stack.length) {
    const n = stack.pop()!;
    fn(n);
    if (n.sibling) stack.push(n.sibling);
    if (n.child) stack.push(n.child);
  }
}
/** 다음 조작에서 이전 커밋의 표식을 지운다 (건너뛴 행이 옛 표식을 달고 있지 않도록) */
function clearFlags() {
  eachFiber((f) => {
    f.flags = 0;
  });
}
/**
 * 이번 커밋에서 다시 그려진 행 수. 기존 행은 tr의 Update(또는 Placement) 표식으로,
 * 새로 붙은 행은 그 행을 그리는 GridRow의 Placement·PerformedWork 표식으로 센다 (GridRow가 없는 판은 tr만 센다).
 */
function countRowsRendered(): number {
  let n = 0;
  const stack: { f: Fiber; inFlaggedRow: boolean }[] = [];
  if (committed) stack.push({ f: committed.current, inFlaggedRow: false });
  while (stack.length) {
    const { f, inFlaggedRow } = stack.pop()!;
    const t = f.type as { name?: string; type?: { name?: string } } | string | null;
    const isGridRow =
      (typeof t === "object" || typeof t === "function") &&
      t !== null &&
      ((t as { name?: string }).name === "GridRow" || t.type?.name === "GridRow");
    const isRow =
      f.tag === 5 &&
      f.type === "tr" &&
      f.memoizedProps?.role === "row" &&
      Number(f.memoizedProps?.["aria-rowindex"]) > 1;
    let childInFlagged = inFlaggedRow;
    if (isGridRow && (f.flags & 3) !== 0) {
      n++;
      childInFlagged = true;
    } else if (isRow && !inFlaggedRow && (f.flags & 6) !== 0) {
      n++;
    }
    if (f.sibling) stack.push({ f: f.sibling, inFlaggedRow });
    if (f.child) stack.push({ f: f.child, inFlaggedRow: childInFlagged });
  }
  return n;
  return n;
}
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const pagesStoreRef = async () => (await import("@/features/pages")).pagesStore;
const frames = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
async function settle(done: () => boolean, limit = 5000) {
  for (let i = 0; i < limit && !done(); i++) await tick();
}
const rowCount = () => document.querySelectorAll('tbody[role="rowgroup"] tr[role="row"]').length;
const WAIT = { timeout: 30_000 };

type Result = { name: string; ms: number; rows?: number; dom?: number };
const results: Result[] = [];
const report = (r: Result) => {
  results.push(r);
  console.log(`[perf] ${JSON.stringify(r)}`);
};

let root: { unmount: () => void } | null = null;
let container: HTMLDivElement | null = null;
let collectionId = "";
let recordIds: string[] = [];

beforeAll(async () => {
  const [reactDom, { default: App }, { PlatformContext }] = await Promise.all([
    import("react-dom/client"),
    import("@/App"),
    import("@/components/ui/platform-context"),
  ]);
  const { PageIconProvider } = await import("@/components/ui/page-icon");
  const { sampleResolveImage } = await import("@/components/ui/page-icon-sample");
  const { TooltipProvider } = await import("@/components/ui/tooltip");
  const { currentPlatform } = await import("@/lib/platform-labels");
  const { pagesStore } = await import("@/features/pages");
  const { openPageFrom } = await import("./tabs");
  const { makePerfCollection } = await import("@/features/collection/perf-fixtures");

  container = document.createElement("div");
  document.body.appendChild(container);
  const r = reactDom.createRoot(container);
  root = r;
  r.render(
    <PlatformContext.Provider value={currentPlatform()}>
      <TooltipProvider>
        <PageIconProvider resolveImage={sampleResolveImage}>
          <App />
        </PageIconProvider>
      </TooltipProvider>
    </PlatformContext.Provider>,
  );

  await vi.waitFor(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("기본 위치에 만들기"),
    );
    if (!btn) throw new Error("첫 실행 버튼 대기 중");
    btn.click();
  }, WAIT);
  await vi.waitFor(() => {
    if (!document.querySelector('[data-slot="main-screen"]')) throw new Error("메인 화면 대기 중");
  }, WAIT);

  const { collection, pages } = makePerfCollection(10_000, { noise: 200 });
  collectionId = collection.id;
  recordIds = Object.values(pages)
    .filter((p) => p.parentId === collection.id)
    .map((p) => p.id);
  pagesStore.setState((s) => ({ pages: { ...s.pages, ...pages } }));
  // 레코드 상세는 옆 패널로 (기본은 모달이라 측정 대상을 명확히 한다)
  pagesStore.getState().update(collection.id, {
    collection: { ...collection.collection!, openMode: "side" },
  });

  // 열기
  clearFlags();
  const t0 = performance.now();
  openPageFrom(collection.id, null);
  await settle(() => rowCount() > 0);
  await frames();
  report({
    name: "open-grid-10k",
    ms: round(performance.now() - t0),
    rows: rowCount(),
    dom: document.getElementsByTagName("*").length,
  });
}, 120_000);

afterAll(() => {
  root?.unmount();
  container?.remove();
  console.log(`[perf-summary] ${JSON.stringify(results)}`);
});

const round = (n: number) => Math.round(n * 10) / 10;

/** 조작 하나를 재고 (commit까지 — 한 틱 기다린 뒤). 행 수를 함께 셀 때는 그 커밋에서 다시 그려진 행 수를 붙인다 */
async function timed(
  name: string,
  act: () => void,
  done: () => boolean = () => true,
  withRows = true,
): Promise<number> {
  clearFlags();
  const t0 = performance.now();
  act();
  if (name.startsWith("cell-edit"))
    console.log("[probe-sync]", name, round(performance.now() - t0));
  await tick();
  await settle(done, 1000);
  const ms = performance.now() - t0;
  const rows = countRowsRendered();
  report(withRows ? { name, ms: round(ms), rows } : { name, ms: round(ms) });
  return rows;
}

/** 지금 화면에 그려진 행 가운데 하나의 레코드 id (제목으로 찾는다) */
function visibleRecordIds(n: number): string[] {
  const { pages } = pagesStoreNow();
  const byTitle = new Map<string, string>();
  for (const id of recordIds) byTitle.set(pages[id]!.title, id);
  const titles = [
    ...document.querySelectorAll<HTMLElement>('tbody tr td[data-col="0"] button span.truncate'),
  ]
    .map((el) => el.textContent ?? "")
    .slice(0, n);
  return titles.map((t) => byTitle.get(t)).filter((x): x is string => !!x);
}

function pagesStoreNow() {
  return { pages: pagesStoreRefSync!.getState().pages };
}
let pagesStoreRefSync: Awaited<ReturnType<typeof pagesStoreRef>> | null = null;

describe("SYS-11 컬렉션 성능 측정 (1만 건, 표)", () => {
  it("셀 편집 — 보이는 한 행만 다시 그린다", async () => {
    pagesStoreRefSync = await pagesStoreRef();
    const pagesStore = pagesStoreRefSync;
    const ids = visibleRecordIds(5);
    expect(ids.length).toBeGreaterThan(0);
    const rowsPerEdit: number[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const rec = pagesStore.getState().pages[id]!;
      const rows = await timed(`cell-edit-${i}`, () =>
        pagesStore.getState().update(id, {
          props: { ...rec.props, values: { ...rec.props.values, fperfnum01: 1000 + i } },
        }),
      );
      rowsPerEdit.push(rows);
    }
    console.log(`[perf] cell-edit rows rendered per edit: ${rowsPerEdit.join(",")}`);
    expect(Math.max(...rowsPerEdit)).toBeLessThanOrEqual(1);
  });

  it("속성 메뉴 열기 · 레코드 상세 열기", async () => {
    const head = [...document.querySelectorAll<HTMLButtonElement>("thead th button")].find((b) =>
      b.textContent?.includes("상태"),
    );
    expect(head).toBeTruthy();
    clearFlags();
    const t1 = performance.now();
    // 속성 칸 머리는 Radix Popover 트리거다 (click으로 연다)
    head!.click();
    await settle(() => !!document.querySelector('[role="dialog"]'), 1000);
    report({
      name: "property-menu-open",
      ms: round(performance.now() - t1),
      rows: countRowsRendered(),
    });
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await settle(() => !document.querySelector('[role="dialog"]'), 300);

    const titleBtn = document.querySelector<HTMLButtonElement>("tbody tr td button");
    expect(titleBtn).toBeTruthy();
    await timed(
      "record-detail-open",
      () => titleBtn!.click(),
      () => !!document.querySelector('input[aria-label="제목"]'),
    );
  });

  it("정렬 변경 · 보기 전환", async () => {
    const pagesStore = pagesStoreRefSync!;
    const col = () => pagesStore.getState().pages[collectionId]!;
    const firstTitle = () =>
      document.querySelector('tbody tr td[data-col="0"] button span.truncate')?.textContent;
    const before = firstTitle();
    await timed(
      "sort-change",
      () =>
        pagesStore.getState().update(collectionId, {
          collection: { ...col().collection!, sort: { field: "due", dir: "asc" } },
        }),
      () => firstTitle() !== before,
      false,
    );
    await timed(
      "sort-clear",
      () =>
        pagesStore.getState().update(collectionId, {
          collection: { ...col().collection!, sort: null },
        }),
      () => firstTitle() === before,
      false,
    );
    await timed(
      "view-to-board",
      () =>
        pagesStore.getState().update(collectionId, {
          collection: { ...col().collection!, view: "board" },
        }),
      () => rowCount() === 0,
      false,
    );
    await frames();
    await timed(
      "view-to-grid",
      () =>
        pagesStore.getState().update(collectionId, {
          collection: { ...col().collection!, view: "grid" },
        }),
      () => rowCount() > 0,
      false,
    );
    await frames();
  });
});
