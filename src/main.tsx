import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QuickScreen } from "./screens/quick/quick-screen";
import { PageIconProvider } from "./components/ui/page-icon";
import { TooltipProvider } from "./components/ui/tooltip";
import { assetUrl } from "./features/assets";
import { applyCachedAppearance } from "./lib/appearance";
import { currentPlatform } from "./lib/platform-labels";
import { PlatformContext } from "./components/ui/platform-context";
import "./styles/globals.css";

// 설정 파일을 읽기 전, 지난번 테마로 먼저 칠한다(첫 화면 번쩍임 방지)
applyCachedAppearance();

// 빠른 입력 창(#/quick)은 앱 본체(저장·워크스페이스 훅) 없이 따로 그린다 (QN-03)
const isQuickWindow = window.location.hash.startsWith("#/quick");
// 투명한 패널 창: 둥근 카드 바깥은 비워 둔다
if (isQuickWindow) document.documentElement.dataset.window = "quick";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PlatformContext.Provider value={currentPlatform()}>
      <TooltipProvider>
        {/* 올린 이미지 아이콘(PAGE-10)은 워크스페이스 assets에서 읽는다 */}
        <PageIconProvider resolveImage={(path) => assetUrl(path)}>
          {isQuickWindow ? <QuickScreen /> : <App />}
        </PageIconProvider>
      </TooltipProvider>
    </PlatformContext.Provider>
  </React.StrictMode>,
);
