/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

// OV-EmojiPicker(frimousse)는 이모지 데이터를 `${base}/ko/data.json`에서 받는다.
// 오프라인 앱이므로 CDN 대신 emojibase-data 패키지의 파일을 앱이 직접 제공한다:
// 개발 서버(앱·Storybook·테스트)는 미들웨어로, 빌드는 같은 경로의 에셋으로.
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
          include: ["src/**/*.test.{ts,tsx}"],
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
    ],
  },
}));
