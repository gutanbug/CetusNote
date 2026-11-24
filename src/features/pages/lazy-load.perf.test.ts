/**
 * 측정 (SYS-10, ADR-022): 합성 워크스페이스를 디스크에서 읽어 불러오기·본문 열기·검색 준비 시간과 메모리를 잰다.
 * 실행: `CETUS_PERF_WS=<워크스페이스 폴더> pnpm vitest run --project unit lazy-load.perf`
 * 폴더는 `pages/<id>.json`을 가진 워크스페이스여야 한다. 환경 변수가 없으면 건너뛴다.
 * Rust가 돌려주는 JSON 문자열을 흉내 내 JSON.parse와 normalizePage를 그대로 거친다(tauri.ts의 normalizeLoaded와 같은 일).
 */
import { createMemoryStorage, type LoadResult } from "@/lib/storage";
import { normalizePage } from "@/lib/storage/schema";
import { connectSearchIndex } from "@/features/search/connect";
import { createSearchIndex } from "@/features/search/search-index";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import v8 from "node:v8";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { createPagesStore } from "./store";

const DIR = process.env.CETUS_PERF_WS;
/** 검색 준비 확인에 쓰는 낱말 (생성기가 50쪽마다 넣는다) */
const PROBE = "needle";

v8.setFlagsFromString("--expose-gc");
const gc = vm.runInNewContext("gc") as () => void;
const heapMB = () => {
  gc();
  return process.memoryUsage().heapUsed / 1048576;
};
const now = () => performance.now();

describe.skipIf(!DIR)("본문 지연 로딩 측정 (SYS-10)", () => {
  it("구조 불러오기 · 첫 화면 준비 · 본문 열기 · 검색 준비", async () => {
    const dir = join(DIR!, "pages");
    const names = readdirSync(dir)
      .filter((n) => n.endsWith(".json"))
      .sort();
    const files = names.map((n) => readFileSync(join(dir, n), "utf8"));
    const byId = new Map(names.map((n) => [n.slice(0, -5), join(dir, n)]));
    // Rust가 돌려주는 모양의 JSON 문자열 두 가지 (전체 / 구조만)
    const fullJson = `{"pages":[${files.join(",")}],"errors":[]}`;
    const metaJson = `{"pages":[${files
      .map((f) => {
        const p = JSON.parse(f) as Record<string, unknown>;
        delete p.content;
        return JSON.stringify(p);
      })
      .join(",")}],"errors":[]}`;
    const parse = (s: string) => {
      const t = now();
      JSON.parse(s);
      return now() - t;
    };
    const ipcParseFullMs = parse(fullJson);
    const ipcParseMetaMs = parse(metaJson);

    const normalizeLoaded = (raw: { pages: unknown[] }): LoadResult => ({
      pages: raw.pages.map((p) => normalizePage(p)),
      errors: [],
    });
    const storage = {
      ...createMemoryStorage(),
      loadPages: async () => normalizeLoaded(JSON.parse(fullJson)),
      loadPageMeta: async () => normalizeLoaded(JSON.parse(metaJson)),
      readPages: async (ids: string[]) => ({
        pages: ids.flatMap((id) => {
          const f = byId.get(id);
          return f ? [normalizePage(JSON.parse(readFileSync(f, "utf8")))] : [];
        }),
        errors: [],
      }),
    };

    const store = createPagesStore(storage);
    const lazy = typeof store.getState().ensureBody === "function";
    const index = createSearchIndex();
    // 요약(백링크·할 일·그림)도 같은 읽기로 채운다. 이전 커밋에는 모듈이 없으니 그때는 건너뛴다
    const summaries = await import("@/features/pages/summary")
      .then((m) => m.createSummaryIndex())
      .catch(() => undefined);
    const heapBase = heapMB();
    const stop = connectSearchIndex(store, index, { summaries });

    const t0 = now();
    await store.getState().load();
    const loadMs = now() - t0;
    const heapLoadMB = heapMB() - heapBase;

    const want = files.filter((f) => f.includes(PROBE)).length;
    for (;;) {
      if (index.search(PROBE, { limit: 1_000_000 }).length >= want) break;
      if (now() - t0 > 240_000) throw new Error("검색 준비가 끝나지 않았다");
      await new Promise((r) => setTimeout(r, 5));
    }
    const searchReadyMs = now() - t0;
    const heapSearchMB = heapMB() - heapBase;

    const firstId = Object.keys(store.getState().pages)[0]!;
    let openColdMs = 0;
    let openWarmMs = 0;
    if (lazy) {
      const a = now();
      expect(await store.getState().ensureBody(firstId)).toBe(true);
      openColdMs = now() - a;
      const b = now();
      await store.getState().ensureBody(firstId);
      openWarmMs = now() - b;
    }
    stop();

    const out = {
      mode: lazy ? "lazy" : "eager",
      pages: names.length,
      ipcParseFullMs: +ipcParseFullMs.toFixed(1),
      ipcParseMetaMs: +ipcParseMetaMs.toFixed(1),
      loadMs: +loadMs.toFixed(1),
      heapLoadMB: +heapLoadMB.toFixed(1),
      searchReadyMs: +searchReadyMs.toFixed(1),
      heapSearchMB: +heapSearchMB.toFixed(1),
      openColdMs: +openColdMs.toFixed(2),
      openWarmMs: +openWarmMs.toFixed(3),
    };
    console.log(`PERF_JS ${JSON.stringify(out)}`);
    expect(store.getState().loaded).toBe(true);
  }, 300_000);
});
