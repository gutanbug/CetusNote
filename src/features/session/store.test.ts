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
      defaultWide: false,
      appIcon: "auto",
      language: "system",
    });
    expect(b.getState().editor).toEqual({
      newPageFont: "serif",
      spellcheck: false,
      dimChecked: true,
      calc: true,
      calcRight: false,
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

  it("예전 분할 화면 값(split, 기능 제거됨)이 남아 있어도 무시하고 나머지 설정은 그대로 읽는다", async () => {
    const storage = createMemoryStorage();
    await storage.writeSettings({
      workspaces: { "/notes/A": { split: { pageId: "01JD0000000000000000000001", width: 412 } } },
    });
    const c = createSessionStore(storage, { delay: 10 });
    await c.getState().load("/notes/A");
    expect(c.getState()).not.toHaveProperty("splitId");
    expect(c.getState()).not.toHaveProperty("splitWidth");
    expect(c.getState().activeTab).toBe(0);
  });
});

describe("앱 설정: 메뉴 막대·로그인 시작·빠른 입력 단축키·두 번 누르기 (SYS-15, QN-03)", () => {
  it("저장된 값이 없으면 기본값: 메뉴 막대 켬, 로그인 시작 끔, ⌥⇧Space, 두 번 누르기 끔", async () => {
    const storage = createMemoryStorage();
    const s = createSessionStore(storage, { delay: 10 });
    await s.getState().load("/notes/A");
    expect(s.getState()).toMatchObject({
      menuBarResident: true,
      launchAtLogin: false,
      quickShortcut: "Alt+Shift+Space",
      doubleTap: "off",
    });
  });

  it("이상한 값은 기본값으로 바꾼다. 메뉴 막대는 false일 때만 끈다", async () => {
    const storage = createMemoryStorage();
    await storage.writeSettings({
      menuBarResident: "no",
      launchAtLogin: "true",
      quickShortcut: "   ",
      doubleTap: "option",
    });
    const s = createSessionStore(storage, { delay: 10 });
    await s.getState().load("/notes/A");
    expect(s.getState()).toMatchObject({
      menuBarResident: true,
      launchAtLogin: false,
      quickShortcut: "Alt+Shift+Space",
      doubleTap: "off",
    });
  });

  it("단축키 앞뒤 공백은 지우고, 두 번 누르기는 알려진 수식키만 읽는다", async () => {
    const storage = createMemoryStorage();
    await storage.writeSettings({ quickShortcut: "  Control+Shift+K  ", doubleTap: "shift" });
    const s = createSessionStore(storage, { delay: 10 });
    await s.getState().load("/notes/A");
    expect(s.getState().quickShortcut).toBe("Control+Shift+K");
    expect(s.getState().doubleTap).toBe("shift");
  });

  it("바꾼 값은 다른 설정 키를 지우지 않고 다시 열면 그대로 남는다", async () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();
    await storage.writeSettings({ theme: "dark" });
    const a = createSessionStore(storage, { delay: 10 });
    await a.getState().load("/notes/A");
    a.getState().setAppPrefs({
      menuBarResident: false,
      launchAtLogin: true,
      quickShortcut: "Control+Shift+K",
      doubleTap: "command",
    });
    await vi.advanceTimersByTimeAsync(10);

    const b = createSessionStore(storage, { delay: 10 });
    await b.getState().load("/notes/A");
    expect(b.getState()).toMatchObject({
      menuBarResident: false,
      launchAtLogin: true,
      quickShortcut: "Control+Shift+K",
      doubleTap: "command",
    });
    const saved = await storage.readSettings();
    expect(saved).toMatchObject({ theme: "dark", doubleTap: "command" });
  });
});
