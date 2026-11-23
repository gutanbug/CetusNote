import { createMemoryStorage } from "@/lib/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionStore } from "./store";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createSessionStore (SHELL-01, SHELL-05)", () => {
  it("열린 페이지·펼친 트리는 워크스페이스마다, 사이드바는 전체에 기억한다. 다른 설정 키는 지우지 않는다", async () => {
    const storage = createMemoryStorage();
    await storage.writeSettings({ theme: "dark" });
    const a = createSessionStore(storage, { delay: 10 });
    await a.getState().load("/notes/A");
    a.getState().open("01JD0000000000000000000000");
    a.getState().expand("f1", "f2");
    a.getState().expand("f1");
    a.getState().setSidebarWidth(300);
    a.getState().toggleSidebar();
    await vi.advanceTimersByTimeAsync(10);

    const b = createSessionStore(storage, { delay: 10 });
    await b.getState().load("/notes/A");
    expect(b.getState()).toMatchObject({
      activeId: "01JD0000000000000000000000",
      expanded: ["f1", "f2"],
      sidebarWidth: 300,
      sidebarCollapsed: true,
    });
    const other = createSessionStore(storage, { delay: 10 });
    await other.getState().load("/notes/B");
    expect(other.getState()).toMatchObject({ activeId: null, expanded: [], sidebarWidth: 300 });
    expect(await storage.readSettings()).toMatchObject({ theme: "dark" });
  });

  it("설정 파일이 깨져 있어도 기본값으로 연다", async () => {
    const storage = createMemoryStorage();
    await storage.writeSettings({
      sidebarWidth: "넓게",
      workspaces: { "/n": { expanded: [1, "x"] } },
    });
    const s = createSessionStore(storage);
    await s.getState().load("/n");
    expect(s.getState()).toMatchObject({ sidebarWidth: null, expanded: ["x"], activeId: null });
  });

  it("외관은 전체에, 최근 문서는 워크스페이스마다 (새 것이 앞, 중복 없음)", async () => {
    const storage = createMemoryStorage();
    const a = createSessionStore(storage, { delay: 10 });
    await a.getState().load("/n");
    a.getState().open("p1");
    a.getState().open("p2");
    a.getState().open("p1");
    a.getState().setAppearance({ theme: "dark", accent: "teal" });
    a.getState().setEditor({ newPageFont: "serif", spellcheck: false });
    await vi.advanceTimersByTimeAsync(10);
    const b = createSessionStore(storage, { delay: 10 });
    await b.getState().load("/n");
    expect(b.getState().recent).toEqual(["p1", "p2"]);
    expect(b.getState().appearance).toEqual({
      theme: "dark",
      accent: "teal",
      fontScale: 1,
      zoom: 1,
      constellation: true,
      newPageWide: false,
    });
    expect(b.getState().editor).toEqual({
      newPageFont: "serif",
      spellcheck: false,
      dimChecked: true,
    });
    const c = createSessionStore(storage, { delay: 10 });
    await c.getState().load("/other");
    expect(c.getState().recent).toEqual([]);
    expect(c.getState().appearance.theme).toBe("dark");
  });

  it("touch는 지금 문서를 두고 최근 목록 맨 앞에만 올린다 (보드 카드 상세)", async () => {
    const s = createSessionStore(createMemoryStorage());
    await s.getState().load("/n");
    s.getState().open("board");
    s.getState().touch("card");
    s.getState().touch("card");
    expect(s.getState().activeId).toBe("board");
    expect(s.getState().recent).toEqual(["card", "board"]);
  });

  it("레코드 여는 방식·패널 폭을 앱 전체에 기억한다 (COLL-07)", async () => {
    const storage = createMemoryStorage();
    const a = createSessionStore(storage, { delay: 10 });
    await a.getState().load("/n");
    expect(a.getState()).toMatchObject({ recordOpen: "modal", recordPanelWidth: null });
    a.getState().setRecordOpen("side");
    a.getState().setRecordPanelWidth(520);
    await vi.advanceTimersByTimeAsync(10);
    const b = createSessionStore(storage);
    await b.getState().load("/other");
    expect(b.getState()).toMatchObject({ recordOpen: "side", recordPanelWidth: 520 });
    await storage.writeSettings({ recordOpen: "popup", recordPanelWidth: "넓게" });
    const c = createSessionStore(storage);
    await c.getState().load("/n");
    expect(c.getState()).toMatchObject({ recordOpen: "modal", recordPanelWidth: null });
  });
});

describe("읽던 위치 저장 (PAGE-15)", () => {
  it("위치는 워크스페이스마다 따로 저장하고 다시 열면 읽는다. 지운 페이지는 빠진다", async () => {
    const storage = createMemoryStorage();
    const a = createSessionStore(storage, { delay: 10 });
    await a.getState().load("/notes/A");
    a.getState().remember("p1", { block: 4, ratio: 0.5, anchor: 9, head: 9 });
    a.getState().remember("p2", { block: 0, ratio: 0, anchor: 3, head: 5 });
    a.getState().remember("p1", { block: 8, ratio: 0.1, anchor: 12, head: 12 });
    a.getState().forgetPositions(["p2"]);
    await vi.advanceTimersByTimeAsync(10);

    const b = createSessionStore(storage, { delay: 10 });
    await b.getState().load("/notes/A");
    expect(b.getState().positionOf("p1")).toEqual({ block: 8, ratio: 0.1, anchor: 12, head: 12 });
    expect(b.getState().positionOf("p2")).toBeUndefined();

    const other = createSessionStore(storage, { delay: 10 });
    await other.getState().load("/notes/B");
    expect(other.getState().positionOf("p1")).toBeUndefined();
  });

  it("분할 화면(SHELL-19): 패널 페이지와 폭은 워크스페이스마다 다시 열 때 이어지고, 잘못된 값은 버린다", async () => {
    const storage = createMemoryStorage();
    const a = createSessionStore(storage, { delay: 10 });
    await a.getState().load("/notes/A");
    a.getState().setSplit({ pageId: "01JD0000000000000000000001", width: 412 });
    await vi.advanceTimersByTimeAsync(10);

    const b = createSessionStore(storage, { delay: 10 });
    await b.getState().load("/notes/A");
    expect(b.getState()).toMatchObject({ splitId: "01JD0000000000000000000001", splitWidth: 412 });

    const other = createSessionStore(storage, { delay: 10 });
    await other.getState().load("/notes/B");
    expect(other.getState()).toMatchObject({ splitId: null, splitWidth: null });

    await storage.writeSettings({
      workspaces: { "/notes/A": { split: { pageId: 7, width: "x" } } },
    });
    const c = createSessionStore(storage, { delay: 10 });
    await c.getState().load("/notes/A");
    expect(c.getState()).toMatchObject({ splitId: null, splitWidth: null });
  });
});
