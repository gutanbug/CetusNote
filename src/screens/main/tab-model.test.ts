import type { Tab } from "@/features/session";
import { describe, expect, it } from "vitest";
import {
  addBackgroundTab,
  addTab,
  closeTab,
  cycleTab,
  navigateTo,
  openNewTab,
  pruneTabs,
  replaceActive,
  startTabs,
  tabOfView,
} from "./tab-model";

const p = (id: string): Tab => ({ kind: "page", id });
const home: Tab = { kind: "home" };
const ids = (tabs: Tab[]) => tabs.map((t) => (t.kind === "page" ? t.id : t.kind));

describe("페이지 탭 (SHELL-11)", () => {
  it("지금 탭 안에서 이동하면 그 탭이 바뀐다", () => {
    const s = replaceActive({ tabs: [p("a"), p("b")], active: 1 }, p("c"));
    expect(ids(s.tabs)).toEqual(["a", "c"]);
    expect(replaceActive({ tabs: [], active: 0 }, home)).toEqual({ tabs: [home], active: 0 });
    expect(tabOfView({ kind: "page" }, null)).toBeNull();
    expect(tabOfView({ kind: "tag", tag: "회의" }, "a")).toEqual({ kind: "tag", tag: "회의" });
  });

  it("새 탭은 지금 탭 바로 오른쪽", () => {
    const s = addTab({ tabs: [p("a"), p("b"), p("c")], active: 0 }, p("x"));
    expect(ids(s.tabs)).toEqual(["a", "x", "b", "c"]);
    expect(s.active).toBe(1);
  });

  it("닫기: 지금 탭이면 오른쪽(끝이면 왼쪽)으로, 왼쪽 탭을 닫으면 번호가 당겨진다, 마지막이면 홈", () => {
    const tabs = [p("a"), p("b"), p("c")];
    expect(closeTab({ tabs, active: 1 }, 1)).toEqual({ tabs: [p("a"), p("c")], active: 1 });
    expect(closeTab({ tabs, active: 2 }, 2).active).toBe(1);
    expect(closeTab({ tabs, active: 2 }, 0)).toEqual({ tabs: [p("b"), p("c")], active: 1 });
    expect(closeTab({ tabs: [p("a")], active: 0 }, 0)).toEqual({ tabs: [home], active: 0 });
  });

  it("열 수 없는 탭을 빼되 지금 탭은 남긴다", () => {
    const s = pruneTabs(
      { tabs: [p("x"), p("a"), p("y"), p("b")], active: 2 },
      (id) => id !== "x" && id !== "y",
    );
    expect(ids(s.tabs)).toEqual(["a", "y", "b"]);
    expect(s.active).toBe(1);
  });

  it("시작: 저장된 탭이 없으면 마지막 페이지. 홈이면 탭 하나는 홈으로 바꾸고, 여럿이면 홈 탭으로", () => {
    expect(startTabs({ tabs: [p("a")], active: 0 }, "home", "a")).toEqual({
      tabs: [home],
      active: 0,
    });
    expect(startTabs({ tabs: [], active: 0 }, "home", "a")).toEqual({ tabs: [home], active: 0 });
    expect(startTabs({ tabs: [], active: 0 }, "last", "a")).toEqual({ tabs: [p("a")], active: 0 });
    expect(startTabs({ tabs: [], active: 0 }, "last", null)).toEqual({ tabs: [home], active: 0 });
    const saved = { tabs: [p("a"), p("b")], active: 0 };
    expect(startTabs(saved, "last", "a")).toBe(saved);
    expect(startTabs(saved, "home", "a")).toEqual({ tabs: [p("a"), p("b"), home], active: 2 });
    expect(startTabs({ tabs: [home, p("b")], active: 1 }, "home", null).active).toBe(0);
  });

  it("⌃Tab은 돈다", () => {
    expect(cycleTab({ tabs: [p("a"), p("b")], active: 1 }, 1)).toBe(0);
    expect(cycleTab({ tabs: [p("a"), p("b")], active: 0 }, -1)).toBe(1);
  });
});

describe("이미 열린 페이지는 그 탭으로 간다 (SHELL-11)", () => {
  it("이동: 다른 탭에 열린 페이지면 지금 탭을 바꾸지 않고 그 탭을 활성화한다", () => {
    const s = navigateTo({ tabs: [p("a"), p("b"), p("c")], active: 0 }, p("c"));
    expect(ids(s.tabs)).toEqual(["a", "b", "c"]);
    expect(s.active).toBe(2);
  });

  it("이동: 열리지 않은 페이지면 지금 탭의 내용을 바꾼다 (중복 탭 없음)", () => {
    const s = navigateTo({ tabs: [p("a"), p("b")], active: 0 }, p("x"));
    expect(ids(s.tabs)).toEqual(["x", "b"]);
    expect(s.active).toBe(0);
  });

  it("이동: 지금 탭이 이미 그 페이지면 그대로", () => {
    const tabs = [p("a"), p("b")];
    expect(navigateTo({ tabs, active: 1 }, p("b"))).toEqual({ tabs, active: 1 });
  });

  it("새 탭: 이미 열린 페이지는 새로 만들지 않고 그 탭을 활성화한다", () => {
    const s = openNewTab({ tabs: [p("a"), p("b"), p("c")], active: 0 }, p("b"));
    expect(ids(s.tabs)).toEqual(["a", "b", "c"]);
    expect(s.active).toBe(1);
  });

  it("새 탭: 열리지 않은 페이지와 새 홈은 지금 탭 오른쪽에 연다", () => {
    expect(ids(openNewTab({ tabs: [p("a"), p("b")], active: 0 }, p("x")).tabs)).toEqual([
      "a",
      "x",
      "b",
    ]);
    expect(ids(openNewTab({ tabs: [p("a")], active: 0 }, home).tabs)).toEqual(["a", "home"]);
  });

  it("백그라운드 탭: 이미 열린 페이지면 아무것도 하지 않는다", () => {
    const state = { tabs: [p("a"), p("b")], active: 0 };
    expect(addBackgroundTab(state, p("b"))).toBe(state);
    expect(ids(addBackgroundTab(state, p("c")).tabs)).toEqual(["a", "c", "b"]);
  });

  it("마지막 페이지 탭을 닫으면 홈 탭 하나만 남는다 (탭 바는 숨는다)", () => {
    const s = closeTab({ tabs: [p("a")], active: 0 }, 0);
    expect(s).toEqual({ tabs: [home], active: 0 });
    expect(s.tabs.length).toBe(1);
  });
});
