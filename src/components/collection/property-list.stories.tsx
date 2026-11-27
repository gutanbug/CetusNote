import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
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
      onReorder={(key, beforeKey) => {
        args.onReorder(key, beforeKey);
        setEntries((l) => {
          const from = l.find((e) => e.key === key);
          const rest = l.filter((e) => e.key !== key);
          const at = beforeKey === null ? rest.length : rest.findIndex((e) => e.key === beforeKey);
          if (!from || at < 0) return l;
          rest.splice(at, 0, from);
          return rest;
        });
      }}
    />
  );
}

/** 툴바 "속성" 안 (COLL-08) — 끌어서 순서 바꾸기 · 보이기 · 보드 카드 표시 · 속성 추가 */
const meta = {
  title: "L6 컬렉션/CL-PropertyList",
  component: PropertyList,
  render: (args) => <Live {...args} />,
  args: {
    entries: SAMPLE_ENTRIES,
    onToggleHidden: fn(),
    onToggleCard: fn(),
    onMove: fn(),
    onReorder: fn(),
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

/** 라이트·다크 나란히 (Storybook 툴바 theme=both와 같다) */
export const LightAndDark: Story = {
  globals: { theme: "both" },
};

/** 손잡이를 끌어 목록 맨 끝에 놓기 — 끄는 줄은 흐려지고, 놓을 자리에 미리보기가 뜬다 */
export const DragReorder: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const list = c.getByRole("list", { name: "속성" });
    const handle = c.getByRole("button", { name: "상태 순서 바꾸기" });
    const row = handle.closest("li")!;
    const count = list.querySelectorAll("[data-prop-key]").length;
    const dt = new DataTransfer();
    handle.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    await waitFor(() => expect(row).toHaveAttribute("data-dragging"));
    // 맨 마지막 줄의 아랫쪽 — 어느 줄의 윗반에도 안 걸리므로 맨 끝이 된다
    const rows = list.querySelectorAll<HTMLElement>("[data-prop-key]");
    const y = rows[rows.length - 1]!.getBoundingClientRect().bottom - 1;
    list.dispatchEvent(
      new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y }),
    );
    await waitFor(() => expect(list.querySelector('[data-slot="drop-preview"]')).not.toBeNull());
    list.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y }),
    );
    await expect(args.onReorder).toHaveBeenCalledWith("status", null);
    await expect(c.getByRole("status")).toHaveTextContent(`“상태” ${count}번째로 옮겼어요.`);
    await expect(row).not.toHaveAttribute("data-dragging");
    await expect(list.querySelector('[data-slot="drop-preview"]')).toBeNull();
  },
};

/** 숨긴 메모를 보이고, 단계를 Alt+↑로 한 칸 올리고, 카드 표시 끄기 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const show = c.getByRole("button", { name: "메모 표시" });
    await expect(show).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(show);
    await expect(args.onToggleHidden).toHaveBeenCalledWith("fmemo0001");
    await expect(show).toHaveAttribute("aria-pressed", "true");
    const up = c.getByRole("button", { name: "단계 순서 바꾸기" });
    up.focus();
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await expect(args.onMove).toHaveBeenCalledWith("fstage001", -1);
    await expect(c.getByRole("status")).toHaveTextContent(/“단계” \d+번째로 옮겼어요\./);
    await expect(up).toHaveFocus();
    await userEvent.click(c.getByRole("button", { name: "단계 보드 카드 표시" }));
    await expect(args.onToggleCard).toHaveBeenCalledWith("fstage001");
  },
};
