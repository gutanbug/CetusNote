import { describe, expect, it } from "vitest";
import { createMemoryStorage, contentChars, HISTORY_KEEP, versionName } from "./memory";
import { StorageError, type Page } from "./types";
import { createPage } from "./schema";

const ID = "01JD0000000000000000000000";
const ID2 = "01JD0000000000000000000001";

const pageWith = (id: string, text: string, trashedAt: string | null = null): Page =>
  ({
    ...createPage({ title: "회의록" }),
    id,
    trashedAt,
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
  }) as Page;

describe("memory storage: page versions (DATA-09)", () => {
  it("names versions by UTC time and counts characters of text nodes", () => {
    expect(versionName(1_700_000_000_123)).toBe("20231114T221320123Z");
    expect(contentChars({ type: "doc", content: [{ type: "text", text: "안녕 world" }] })).toBe(8);
  });

  it("saves, lists newest first, and reads a version back", async () => {
    const storage = createMemoryStorage({ pages: [pageWith(ID, "처음")] });
    const a = await storage.saveVersion(pageWith(ID, "처음"));
    const b = await storage.saveVersion(pageWith(ID, "두 번째 글"));
    const list = await storage.listVersions(ID);
    expect(list.map((v) => v.id)).toEqual([b.id, a.id]);
    expect(list[0]).toMatchObject({ chars: 6 });
    expect(list[0].size).toBeGreaterThan(0);
    const back = await storage.readVersion(ID, a.id);
    expect(back.content).toEqual(pageWith(ID, "처음").content);
  });

  it("keeps the newest 50 versions per page", async () => {
    const storage = createMemoryStorage();
    const ids: string[] = [];
    for (let i = 0; i < HISTORY_KEEP + 2; i++) {
      ids.push((await storage.saveVersion(pageWith(ID, `v${i}`))).id);
    }
    const list = await storage.listVersions(ID);
    expect(list).toHaveLength(HISTORY_KEEP);
    expect(list[0].id).toBe(ids[ids.length - 1]);
    await expect(storage.readVersion(ID, ids[0])).rejects.toMatchObject({ code: "not_found" });
  });

  it("validates ids and version names", async () => {
    const storage = createMemoryStorage();
    await expect(storage.listVersions("../x")).rejects.toMatchObject({ code: "invalid_id" });
    await expect(storage.readVersion(ID, "../../etc")).rejects.toMatchObject({
      code: "invalid_version",
    });
    await expect(storage.saveVersion(pageWith("x", "y"))).rejects.toBeInstanceOf(StorageError);
  });

  it("deletes one page's history on request and with its permanent delete", async () => {
    const storage = createMemoryStorage({
      pages: [pageWith(ID, "지울 글", "2026-11-21T01:00:00Z")],
    });
    await storage.saveVersion(pageWith(ID, "지울 글"));
    await storage.saveVersion(pageWith(ID2, "남길 글"));
    await storage.purgePage(ID);
    expect(await storage.listVersions(ID)).toEqual([]);

    await storage.deleteVersions(ID2);
    expect(await storage.listVersions(ID2)).toEqual([]);
    await storage.deleteVersions(ID2); // 없어도 오류가 아니다
  });
});
