import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ShortcutRecorder, type ShortcutRecorderLabels } from "./shortcut-recorder";

const labels: ShortcutRecorderLabels = {
  aria: "빠른 입력 단축키",
  recording: "키를 누르세요…",
  empty: "없음",
  issue: {
    no_modifier: "⌘, ⌥, ⌃, ⇧ 중 하나를 함께 눌러 주세요",
    reserved: "⌘Space와 ⌥Space는 시스템이 쓰므로 고를 수 없어요",
  },
  hint: "Esc는 취소, Backspace는 기본값으로 되돌려요",
};

/** 단축키 기록기 — 클릭 후 조합을 누르면 기록된다 (QN-03) */
const meta = {
  title: "L5 페이지/PG-ShortcutRecorder",
  component: ShortcutRecorder,
  args: {
    value: "Alt+Shift+Space",
    defaultValue: "Alt+Shift+Space",
    onChange: () => undefined,
    labels,
  },
} satisfies Meta<typeof ShortcutRecorder>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { value: "" } };

export const Interactive: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <ShortcutRecorder {...args} value={value} onChange={setValue} />;
  },
};
