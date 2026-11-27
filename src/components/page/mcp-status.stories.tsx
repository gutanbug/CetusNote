import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, Sheet } from "@/debug/specimen";
import { McpStatus } from "./mcp-status";
import { mcpDetail, type McpStatusValue } from "./mcp-status-model";

const meta = {
  title: "L5 페이지/PG-McpStatus",
  component: McpStatus,
  args: { status: { clients: ["claude-code"], claudeCode: true, claudeDesktop: false } },
} satisfies Meta<typeof McpStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const CASES: { name: string; status: McpStatusValue | null }[] = [
  { name: "확인 중", status: null },
  {
    name: "연결됨",
    status: { clients: ["claude-code", "claude-ai"], claudeCode: true, claudeDesktop: true },
  },
  { name: "설정됨", status: { clients: [], claudeCode: true, claudeDesktop: false } },
  { name: "연결 안 됨", status: { clients: [], claudeCode: false, claudeDesktop: false } },
];

/** 네 상태 — 뱃지와 한 줄 설명 */
export const States: Story = {
  render: () => (
    <Sheet>
      {CASES.map((c) => (
        <Row key={c.name} name={c.name}>
          <McpStatus status={c.status} />
          <span className="text-caption text-secondary">{mcpDetail(c.status)}</span>
        </Row>
      ))}
    </Sheet>
  ),
};
