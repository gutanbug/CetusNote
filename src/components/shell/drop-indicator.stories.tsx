import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText } from "lucide-react";
import { DropIndicator, type DropPosition } from "./drop-indicator";
import { rowBase } from "./parts";

function Row({ position, title }: { position?: DropPosition; title: string }) {
  return (
    <div className={`${rowBase} relative min-h-7.5 gap-2 px-2 py-1`}>
      {position ? <DropIndicator position={position} /> : null}
      <FileText strokeWidth={1.5} aria-hidden className="size-4 shrink-0 text-tertiary" />
      <span className="truncate">{title}</span>
    </div>
  );
}

/** 트리에서 놓을 자리 — 앞(위 선) · 뒤(아래 선) · 안쪽(테두리). 포인트 색 2px (프로토타입 data-dropline) */
const meta = {
  title: "L3 셸/SH-DropIndicator",
  component: DropIndicator,
  args: { position: "before" },
  render: (args) => (
    <div className="grid w-60 gap-px bg-sidebar p-2">
      <Row title="11월 11일 주간 회의" />
      <Row title="2027 상반기 로드맵" position={args.position} />
      <Row title="읽고 싶은 책" />
    </div>
  ),
} satisfies Meta<typeof DropIndicator>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Before: Story = {};
export const After: Story = { args: { position: "after" } };
export const Inside: Story = { args: { position: "inside" } };
