/**
 * 측정 (SYS-10): 페이지 n개 트리(buildPageTree)를 다시 만드는 시간.
 * 실행: `CETUS_PERF=1 pnpm vitest run --project unit tree.perf` (n: `CETUS_PERF_N`, 기본 10000)
 * 환경 변수가 없으면 건너뛴다. 합성 데이터: 루트 폴더 100개, 나머지는 무작위 부모 아래(약 1/3은 루트).
 */
import { createPage, type Page } from "@/lib/storage";
import { describe, it } from "vitest";
import { buildPageTree } from "./tree";

const N = Number(process.env.CETUS_PERF_N ?? 10000);

function synthetic(n: number): Page[] {
  const pages: Page[] = [];
  let seed = 7;
  const rand = (k: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % k;
  };
  for (let i = 0; i < n; i++) {
    const folder = i < 100;
    const parent = i < 100 || rand(3) === 0 ? undefined : pages[rand(i)]!.id;
    const p = createPage({
      kind: folder ? "folder" : "page",
      title: `페이지 ${i}`,
      ...(parent ? { parentId: parent } : {}),
    });
    pages.push({ ...p, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString() });
  }
  return pages;
}

describe.runIf(process.env.CETUS_PERF === "1")("buildPageTree 성능 (SYS-10)", () => {
  it(`n=${N} 트리 다시 만들기 중앙값`, () => {
    const pages = synthetic(N);
    buildPageTree(pages); // 준비 한 번
    const times: number[] = [];
    for (let r = 0; r < 7; r++) {
      const s = performance.now();
      buildPageTree(pages);
      times.push(performance.now() - s);
    }
    times.sort((a, b) => a - b);
    process.stdout.write(`PERF tree n=${N} median=${times[3]!.toFixed(1)} ms\n`);
  });
});
