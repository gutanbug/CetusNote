import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, Sheet } from "@/debug/specimen";
import { Avatar } from "./avatar";

const meta = {
  title: "L1 UI/UI-Avatar",
  component: Avatar,
  args: { name: "내 노트", size: "sm" },
  argTypes: { size: { control: "inline-radio", options: ["sm", "md"] } },
} satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** sm(22) · md(32), 한글/영문 이니셜 — 시트 §1 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      {(["sm", "md"] as const).map((size) => (
        <Row key={size} name={size}>
          <Avatar size={size} name="내 노트" />
          <Avatar size={size} name="Work Notes" />
          <Avatar size={size} name="journal" />
        </Row>
      ))}
    </Sheet>
  ),
};
