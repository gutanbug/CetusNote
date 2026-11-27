import "@/styles/globals.css";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import { Profiler, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Editor } from "@tiptap/core";
import App from "@/App";
import { PlatformContext } from "@/components/ui/platform-context";
import { PageIconProvider } from "@/components/ui/page-icon";
import { sampleResolveImage } from "@/components/ui/page-icon-sample";
import { TooltipProvider } from "@/components/ui/tooltip";
import { pagesStore } from "@/features/pages";
import { currentPlatform } from "@/lib/platform-labels";
import { openPageFrom } from "./tabs";

/*
 * 입력 지연 측정 (SYS-11). 평소 검사에서는 건너뛴다 — 켜기: `VITE_PERF=1 pnpm vitest run --project shell typing-perf`, 결과는 `.vitest/typing-perf.log`.
 * 실제 App(메모리 저장소)에 페이지 PAGES개와 BLOCKS블록 문서를 만들고, 에디터에 한 글자씩 넣으며
 * 「글자 넣기 → React 커밋까지」 시간과 React가 그린 시간(Profiler actualDuration)을 잰다.
 * 개발 모드 React라 절대값은 릴리스보다 크다. 고치기 전후 비교용이다.
 */

const PAGES = 2000;
const BLOCKS = 2000;
const KEYS = 40;
const MIXED = 5000;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let reactMs = 0;
let commits = 0;
const lines: string[] = [];

const frames = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
/** 마이크로태스크·React 동기 레인까지 비운다 */
const settle = () => new Promise<void>((r) => setTimeout(r, 0));

const para = (t: string) => ({ type: "paragraph", content: [{ type: "text", text: t }] });

function mixedBlock(b: number) {
  const text = (t: string) => [{ type: "text", text: t }];
  switch (b % 6) {
    case 0:
      return { type: "heading", attrs: { level: 2 }, content: text(`섹션 ${b}`) };
    case 1:
      return {
        type: "bulletList",
        content: [{ type: "listItem", content: [para(`항목 ${b}`)] }],
      };
    case 2:
      return {
        type: "taskList",
        content: [
          { type: "taskItem", attrs: { checked: b % 4 === 0 }, content: [para(`할 일 ${b}`)] },
        ],
      };
    case 3:
      return { type: "codeBlock", attrs: { language: "ts" }, content: text(`const v${b} = ${b};`) };
    case 4:
      return { type: "blockquote", content: [para(`인용 ${b}`)] };
    default:
      return para(`블록 ${b} 본문 텍스트 입니다`);
  }
}

/** 페이지를 열고 에디터가 모든 블록을 그린 뒤 두 프레임까지 걸린 시간 */
const phases: string[] = [];
async function openTime(id: string, blocks: number): Promise<number> {
  const t0 = performance.now();
  openPageFrom(id, null);
  await vi.waitFor(() => editorOf(), { timeout: 120000, interval: 5 });
  const tEditor = performance.now() - t0;
  const longs: number[] = [];
  const obs = new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => longs.push(Math.round(e.duration))),
  );
  obs.observe({ type: "longtask" });
  await vi.waitFor(
    () => {
      const e = editorOf();
      if (e.state.doc.childCount < blocks) throw new Error("블록 대기");
    },
    { timeout: 120000, interval: 5 },
  );
  await frames();
  const total = performance.now() - t0;
  await new Promise((r) => setTimeout(r, 1500));
  obs.disconnect();
  phases.push(
    `${blocks}: editor ${tEditor.toFixed(0)} total ${total.toFixed(0)} longtasks ${JSON.stringify(longs.slice(0, 12))}`,
  );
  return total;
}

function editorOf(): Editor {
  const dom = document.querySelector<HTMLElement & { editor?: Editor }>(
    '[data-slot="page-scroller"] .ProseMirror',
  );
  if (!dom?.editor) throw new Error("에디터 대기 중");
  return dom.editor;
}

function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  return {
    median: +q(0.5).toFixed(2),
    p95: +q(0.95).toFixed(2),
    max: +s[s.length - 1]!.toFixed(2),
  };
}

