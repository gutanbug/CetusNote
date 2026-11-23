import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyStart } from "./empty-start";

/** 빈 페이지 시작 — “빈 페이지로 시작” / “템플릿에서 시작” + 슬래시 안내 */
const meta = {
  title: "L5 페이지/PG-EmptyStart",
  component: EmptyStart,
  args: { onStartBlank: () => {}, onOpenTemplates: () => {} },
} satisfies Meta<typeof EmptyStart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 템플릿 갤러리(P1)가 아직 없을 때 */
export const BlankOnly: Story = { args: { onOpenTemplates: undefined } };
