import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, Sheet } from "@/debug/specimen";
import { Progress } from "./progress";

const meta = {
  title: "L1 UI/UI-Progress",
  component: Progress,
  args: { value: 50, "aria-label": "가져오기 진행률" },
} satisfies Meta<typeof Progress>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { render: (a) => <Progress {...a} className="w-60" /> };

/** 0 · 50 · 100% — 시트 §15 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      {[0, 50, 100].map((v) => (
        <Row key={v} name={`${v}%`} className="w-60">
          <Progress value={v} aria-label={`가져오기 ${v}%`} />
        </Row>
      ))}
    </Sheet>
  ),
};
