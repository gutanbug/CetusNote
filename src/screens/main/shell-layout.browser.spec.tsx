import "@/styles/globals.css";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { page as browserPage } from "vitest/browser";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "@/App";
import { PlatformContext } from "@/components/ui/platform-context";
import { PageIconProvider } from "@/components/ui/page-icon";
import { sampleResolveImage } from "@/components/ui/page-icon-sample";
import { TooltipProvider } from "@/components/ui/tooltip";
import { pagesStore } from "@/features/pages";
import { currentPlatform } from "@/lib/platform-labels";
import { openPageFrom } from "./tabs";

/*
 * 창 고정 레이아웃 회귀 테스트 (SYS-05, SHELL-17).
 * 긴 페이지(태그·표·긴 코드)를 연 메인 화면을 최소 창(1024×700)과 기본 창(1440×900)에서 그린 뒤,
 * 문서(html·body·#root)와 셸이 스크롤되지 않는지 본다. 스크롤은 안쪽 스크롤러가 맡는다.
 */

type Doc = { w: number; cw: number; h: number; ch: number; st: number; sl: number };

function docMetrics(): Doc {
  const d = document.scrollingElement as HTMLElement;
  return {
    w: d.scrollWidth,
    cw: d.clientWidth,
    h: d.scrollHeight,
    ch: d.clientHeight,
    st: d.scrollTop,
    sl: d.scrollLeft,
  };
}

function shellOf(): HTMLElement {
  const shell = document.querySelector<HTMLElement>('[data-slot="main-screen"]');
  if (!shell) throw new Error("main-screen이 없다");
  return shell;
}

function scrollerOf(): HTMLElement {
  const s = document.querySelector<HTMLElement>('[data-slot="page-scroller"]');
  if (!s) throw new Error("page-scroller가 없다");
  return s;
}

const WAIT = { timeout: 15000 };

const frames = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

const text = (t: string) => ({ type: "text", text: t });
const paragraph = (t: string) => ({ type: "paragraph", content: [text(t)] });
const heading = (level: number, t: string) => ({
  type: "heading",
  attrs: { level },
  content: [text(t)],
});
const cell = (type: "tableCell", t: string) => ({
  type,
  content: [paragraph(t)],
});

/** 긴 본문 + 넓은 표 + 긴 코드 줄 — 가로·세로 넘침을 잡으려고 일부러 크게 만든다 */
function longDoc() {
  const wideRow = (label: string) => ({
    type: "tableRow",
    content: Array.from({ length: 12 }, (_, i) =>
      cell("tableCell", `${label}-${i + 1} 긴 셀 내용`),
    ),
  });
  return {
    type: "doc",
    content: [
      heading(1, "긴 페이지 레이아웃 회귀"),
      ...Array.from({ length: 30 }, (_, i) =>
        paragraph(`문단 ${i + 1}. ${"길게 이어지는 본문 문장입니다. ".repeat(8)}`),
      ),
      heading(2, "넓은 표"),
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: Array.from({ length: 12 }, (_, i) => cell("tableCell", `열 ${i + 1}`)),
          },
          wideRow("가"),
          wideRow("나"),
          wideRow("다"),
        ],
      },
      heading(2, "긴 코드"),
      {
        type: "codeBlock",
        attrs: { language: "ts" },
        content: [text(`const value = "${"x".repeat(400)}";`)],
      },
      ...Array.from({ length: 10 }, (_, i) =>
        paragraph(`뒤쪽 문단 ${i + 1}. ${"끝 부분 본문. ".repeat(6)}`),
      ),
    ],
  };
}

const TAGS = [
  "일정",
  "회의록",
  "아주긴태그이름가나다라마바사아자차카타파하",
  "개인",
  "디자인",
  "리서치",
  "읽을거리",
];

const VIEWPORTS = [
  { name: "최소 창", w: 1024, h: 700 },
  { name: "기본 창", w: 1440, h: 900 },
] as const;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeAll(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  root.render(
    <StrictMode>
      <PlatformContext.Provider value={currentPlatform()}>
        <TooltipProvider>
          <PageIconProvider resolveImage={sampleResolveImage}>
            <App />
          </PageIconProvider>
        </TooltipProvider>
      </PlatformContext.Provider>
    </StrictMode>,
  );

  // 첫 실행 화면 → 기본 위치(메모리 저장소)로 워크스페이스를 만든다
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

  const created = pagesStore
    .getState()
    .create({ title: "긴 페이지 레이아웃 회귀", content: longDoc() as never });
  pagesStore.getState().update(created.id, { props: { ...created.props, tags: TAGS } });
  openPageFrom(created.id, null);
  await vi.waitFor(() => scrollerOf(), WAIT);
  await frames();
});

afterAll(() => {
  root?.unmount();
  container?.remove();
});

