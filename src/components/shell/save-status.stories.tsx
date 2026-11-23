import type { Meta, StoryObj } from "@storybook/react-vite";
import { SaveStatus } from "./save-status";

/** 저장 상태 — 저장됨(초록 점) · 저장 중 · 오류(다시 시도) */
const meta = {
  title: "L3 셸/SH-SaveStatus",
  component: SaveStatus,
  args: { state: "saved" },
  decorators: [(Story) => <div className="w-60 bg-sidebar p-2">{Story()}</div>],
} satisfies Meta<typeof SaveStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Saved: Story = {};
export const Saving: Story = { args: { state: "saving" } };
export const Error: Story = { args: { state: "error", onRetry: () => {} } };
