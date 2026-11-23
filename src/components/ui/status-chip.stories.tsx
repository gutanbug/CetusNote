import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, Sheet } from "@/debug/specimen";
import { StatusChip, STATUSES } from "./status-chip";

const meta = {
  title: "L1 UI/UI-StatusChip",
  component: StatusChip,
  args: { status: "진행 중" },
  argTypes: { status: { control: "inline-radio", options: STATUSES } },
} satisfies Meta<typeof StatusChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** 할 일 · 진행 중 · 검토 · 완료 — 시트 §11 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      <Row name="4종">
        {STATUSES.map((s) => (
          <StatusChip key={s} status={s} />
        ))}
      </Row>
    </Sheet>
  ),
};
