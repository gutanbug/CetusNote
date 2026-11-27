/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

// OV-EmojiPicker(frimousse)는 이모지 데이터를 `${base}/ko/data.json`에서 받는다.
// 오프라인 앱이므로 CDN 대신 emojibase-data 패키지의 파일을 앱이 직접 제공한다:
// 개발 서버(앱·Storybook·테스트)는 미들웨어로, 빌드는 같은 경로의 에셋으로.
/** CDP CPU 프로파일 (SYS-11 측정용). 결과는 .cpuprofile(JSON)로 저장한다 */
type CdpSession = { send(method: string, params?: object): Promise<{ profile?: unknown }> };
let cdp: CdpSession | null = null;
const cpuProfileStart = async (ctx: unknown) => {
  const page = (ctx as { page: { context(): { newCDPSession(p: unknown): Promise<CdpSession> } } })
    .page;
  cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
};
const cpuProfileStop = async (_ctx: unknown, out: string) => {
  if (!cdp) return;
  const { profile } = await cdp.send("Profiler.stop");
  writeFileSync(out, JSON.stringify(profile));
  cdp = null;
};

const EMOJIBASE_FILES = ["ko/data.json", "ko/messages.json"];
function emojibaseLocal(): Plugin {
  const require = createRequire(import.meta.url);
  const read = (file: string) => readFileSync(require.resolve(`emojibase-data/${file}`));
  return {
    name: "cetusnote:emojibase-local",
    configureServer(server) {
      server.middlewares.use("/emojibase-data", (req, res, next) => {
        const file = req.url?.split("?")[0].replace(/^\//, "") ?? "";
        if (!EMOJIBASE_FILES.includes(file)) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(read(file));
      });
    },
    generateBundle() {
      for (const file of EMOJIBASE_FILES) {
        this.emitFile({ type: "asset", fileName: `emojibase-data/${file}`, source: read(file) });
      }
    },
  };
}

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), emojibaseLocal()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  test: {
    projects: [
      {
        // 로직·유틸 단위 테스트 (pnpm test)
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
          environment: "node",
        },
      },
      {
        // 모든 스토리를 브라우저에서 렌더링 + a11y 검사 (pnpm test:stories)
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(import.meta.dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
        },
      },
      {
        // 창 고정 레이아웃 회귀 (SYS-05) — 실제 App을 메모리 저장소로 띄워 문서·셸 스크롤을 잰다 (pnpm test:stories)
        extends: true,
        test: {
          name: "shell",
          include: ["src/**/*.browser.spec.tsx"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            // 성능 측정(SYS-11, typing-perf.browser.spec.tsx)용 CPU 프로파일 — 테스트가 부를 때만 켠다
            commands: { cpuProfileStart, cpuProfileStop },
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
        },
      },
    ],
  },
}));
