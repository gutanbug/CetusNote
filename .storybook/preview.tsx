import type { Decorator, Preview } from "@storybook/react-vite";
import { StrictMode } from "react";
import { PageIconProvider } from "../src/components/ui/page-icon";
import { sampleResolveImage } from "../src/components/ui/page-icon-sample";
import { TooltipProvider } from "../src/components/ui/tooltip";
import "../src/styles/globals.css";

const ACCENTS = ["blue", "indigo", "violet", "teal", "green", "amber", "rose", "graphite"];

/** 견본 하나를 테마 열에 그린다. 상태 강제는 data-force로 (globals.css force-* variant). */
const withTheme: Decorator = (Story, ctx) => {
  const theme = (ctx.globals.theme ?? "light") as "light" | "dark" | "both";
  const accent = (ctx.globals.accent ?? "blue") as string;
  const force = ctx.globals.force && ctx.globals.force !== "none" ? ctx.globals.force : undefined;
  // 메뉴·팝오버·툴팁·대화상자는 body로 포털된다. 열(div)의 data-theme을 받지 못하므로
  // 문서 루트에도 건다(Debug 화면의 useRootAttributes와 같다). 나란히 보기에서는 라이트.
  const root = document.documentElement;
  root.dataset.theme = theme === "dark" ? "dark" : "light";
  root.dataset.accent = accent;
  if (force) root.dataset.force = force;
  else delete root.dataset.force;
  const column = (t: "light" | "dark") => (
    <div
      key={t}
      data-theme={t}
      data-accent={accent}
      data-force={force}
      className="min-h-full bg-app p-6 text-primary"
    >
      <Story />
    </div>
  );
  return (
    <TooltipProvider>
      {theme === "both" ? (
        <div className="grid grid-cols-2">{[column("light"), column("dark")]}</div>
      ) : (
        column(theme)
      )}
    </TooltipProvider>
  );
};

const preview: Preview = {
  // 앱(main.tsx)처럼 StrictMode로 그린다 — 이펙트를 두 번 도는 문제(예: 에디터 뷰가 붙기 전 접근)를 스토리에서도 잡는다
  decorators: [
    withTheme,
    // 올린 이미지 아이콘(PAGE-10)은 견본 이미지로 그린다
    (Story) => <PageIconProvider resolveImage={sampleResolveImage}>{Story()}</PageIconProvider>,
    (Story) => <StrictMode>{Story()}</StrictMode>,
  ],
  globalTypes: {
    theme: {
      description: "테마",
      toolbar: {
        title: "테마",
        icon: "mirror",
        items: [
          { value: "light", title: "라이트" },
          { value: "dark", title: "다크" },
          { value: "both", title: "나란히(L+D)" },
        ],
        dynamicTitle: true,
      },
    },
    accent: {
      description: "포인트 색",
      toolbar: { title: "포인트 색", icon: "paintbrush", items: ACCENTS, dynamicTitle: true },
    },
    force: {
      description: "상태 강제",
      toolbar: {
        title: "상태",
        icon: "pointer",
        items: [
          { value: "none", title: "강제 없음" },
          { value: "hover", title: "hover" },
          { value: "active", title: "active" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light", accent: "blue", force: "none" },
  parameters: {
    // 배경을 테마 열이 칠하도록 Storybook 여백은 끈다
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 위반 사항을 스토리 테스트에서 실패로 처리한다 (docs/dev/debug-screen.md §1 Ready 조건)
      test: "error",
    },
  },
};

export default preview;
