import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, Sheet } from "@/debug/specimen";
import { Button } from "./button";
import { Kbd } from "./kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const meta = {
  title: "L1 UI/UI-Tooltip",
  component: TooltipContent,
} satisfies Meta<typeof TooltipContent>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 텍스트 · 텍스트+단축키 (열림 상태로 고정) — 시트 §6 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      <Row name="텍스트" className="h-16">
        <Tooltip open>
          <TooltipTrigger asChild>
            <Button variant="secondary">공유 안 함</Button>
          </TooltipTrigger>
          <TooltipContent side="right">이 앱은 로컬에만 저장해요</TooltipContent>
        </Tooltip>
      </Row>
      <Row name="+단축키" className="h-16">
        <Tooltip open>
          <TooltipTrigger asChild>
            <Button variant="secondary">검색</Button>
          </TooltipTrigger>
          <TooltipContent side="right" shortcut={<Kbd keys={["⌘", "K"]} />}>
            검색
          </TooltipContent>
        </Tooltip>
      </Row>
    </Sheet>
  ),
};

/** 마우스를 올리거나 Tab으로 포커스하면 열린다 */
export const Interactive: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="secondary">올려 보기</Button>
      </TooltipTrigger>
      <TooltipContent shortcut={<Kbd keys={["⌘", "N"]} />}>새 페이지</TooltipContent>
    </Tooltip>
  ),
};
