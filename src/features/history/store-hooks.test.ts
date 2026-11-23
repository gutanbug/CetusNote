import { createMemoryStorage, createPage, type Page } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { createPagesStore } from "../pages/store";
import { createHistoryRecorder } from "./recorder";

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

async function setup() {
  const page: Page = {
    ...createPage({ title: "회의록" }),
    content: doc("처음") as Page["content"],
  };
  const storage = createMemoryStorage({ pages: [page] });
  const holder: { pages?: ReturnType<typeof createPagesStore> } = {};
  const history = createHistoryRecorder({
    storage,
    latest: (id) => holder.pages?.getState().pages[id],
    intervalMs: 1_000_000_000,
  });
  const pages = createPagesStore(storage, { delay: 0, history });
  holder.pages = pages;
  await pages.getState().load();
  const texts = async () =>
    Promise.all(
      (await storage.listVersions(page.id)).map(async (v) => {
        const p = await storage.readVersion(page.id, v.id);
        return p.title;
      }),
    );
  return { page, storage, pages, texts };
}

// 스냅샷은 비동기로 끝나므로 몇 번 양보한다
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

describe("version snapshots at risky moments", () => {
  it("keeps the local text before an external change overwrites it", async () => {
    const { page, pages, texts } = await setup();
    pages.getState().update(page.id, { title: "이 앱에서 고친 제목" });
    await pages.getState().flushPage(page.id);
    const local = pages.getState().pages[page.id];
    const incoming: Page = { ...local, title: "바깥에서 바꾼 제목" };

    const result = pages.getState().applyExternal({ pages: [incoming], removed: [] });
    expect(result.applied).toEqual([page.id]);
    await settle();
    expect(await texts()).toContain("이 앱에서 고친 제목");
  });

  it("does not keep a version when the external content is the same", async () => {
    const { page, pages, texts } = await setup();
    const local = pages.getState().pages[page.id];
    pages
      .getState()
      .applyExternal({ pages: [{ ...local, updatedAt: "바뀌었지만 내용은 같음" }], removed: [] });
    await settle();
    expect(await texts()).toEqual([]);
  });

  it("keeps the text before moving the page to the trash", async () => {
    const { page, pages, texts } = await setup();
    pages.getState().update(page.id, { title: "버리기 직전 제목" });
    await pages.getState().flushPage(page.id);
    pages.getState().trash(page.id);
    await settle();
    expect(await texts()).toContain("버리기 직전 제목");
    expect(pages.getState().pages[page.id].trashedAt).not.toBeNull();
  });
});
