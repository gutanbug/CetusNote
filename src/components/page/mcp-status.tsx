import { StatusChip } from "@/components/ui/status-chip";
import { COLOR, LABEL, mcpState, type McpStatusValue } from "./mcp-status-model";

/**
 * PG-McpStatus — MCP 연결 상태 뱃지. 연결됨(초록) · 설정됨(파랑) · 연결 안 됨 · 확인 중(회색).
 * 상태가 바뀌면 화면 읽기 프로그램이 알 수 있게 polite로 읽는다.
 */
function McpStatus({ status, className }: { status: McpStatusValue | null; className?: string }) {
  const state = mcpState(status);
  return (
    <span role="status" aria-live="polite" className={className} data-state={state}>
      <span className="sr-only">MCP </span>
      <StatusChip status={LABEL[state]} color={COLOR[state]} />
    </span>
  );
}

export { McpStatus };
