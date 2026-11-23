import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta = {
  title: "L2 오버레이/OV-Popover",
  component: PopoverContent,
} satisfies Meta<typeof PopoverContent>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 열린 상태 — 그림자, 반경, 등장 모션 (시트 §5) */
export const Open: Story = {
  render: () => (
    <div className="h-48">
      <Popover open modal={false}>
        <PopoverTrigger asChild>
          <Button variant="secondary">페이지 정보</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="페이지 정보" className="grid gap-1 p-3 text-caption">
          <p className="font-medium text-primary">주간 회고</p>
          <p className="text-secondary">만든 날 2026년 11월 12일</p>
          <p className="text-secondary">고친 날 오늘 오전 9:41</p>
          <p className="text-tertiary">단어 1,204개</p>
        </PopoverContent>
      </Popover>
    </div>
  ),
};

/** 클릭으로 열고 Esc로 닫는다 */
export const Interactive: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">열기</Button>
      </PopoverTrigger>
      <PopoverContent aria-label="안내" className="p-3 text-caption text-secondary">
        Esc를 누르면 닫혀요.
      </PopoverContent>
    </Popover>
  ),
};
