import { describe, expect, it } from "vitest";
import { clientLabel, mcpDetail, mcpState } from "./mcp-status-model";

const none = { clients: [], claudeCode: false, claudeDesktop: false };

describe("MCP 연결 상태 (DATA-12)", () => {
  it("연결이 있으면 연결됨, 등록만 있으면 설정됨, 둘 다 없으면 연결 안 됨", () => {
    expect(mcpState(null)).toBe("loading");
    expect(mcpState({ ...none, clients: ["claude-code"] })).toBe("connected");
    expect(mcpState({ ...none, claudeDesktop: true })).toBe("configured");
    expect(mcpState(none)).toBe("none");
  });

  it("연결한 도구 이름을 사람이 읽는 이름으로 한 번씩만 적는다", () => {
    expect(mcpDetail({ ...none, clients: ["claude-code", "claude-code", "claude-ai"] })).toBe(
      "Claude Code · Claude Desktop에서 이 워크스페이스에 연결돼 있어요.",
    );
    expect(clientLabel("cursor")).toBe("cursor");
    expect(clientLabel("")).toBe("알 수 없는 도구");
  });

  it("등록만 된 도구를 알려 준다", () => {
    expect(mcpDetail({ ...none, claudeCode: true })).toBe(
      "Claude Code에 등록돼 있어요. 그 도구에서 대화를 시작하면 연결돼요.",
    );
  });
});
