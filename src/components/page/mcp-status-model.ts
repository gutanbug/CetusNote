import type { SoftColor } from "@/components/ui/tag-chip";
import { msg } from "@/lib/i18n";

/** MCP 연결 상태 (DATA-12) — 화면이 저장소에서 읽어 넘긴다 */
type McpStatusValue = {
  /** 지금 이 워크스페이스에 붙은 MCP 서버의 클라이언트 이름들 (예: "claude-code") */
  clients: string[];
  /** Claude Code · Claude Desktop 설정에 이 앱 항목이 있는가 */
  claudeCode: boolean;
  claudeDesktop: boolean;
};

type McpState = "loading" | "connected" | "configured" | "none";

/** 클라이언트가 알린 이름 → 보여 줄 이름 */
function clientLabel(name: string): string {
  const n = name.toLowerCase();
  if (n === "claude-code" || n === "claude code") return "Claude Code";
  if (n === "claude-ai" || n.includes("desktop")) return "Claude Desktop";
  return name || msg().page.mcp.unknownClient;
}

function mcpState(status: McpStatusValue | null): McpState {
  if (!status) return "loading";
  if (status.clients.length) return "connected";
  if (status.claudeCode || status.claudeDesktop) return "configured";
  return "none";
}

const LABEL: Record<McpState, string> = {
  get loading() {
    return msg().page.mcp.state.loading;
  },
  get connected() {
    return msg().page.mcp.state.connected;
  },
  get configured() {
    return msg().page.mcp.state.configured;
  },
  get none() {
    return msg().page.mcp.state.none;
  },
};

const COLOR: Record<McpState, SoftColor> = {
  loading: "gray",
  connected: "green",
  configured: "blue",
  none: "gray",
};

/** 뱃지 옆에 붙이는 한 줄 설명 */
function mcpDetail(status: McpStatusValue | null): string {
  const state = mcpState(status);
  if (!status || state === "loading") return msg().page.mcp.checking;
  if (state === "connected") {
    const names = [...new Set(status.clients.map(clientLabel))];
    return msg().page.mcp.connectedFrom(names.join(" · "));
  }
  if (state === "configured") {
    const where = [status.claudeCode && "Claude Code", status.claudeDesktop && "Claude Desktop"]
      .filter(Boolean)
      .join(" · ");
    return msg().page.mcp.configuredIn(where);
  }
  return msg().page.mcp.setupHint;
}

export { clientLabel, COLOR, LABEL, mcpDetail, mcpState, type McpState, type McpStatusValue };
