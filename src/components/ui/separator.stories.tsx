import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, Sheet } from "@/debug/specimen";
import { Separator } from "./separator";

const meta = {
  title: "L1 UI/UI-Separator",
  component: Separator,
} satisfies Meta<typeof Separator>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 가로 · 세로 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      <Row name="가로" className="w-80">
        <div className="grid w-full gap-2 text-ui">
          <span>즐겨찾기</span>
          <Separator />
          <span>개인 페이지</span>
        </div>
      </Row>
      <Row name="세로">
        <div className="flex h-5 items-center gap-3 text-caption text-secondary">
          <span>단어 1,204</span>
          <Separator orientation="vertical" />
          <span>읽는 시간 5분</span>
        </div>
      </Row>
    </Sheet>
  ),
};
