import type { Page, PageVersion, Storage } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { createHistoryRecorder, fingerprint, SNAPSHOT_INTERVAL_MS } from "./recorder";

const ID = "01JD0000000000000000000000";
const MIN = 60_000;

const BASE = {
  schemaVersion: 6,
  id: ID,
  kind: "page",
  title: "회의록",
  icon: null,
  cover: null,
  parentId: null,
  props: { tags: [], status: null, assignee: null, due: null, values: {} },
  layout: { fullWidth: false, font: "default" },
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "첫 줄" }] }],
  },
  createdAt: "2026-11-21T00:00:00Z",
  updatedAt: "2026-11-21T00:00:00Z",
  trashedAt: null,
  template: null,
  collection: null,
} as unknown as Page;

const mk = (over: Partial<Page> = {}): Page => ({ ...BASE, ...over }) as Page;
const withText = (text: string): Page =>
  mk({
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    } as Page["content"],
  });

/** 가짜 시계: advance로 시간을 옮기면 그 사이 예약된 콜백이 차례로 돈다 */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    clock: {
      now: () => now,
      setTimeout: (run: () => void, ms: number) => {
        const id = nextId++;
        timers.set(id, { at: now + ms, run });
        return id;
      },
      clearTimeout: (handle: unknown) => {
        timers.delete(handle as number);
      },
    },
    advance(ms: number) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        timers.delete(due[0]);
        due[1].run();
      }
      now = target;
    },
    pending: () => timers.size,
  };
}

/** 저장 호출을 기록한다. fail이면 실패한다 */
function fakeStorage() {
  const saved: Page[] = [];
  const state = { fail: false };
  const storage: Pick<Storage, "saveVersion"> = {
    saveVersion: async (page: Page) => {
      if (state.fail) throw new Error("디스크");
      saved.push(page);
      return { id: "v", savedAt: "", size: 0, chars: 0 } as PageVersion;
    },
  };
  return { storage, saved, state };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function setup(initial: Page) {
  const timers = fakeClock();
  const store = fakeStorage();
  let current = initial;
  const rec = createHistoryRecorder({
    storage: store.storage,
    latest: (id) => (id === current.id ? current : undefined),
    clock: timers.clock,
  });
  return {
    rec,
    timers,
    saved: store.saved,
    state: store.state,
    set(next: Page) {
      current = next;
    },
  };
}

describe("fingerprint", () => {
  it("changes with title, icon or body, not with trashedAt or props", () => {
    const a = fingerprint(mk());
    expect(fingerprint(mk({ title: "다른 제목" }))).not.toBe(a);
    expect(fingerprint(mk({ icon: "📝" }))).not.toBe(a);
    expect(fingerprint(withText("바뀐 본문"))).not.toBe(a);
    expect(fingerprint(mk({ trashedAt: "2026-11-21T01:00:00Z" }))).toBe(a);
    expect(fingerprint(mk({ updatedAt: "2026-11-22T00:00:00Z" }))).toBe(a);
  });
});

describe("history recorder", () => {
  it("snapshots the first change at once and skips identical writes", async () => {
    const s = setup(mk());
    s.rec.observe(mk());
    await tick();
    expect(s.saved).toHaveLength(1);
    s.rec.observe(mk({ updatedAt: "later" })); // 내용 그대로
    await tick();
    expect(s.saved).toHaveLength(1);
  });

  it("holds changes made within 10 minutes and saves the latest one when the window ends", async () => {
    const s = setup(mk());
    s.rec.observe(mk());
    await tick();
    s.timers.advance(1 * MIN);
    s.set(withText("1분 뒤 수정"));
    s.rec.observe(withText("1분 뒤 수정"));
    s.timers.advance(3 * MIN);
    s.set(withText("4분 뒤 수정"));
    s.rec.observe(withText("4분 뒤 수정"));
    await tick();
    expect(s.saved).toHaveLength(1);

    s.timers.advance(SNAPSHOT_INTERVAL_MS - 4 * MIN);
    await tick();
    expect(s.saved).toHaveLength(2);
    expect(s.saved[1].content).toEqual(withText("4분 뒤 수정").content);
    expect(s.timers.pending()).toBe(0);
  });

  it("does not save at the window end when the content came back to the last snapshot", async () => {
    const s = setup(mk());
    s.rec.observe(mk());
    await tick();
    s.timers.advance(1 * MIN);
    s.set(withText("잠깐 바꿈"));
    s.rec.observe(withText("잠깐 바꿈"));
    s.set(mk());
    s.rec.observe(mk());
    s.timers.advance(SNAPSHOT_INTERVAL_MS);
    await tick();
    expect(s.saved).toHaveLength(1);
  });

  it("takes an immediate snapshot again once 10 minutes have passed", async () => {
    const s = setup(mk());
    s.rec.observe(mk());
    await tick();
    s.timers.advance(SNAPSHOT_INTERVAL_MS);
    s.set(withText("열 분 뒤"));
    s.rec.observe(withText("열 분 뒤"));
    await tick();
    expect(s.saved).toHaveLength(2);
  });

  it("ignores trash moves, folders and collections", async () => {
    const s = setup(mk());
    s.rec.observe(mk({ trashedAt: "2026-11-21T01:00:00Z" }));
    s.rec.observe(mk({ kind: "folder", title: "묶음" }));
    s.rec.observe(mk({ kind: "collection", title: "표" }));
    await tick();
    expect(s.saved).toHaveLength(0);
    expect(await s.rec.snapshot(mk({ kind: "folder" }))).toBe(true);
    expect(s.saved).toHaveLength(0);
  });

  it("forced snapshot (before restore or trash) skips duplicates and resets the window", async () => {
    const s = setup(mk());
    expect(await s.rec.snapshot(mk())).toBe(true);
    expect(s.saved).toHaveLength(1);
    expect(await s.rec.snapshot(mk())).toBe(true); // 같은 내용
    expect(s.saved).toHaveLength(1);

    s.timers.advance(2 * MIN);
    s.set(withText("되돌리기 전"));
    expect(await s.rec.snapshot(withText("되돌리기 전"))).toBe(true);
    expect(s.saved).toHaveLength(2);

    // 방금 남겼으므로 2분 뒤 수정은 10분 뒤로 밀린다
    s.timers.advance(2 * MIN);
    s.set(withText("2분 뒤"));
    s.rec.observe(withText("2분 뒤"));
    await tick();
    expect(s.saved).toHaveLength(2);
    s.timers.advance(SNAPSHOT_INTERVAL_MS - 2 * MIN);
    await tick();
    expect(s.saved).toHaveLength(3);
  });

  it("markSaved treats the restored content as already kept", async () => {
    const s = setup(mk());
    s.rec.observe(mk());
    await tick();
    const restored = withText("버전에서 되돌린 글");
    s.rec.markSaved(restored);
    s.set(restored);
    s.rec.observe(restored);
    await tick();
    expect(s.saved).toHaveLength(1);
  });

  it("a failed save is retried on the next change", async () => {
    const s = setup(mk());
    s.state.fail = true;
    expect(await s.rec.snapshot(mk())).toBe(false);
    s.state.fail = false;
    s.rec.observe(mk());
    await tick();
    expect(s.saved).toHaveLength(1);
  });

  it("cancel clears a pending snapshot", async () => {
    const s = setup(mk());
    s.rec.observe(mk());
    await tick();
    s.set(withText("예약"));
    s.rec.observe(withText("예약"));
    expect(s.timers.pending()).toBe(1);
    s.rec.cancel(ID);
    expect(s.timers.pending()).toBe(0);
  });
});
