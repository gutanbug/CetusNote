import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import storybook from "eslint-plugin-storybook";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist", "storybook-static", "src-tauri/target", "src-tauri/gen"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // 계층 규칙: components는 저장소·Tauri API를 직접 쓰지 않는다
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@tauri-apps/*"],
              message: "Tauri API는 lib/storage 등 래퍼를 거쳐서만 쓴다.",
            },
            {
              group: ["motion-plus", "motion-plus/*"],
              message: "motion-plus(유료)는 쓰지 않는다.",
            },
            { group: ["@tiptap-pro/*"], message: "Tiptap Pro(유료)는 쓰지 않는다." },
            { group: ["framer-motion"], message: "motion/react를 쓴다." },
          ],
        },
      ],
    },
  },
  {
    // 래퍼 계층에서만 Tauri API 허용 (업데이트는 lib/updater가 감싼다 — SYS-07)
    files: ["src/lib/storage/**", "src/lib/updater/**", "src/app/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // shadcn 생성물(variants)과 Tiptap 확장(노드 뷰 포함)은 컴포넌트가 아닌 값도 함께 export한다
    files: ["src/components/ui/**", "src/components/editor/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  storybook.configs["flat/recommended"],
  prettier,
]);
