import type { SoftColor } from "@/components/ui/tag-chip";

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
  return name || "알 수 없는 도구";
}

function mcpState(status: McpStatusValue | null): McpState {
  if (!status) return "loading";
  if (status.clients.length) return "connected";
  if (status.claudeCode || status.claudeDesktop) return "configured";
  return "none";
}

const LABEL: Record<McpState, string> = {
  loading: "확인 중",
  connected: "연결됨",
  configured: "설정됨",
  none: "연결 안 됨",
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
  if (!status || state === "loading") return "연결 상태를 확인하고 있어요.";
  if (state === "connected") {
    const names = [...new Set(status.clients.map(clientLabel))];
    return `${names.join(" · ")}에서 이 워크스페이스에 연결돼 있어요.`;
  }
  if (state === "configured") {
    const where = [status.claudeCode && "Claude Code", status.claudeDesktop && "Claude Desktop"]
      .filter(Boolean)
      .join(" · ");
    return `${where}에 등록돼 있어요. 그 도구에서 대화를 시작하면 연결돼요.`;
  }
  return "아래 명령이나 설정을 복사해 AI 도구에 등록해 주세요.";
}

export { clientLabel, COLOR, LABEL, mcpDetail, mcpState, type McpState, type McpStatusValue };
