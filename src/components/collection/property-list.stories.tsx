import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { PropertyList } from "./property";
import { SAMPLE_ENTRIES } from "./sample";

function Live(args: React.ComponentProps<typeof PropertyList>) {
  const [entries, setEntries] = React.useState(args.entries);
  const flip = (key: string, k: "hidden" | "card") =>
    setEntries((l) => l.map((e) => (e.key === key ? { ...e, [k]: !e[k] } : e)));
  return (
    <PropertyList
      {...args}
      entries={entries}
      onToggleHidden={(key) => {
        args.onToggleHidden(key);
        flip(key, "hidden");
      }}
      onToggleCard={(key) => {
        args.onToggleCard(key);
        flip(key, "card");
      }}
      onMove={(key, dir) => {
        args.onMove(key, dir);
        setEntries((l) => {
          const i = l.findIndex((e) => e.key === key);
          const j = i + dir;
          if (j < 0 || j >= l.length) return l;
          const next = [...l];
          [next[i], next[j]] = [next[j]!, next[i]!];
          return next;
        });
      }}
    />
  );
}

/** 툴바 "속성" 안 (COLL-08) — 보이기 · 보드 카드 표시 · 순서 · 속성 추가 */
const meta = {
  title: "L6 컬렉션/CL-PropertyList",
  component: PropertyList,
  render: (args) => <Live {...args} />,
  args: {
    entries: SAMPLE_ENTRIES,
    onToggleHidden: fn(),
    onToggleCard: fn(),
    onMove: fn(),
    onAdd: fn(),
  },
  decorators: [
    (Story) => <div className="w-72 rounded-lg bg-elevated p-1 shadow-popover">{Story()}</div>,
  ],
} satisfies Meta<typeof PropertyList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 버튼 hover 강제 */
export const Hover: Story = {
  decorators: [(Story) => <div data-force="hover">{Story()}</div>],
};

/** 숨긴 메모를 보이고, 단계를 위로, 카드 표시 끄기 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const show = c.getByRole("button", { name: "메모 표시" });
    await expect(show).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(show);
    await expect(args.onToggleHidden).toHaveBeenCalledWith("fmemo0001");
    await expect(show).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(c.getByRole("button", { name: "단계 위로" }));
    await expect(args.onMove).toHaveBeenCalledWith("fstage001", -1);
    await userEvent.click(c.getByRole("button", { name: "단계 보드 카드 표시" }));
    await expect(args.onToggleCard).toHaveBeenCalledWith("fstage001");
  },
};
