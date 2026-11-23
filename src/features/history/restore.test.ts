import { createMemoryStorage, createPage, type Page } from "@/lib/storage";
import { describe, expect, it, vi } from "vitest";
import { createPagesStore } from "../pages/store";
import { createHistoryRecorder } from "./recorder";
import { restoreVersion } from "./restore";

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

async function setup() {
  const page: Page = {
    ...createPage({ title: "회의록" }),
    content: doc("처음 글") as Page["content"],
  };
  const storage = createMemoryStorage({ pages: [page] });
  // 자동 스냅샷 시계는 쓰지 않는다 — 테스트에서 직접 남긴다 (스토어가 따로 남기지 않게 같은 기록기를 넣는다)
  const holder: { pages?: ReturnType<typeof createPagesStore> } = {};
  const history = createHistoryRecorder({
    storage,
    latest: (id) => holder.pages?.getState().pages[id],
    // setTimeout은 2^31ms를 넘으면 바로 실행되므로 그보다 작게 (약 11일)
    intervalMs: 1_000_000_000,
  });
  const pages = createPagesStore(storage, { delay: 0, history });
  holder.pages = pages;
  await pages.getState().load();
  return { page, storage, pages, history };
}

describe("restoreVersion", () => {
  it("snapshots the current text, restores title and body, and undo brings the current text back", async () => {
    const { page, storage, pages, history } = await setup();
    expect(await history.snapshot(page)).toBe(true); // 처음 글 버전
    pages.getState().update(page.id, { title: "바뀐 제목", content: doc("두 번째 글") });
    await pages.getState().flushPage(page.id);

    const onContentChanged = vi.fn();
    const first = (await storage.listVersions(page.id))[0];
    const outcome = await restoreVersion(
      { storage, pages, history, onContentChanged },
      page.id,
      first.id,
    );
    expect(outcome.ok).toBe(true);
    const restored = pages.getState().pages[page.id];
    expect(restored.title).toBe("회의록");
    expect(restored.content).toEqual(doc("처음 글"));
    expect(onContentChanged).toHaveBeenCalledTimes(1);
    expect(storage.snapshot().pages[0].title).toBe("회의록");
    // 되돌리기 전 "두 번째 글"이 버전으로 남았다
    const versions = await storage.listVersions(page.id);
    expect(versions).toHaveLength(2);
    expect(await storage.readVersion(page.id, versions[0].id)).toMatchObject({
      title: "바뀐 제목",
    });

    if (!outcome.ok) throw new Error("unreachable");
    expect(await outcome.undo()).toBe(true);
    const undone = pages.getState().pages[page.id];
    expect(undone.title).toBe("바뀐 제목");
    expect(undone.content).toEqual(doc("두 번째 글"));
    history.cancel(page.id);
  });

  it("keeps id, position and properties", async () => {
    const { page, storage, pages, history } = await setup();
    pages.getState().update(page.id, { props: { ...page.props, tags: ["회의"] } });
    await history.snapshot(page);
    const v = (await storage.listVersions(page.id))[0];
    const outcome = await restoreVersion(
      { storage, pages, history, onContentChanged: () => {} },
      page.id,
      v.id,
    );
    expect(outcome.ok).toBe(true);
    const after = pages.getState().pages[page.id];
    expect(after.id).toBe(page.id);
    expect(after.parentId).toBe(page.parentId);
    expect(after.props.tags).toEqual(["회의"]);
    history.cancel(page.id);
  });

  it("does nothing when the version cannot be read", async () => {
    const { page, storage, pages, history } = await setup();
    pages.getState().update(page.id, { title: "그대로" });
    await pages.getState().flushPage(page.id);
    const outcome = await restoreVersion(
      { storage, pages, history, onContentChanged: () => {} },
      page.id,
      "20000101T000000000Z",
    );
    expect(outcome).toEqual({ ok: false, reason: "read" });
    expect(pages.getState().pages[page.id].title).toBe("그대로");
    history.cancel(page.id);
  });

  it("refuses to restore when the current text cannot be kept first", async () => {
    const { page, storage, pages, history } = await setup();
    await history.snapshot(page);
    const v = (await storage.listVersions(page.id))[0];
    const failing = { ...history, snapshot: async () => false };
    const outcome = await restoreVersion(
      { storage, pages, history: failing, onContentChanged: () => {} },
      page.id,
      v.id,
    );
    expect(outcome).toEqual({ ok: false, reason: "snapshot" });
    history.cancel(page.id);
  });
});
