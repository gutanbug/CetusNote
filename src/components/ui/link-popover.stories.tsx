import type { Meta, StoryObj } from "@storybook/react-vite";
import { Link } from "lucide-react";
import { IconButton } from "./icon-button";
import { LinkEditor } from "./link-popover";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta = {
  title: "L2 오버레이/OV-LinkPopover",
  component: LinkEditor,
  args: { onSubmit: () => {} },
} satisfies Meta<typeof LinkEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-24">
      <Popover open modal={false}>
        <PopoverTrigger asChild>
          <IconButton label="링크" noTooltip>
            <Link strokeWidth={1.5} />
          </IconButton>
        </PopoverTrigger>
        <PopoverContent aria-label="링크 편집" onOpenAutoFocus={(e) => e.preventDefault()}>
          {children}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** 새 링크 입력 (주소가 없으면 적용 비활성) */
export const New: Story = {
  render: () => (
    <Shell>
      <LinkEditor onSubmit={() => {}} />
    </Shell>
  ),
};

/** 기존 링크 — 열기 · 제거 */
export const Edit: Story = {
  render: () => (
    <Shell>
      <LinkEditor
        href="https://tiptap.dev/docs"
        onSubmit={() => {}}
        onOpen={() => {}}
        onRemove={() => {}}
      />
    </Shell>
  ),
};
