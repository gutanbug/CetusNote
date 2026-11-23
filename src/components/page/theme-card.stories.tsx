import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeCardGroup, type ThemeChoice } from "./theme-card";

function Group({ initial = "system" }: { initial?: ThemeChoice }) {
  const [v, setV] = React.useState<ThemeChoice>(initial);
  return <ThemeCardGroup value={v} onValueChange={setV} className="max-w-150" />;
}

/** 테마 카드 — 라이트 · 다크 · 시스템. 미리보기는 그 테마의 실제 토큰 색 */
const meta = {
  title: "L5 페이지/PG-ThemeCard",
  component: Group,
} satisfies Meta<typeof Group>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LightSelected: Story = { args: { initial: "light" } };

/** 방향키로 고르기 */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    c.getByRole("radio", { name: "시스템" }).focus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(c.getByRole("radio", { name: "다크" })).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(document.activeElement).toHaveAttribute("aria-checked", "true"));
  },
};
