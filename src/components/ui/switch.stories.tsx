import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, Sheet } from "@/debug/specimen";
import { Switch } from "./switch";

const meta = {
  title: "L1 UI/UI-Switch",
  component: Switch,
  args: { "aria-label": "맞춤법 검사" },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** on/off · disabled — 시트 §3 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      <Row name="off">
        <Switch aria-label="맞춤법 검사" />
      </Row>
      <Row name="on">
        <Switch aria-label="맞춤법 검사" defaultChecked />
      </Row>
      <Row name="disabled">
        <Switch aria-label="맞춤법 검사" disabled />
        <Switch aria-label="자동 저장" disabled defaultChecked />
      </Row>
      <Row name="레이블과 함께">
        <label className="flex items-center gap-3 text-ui">
          <Switch defaultChecked />
          전체 폭으로 보기
        </label>
      </Row>
    </Sheet>
  ),
};