describe.each(VIEWPORTS)("창 고정 레이아웃 — $name $w×$h", ({ w, h }) => {
  it("문서와 셸은 창보다 크지 않다 (가로·세로 넘침 없음)", async () => {
    await browserPage.viewport(w, h);
    await frames();
    const m = docMetrics();
    expect(m.w).toBeLessThanOrEqual(m.cw);
    expect(m.h).toBeLessThanOrEqual(m.ch);
    const shell = shellOf();
    expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth);
    expect(shell.scrollHeight).toBeLessThanOrEqual(shell.clientHeight);
  });

  it("차례(제목) 이동은 문서·셸을 움직이지 않고 안쪽 스크롤러만 움직인다", async () => {
    await browserPage.viewport(w, h);
    await frames();
    const scroller = scrollerOf();
    scroller.scrollTop = 0;
    const target = scroller.querySelector("h2");
    if (!target) throw new Error("h2 제목이 없다");
    target.scrollIntoView({ block: "start" });
    await frames();
    const m = docMetrics();
    const shell = shellOf();
    expect(m.st).toBe(0);
    expect(m.sl).toBe(0);
    expect(shell.scrollTop).toBe(0);
    expect(shell.scrollLeft).toBe(0);
    expect(scroller.scrollTop).toBeGreaterThan(0);
  });

  it("사이드바 활성 항목 보이기는 문서·셸을 움직이지 않는다", async () => {
    await browserPage.viewport(w, h);
    await frames();
    const active = document.querySelector<HTMLElement>("[data-active]");
    expect(active).not.toBeNull();
    active?.scrollIntoView({ block: "nearest" });
    await frames();
    const m = docMetrics();
    expect(m.st).toBe(0);
    expect(m.sl).toBe(0);
    expect(shellOf().scrollTop).toBe(0);
    expect(shellOf().scrollLeft).toBe(0);
  });

  it("셸 안의 화면 밖 자식(절대 위치)에 포커스·스크롤해도 문서는 움직이지 않는다", async () => {
    await browserPage.viewport(w, h);
    await frames();
    const shell = shellOf();
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;left:1100px;top:2000px;width:60px;height:60px;";
    shell.appendChild(probe);
    probe.scrollIntoView({ block: "nearest", inline: "nearest" });
    await frames();
    const m = docMetrics();
    probe.remove();
    expect(m.st).toBe(0);
    expect(m.sl).toBe(0);
    expect(shell.scrollTop).toBe(0);
    expect(shell.scrollLeft).toBe(0);
  });
});

describe("사이드바 페이지 트리 스크롤 (SH-PageTree, SYS-10)", () => {
  const treeScroller = (): HTMLElement => {
    const tree = document.querySelector<HTMLElement>('[data-slot="page-tree"]');
    const viewport = tree?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) throw new Error("사이드바 트리 스크롤러가 없다");
    return viewport;
  };
  const treeRows = () => [
    ...document.querySelectorAll<HTMLElement>('[data-slot="page-tree"] [role="treeitem"]'),
  ];

  it("페이지가 300개면 사이드바 트리가 넘치고 스크롤되며, 보이는 행이 따라온다", async () => {
    await browserPage.viewport(1440, 900);
    for (let i = 0; i < 300; i++) {
      pagesStore.getState().create({ title: `사이드 메모 ${String(i).padStart(3, "0")}` });
    }
    await vi.waitFor(() => {
      if (!treeRows().some((r) => r.textContent?.includes("사이드 메모"))) {
        throw new Error("트리 행 대기 중");
      }
    }, WAIT);
    await frames();

    const s = treeScroller();
    expect(s.scrollHeight).toBeGreaterThan(s.clientHeight);
    expect(treeRows().length).toBeLessThan(100);
    expect(treeRows().some((r) => r.textContent?.includes("사이드 메모 000"))).toBe(true);

    // 휠은 가장 가까운 "실제로 스크롤되는" 상자로 간다. 트리 자신은 안 넘치므로 뷰포트까지 넘어가야 한다.
    // (synthetic WheelEvent는 스크롤을 일으키지 않으므로 여기서는 scrollTop 설정으로 움직인다)
    const tree = document.querySelector<HTMLElement>('[data-slot="page-tree"]');
    if (!tree) throw new Error("page-tree가 없다");
    for (let el: HTMLElement | null = tree; el && el !== s; el = el.parentElement) {
      expect(getComputedStyle(el).overscrollBehaviorY).not.toBe("contain");
    }
    s.scrollTop = 1200;
    await frames();
    await frames();
    expect(s.scrollTop).toBeGreaterThan(0);
    const rowH = treeRows()[0]?.getBoundingClientRect().height ?? 0;
    const firstShown = Math.floor(s.scrollTop / rowH);
    const shownNums = treeRows()
      .map((r) => /사이드 메모 (\d+)/.exec(r.textContent ?? "")?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number);
    expect(shownNums.length).toBeGreaterThan(0);
    expect(Math.min(...shownNums)).toBeLessThanOrEqual(firstShown);
    expect(Math.max(...shownNums)).toBeGreaterThanOrEqual(firstShown);
    expect(Math.min(...shownNums)).toBeGreaterThan(0);

    const m = docMetrics();
    expect(m.st).toBe(0);
    expect(m.sl).toBe(0);
    expect(shellOf().scrollTop).toBe(0);
  });
});
