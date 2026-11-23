import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, Sheet } from "@/debug/specimen";
import { Input } from "./input";

const meta = {
  title: "L1 UI/UI-Input",
  component: Input,
  args: { placeholder: "워크스페이스 이름", "aria-label": "워크스페이스 이름" },
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** 기본 · 오류 × 상태 — 시트 §3 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      <Row name="default" className="w-65">
        <Input aria-label="워크스페이스 이름" placeholder="워크스페이스 이름" />
      </Row>
      <Row name="값 입력" className="w-65">
        <Input aria-label="워크스페이스 이름" defaultValue="내 노트" />
      </Row>
      <Row name="hover" force="hover" className="w-65">
        <Input aria-label="워크스페이스 이름" defaultValue="내 노트" />
      </Row>
      <Row name="disabled" className="w-65">
        <Input aria-label="저장 위치" defaultValue="로컬 전용" disabled />
      </Row>
      <Row name="error" className="grid w-65 gap-1">
        <Input
          aria-label="워크스페이스 이름"
          defaultValue=""
          aria-invalid
          aria-describedby="ws-err"
        />
        <p id="ws-err" className="text-label text-danger">
          이름을 입력해 주세요.
        </p>
      </Row>
    </Sheet>
  ),
};
