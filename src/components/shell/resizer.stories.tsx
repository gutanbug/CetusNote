import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";
import { Resizer } from "./resizer";

function Frame({ dragging }: { dragging?: boolean }) {
  const [width, setWidth] = React.useState(240);
  return (
    <div className="flex h-40">
      <div
        className="relative h-full border-r border-line bg-sidebar"
        style={{ width } as React.CSSProperties}
      >
        <p className="p-3 text-caption text-secondary">너비 {width}px</p>
        <Resizer
          width={width}
          onWidthChange={setWidth}
          onReset={() => setWidth(240)}
          className={dragging ? "after:opacity-100" : undefined}
        />
      </div>
    </div>
  );
}

/** 사이드바 너비 조절 — 끌기, ←→ 16px, Home/End 최소(200)·최대(400), 두 번 누르기·Enter로 240 */
const meta = {
  title: "L3 셸/SH-Resizer",
  component: Frame,
} satisfies Meta<typeof Frame>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 (마우스를 올리면 accent 2px 선) */
export const Default: Story = {};

/** 끄는 중 */
export const Dragging: Story = { args: { dragging: true } };

/** 키보드 */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const sep = within(canvasElement).getByRole("separator", { name: "사이드바 너비 조절" });
    sep.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect(sep).toHaveAttribute("aria-valuenow", "272");
    await userEvent.keyboard("{End}");
    await expect(sep).toHaveAttribute("aria-valuenow", "400");
    await userEvent.keyboard("{Home}");
    await expect(sep).toHaveAttribute("aria-valuenow", "200");
    await userEvent.keyboard("{Enter}");
    await expect(sep).toHaveAttribute("aria-valuenow", "240");
  },
};
