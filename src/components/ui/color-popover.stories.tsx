import type { Meta, StoryObj } from "@storybook/react-vite";
import { Baseline } from "lucide-react";
import { useState } from "react";
import { ColorPicker, type ColorValue } from "./color-popover";
import { IconButton } from "./icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta = {
  title: "L2 오버레이/OV-ColorPopover",
  component: ColorPicker,
  args: { value: { text: null, highlight: null }, onChange: () => {} },
} satisfies Meta<typeof ColorPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 글자색 · 배경색 2줄 (소프트 컬러 9종), 선택 상태 */
export const Open: Story = {
  render: function Render() {
    const [value, setValue] = useState<ColorValue>({ text: "red", highlight: "yellow" });
    return (
      <div className="h-40">
        <Popover open modal={false}>
          <PopoverTrigger asChild>
            <IconButton label="글자색" noTooltip>
              <Baseline strokeWidth={1.5} />
            </IconButton>
          </PopoverTrigger>
          <PopoverContent aria-label="글자색과 배경색">
            <ColorPicker value={value} onChange={setValue} />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
};
