import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AccentSwatchGroup } from "./accent-swatch";
import type { AccentChoice } from "./options";

function Group({ initial = "blue" }: { initial?: AccentChoice }) {
  const [v, setV] = React.useState<AccentChoice>(initial);
  return <AccentSwatchGroup value={v} onValueChange={setV} className="max-w-165" />;
}

/** 포인트 색 견본 — 8종, 고른 색은 accent 테두리 + 체크. 점은 그 색의 라이트/다크 값 */
const meta = {
  title: "L5 페이지/PG-AccentSwatch",
  component: Group,
} satisfies Meta<typeof Group>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const TealSelected: Story = { args: { initial: "teal" } };

export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    c.getByRole("radio", { name: "블루" }).focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect(c.getByRole("radio", { name: "바이올렛" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await waitFor(() => expect(document.activeElement).toHaveAttribute("aria-checked", "true"));
  },
};
