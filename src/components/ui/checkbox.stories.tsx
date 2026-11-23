import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, Sheet } from "@/debug/specimen";
import { Checkbox } from "./checkbox";

const meta = {
  title: "L1 UI/UI-Checkbox",
  component: Checkbox,
  args: { "aria-label": "완료" },
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** off · on · indeterminate × hover · disabled — 시트 §3 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      <Row name="off / on / 일부">
        <Checkbox aria-label="장보기 완료" />
        <Checkbox aria-label="회의록 정리 완료" defaultChecked />
        <Checkbox aria-label="모두 선택" checked="indeterminate" />
      </Row>
      <Row name="hover" force="hover">
        <Checkbox aria-label="장보기 완료" />
        <Checkbox aria-label="회의록 정리 완료" defaultChecked />
      </Row>
      <Row name="disabled">
        <Checkbox aria-label="장보기 완료" disabled />
        <Checkbox aria-label="회의록 정리 완료" disabled defaultChecked />
      </Row>
      <Row name="레이블과 함께">
        <label className="flex items-center gap-2 text-body">
          <Checkbox defaultChecked />
          <span className="text-tertiary line-through">주간 회고 쓰기</span>
        </label>
      </Row>
    </Sheet>
  ),
};
