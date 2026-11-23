import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, Sheet } from "@/debug/specimen";
import { Kbd } from "./kbd";

const meta = {
  title: "L1 UI/UI-Kbd",
  component: Kbd,
  args: { keys: ["⌘", "K"] },
} satisfies Meta<typeof Kbd>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** 단일 키 · 조합 — 시트 §6 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      <Row name="단일 키">
        <Kbd keys={["Esc"]} />
        <Kbd keys={["↵"]} />
        <Kbd keys={["/"]} />
      </Row>
      <Row name="조합">
        <Kbd keys={["⌘", "K"]} />
        <Kbd keys={["⌘", "⇧", "D"]} />
        <Kbd keys={["⌘", "\\"]} />
      </Row>
      <Row name="문장 안">
        <p className="text-caption text-secondary">
          <Kbd keys={["⌘", "K"]} /> 로 어디서든 검색할 수 있어요.
        </p>
      </Row>
    </Sheet>
  ),
};