describe.skipIf(!import.meta.env.VITE_PERF)("입력 지연 (SYS-11)", () => {
  beforeAll(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(
      <StrictMode>
        <Profiler
          id="app"
          onRender={(_id, _phase, actual) => {
            reactMs += actual;
            commits += 1;
          }}
        >
          <PlatformContext.Provider value={currentPlatform()}>
            <TooltipProvider>
              <PageIconProvider resolveImage={sampleResolveImage}>
                <App />
              </PageIconProvider>
            </TooltipProvider>
          </PlatformContext.Provider>
        </Profiler>
      </StrictMode>,
    );
    await vi.waitFor(
      () => {
        const btn = [...document.querySelectorAll("button")].find((b) =>
          b.textContent?.includes("기본 위치에 만들기"),
        );
        if (!btn) throw new Error("첫 실행 버튼 대기 중");
        btn.click();
      },
      { timeout: 15000 },
    );
    await vi.waitFor(
      () => {
        if (!document.querySelector('[data-slot="main-screen"]')) throw new Error("메인 화면");
      },
      { timeout: 15000 },
    );
    const { create } = pagesStore.getState();
    for (let i = 0; i < PAGES; i++) {
      create({
        title: `페이지 ${i}`,
        content: { type: "doc", content: [para(`본문 ${i}`)] } as never,
      });
    }
    const small = create({
      title: "짧은 페이지",
      content: { type: "doc", content: [para("시작")] } as never,
    });
    const long = create({
      title: "긴 페이지",
      content: {
        type: "doc",
        content: Array.from({ length: BLOCKS }, (_, b) => para(`블록 ${b} 본문 텍스트 입니다`)),
      } as never,
    });
    // 여러 종류가 섞인 긴 문서 — 제목·목록·할 일·코드·인용 (열기 측정용)
    const mixedBlocks = Array.from({ length: MIXED }, (_, b) => mixedBlock(b));
    const mixed = create({
      title: "섞인 긴 페이지",
      content: { type: "doc", content: mixedBlocks } as never,
    });
    (globalThis as Record<string, unknown>).__perfIds = {
      small: small.id,
      long: long.id,
      mixed: mixed.id,
    };
  }, 120_000);

  afterAll(() => {
    root?.unmount();
    container?.remove();
  });

  async function typeOn(id: string, label: string) {
    openPageFrom(id, null);
    await vi.waitFor(() => editorOf(), { timeout: 30000 });
    await frames();
    const editor = editorOf();
    editor.commands.focus("end");
    await frames();
    const total: number[] = [];
    const react: number[] = [];
    let renders = 0;
    for (let k = 0; k < KEYS; k++) {
      reactMs = 0;
      commits = 0;
      const t0 = performance.now();
      editor.commands.insertContent("가");
      await settle();
      total.push(performance.now() - t0);
      react.push(reactMs);
      renders += commits;
      await frames();
    }
    const result = {
      label,
      total: stats(total),
      react: stats(react),
      commitsPerKey: renders / KEYS,
    };
    lines.push(`[SYS-11] ${JSON.stringify(result)}`);
    return result;
  }

  it("짧은 페이지와 긴 페이지에서 한 글자 시간을 잰다", async () => {
    const ids = (globalThis as Record<string, unknown>).__perfIds as {
      small: string;
      long: string;
    };
    const ids2 = ids as typeof ids & { mixed: string };
    // 열기: 짧은 페이지를 거쳐 매번 새로 연다
    const opens: Record<string, number[]> = { long: [], mixed: [] };
    for (let r = 0; r < 3; r++) {
      await openTime(ids.small, 1);
      opens.long!.push(await openTime(ids.long, BLOCKS));
      await openTime(ids.small, 1);
      // n번째 열기의 CPU 프로파일을 남긴다 (VITE_PERF_PROFILE=n)
      const profile = import.meta.env.VITE_PERF_PROFILE === String(r + 1);
      if (profile)
        await (commands as unknown as Record<string, () => Promise<void>>).cpuProfileStart!();
      opens.mixed!.push(await openTime(ids2.mixed, MIXED));
      if (profile)
        await (commands as unknown as Record<string, (p: string) => Promise<void>>).cpuProfileStop!(
          ".vitest/open.cpuprofile",
        );
    }
    lines.push(
      `[SYS-11 open] ${JSON.stringify({ [`${BLOCKS}문단`]: stats(opens.long!), [`${MIXED}섞인블록`]: stats(opens.mixed!) })}`,
    );
    lines.push(...phases);
    const small = await typeOn(ids.small, `짧은 페이지 · 페이지 ${PAGES}개`);
    const long = await typeOn(ids.long, `${BLOCKS}블록 페이지 · 페이지 ${PAGES}개`);
    // 결과는 파일로 남긴다(브라우저 콘솔은 러너가 보여 주지 않는다)
    await commands.writeFile(".vitest/typing-perf.log", lines.join("\n"));
    expect(small.total.median).toBeGreaterThan(0);
    expect(long.total.median).toBeGreaterThan(0);
  }, 300_000);
});
