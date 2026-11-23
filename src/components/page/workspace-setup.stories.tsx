import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { WorkspaceSetup } from "./workspace-setup";

/** 첫 실행 — 노트를 저장할 폴더 고르기 (DATA-03) */
const meta = {
  title: "L5 페이지/PG-WorkspaceSetup",
  component: WorkspaceSetup,
  args: {
    defaultLabel: "~/Documents/CetusNote",
    onUseDefault: fn(),
    onPick: fn(),
  },
} satisfies Meta<typeof WorkspaceSetup>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 처음 열면 “기본 위치에 만들기”에 포커스 — Enter로 바로 시작 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const create = canvas.getByRole("button", { name: "기본 위치에 만들기" });
    await expect(create).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onUseDefault).toHaveBeenCalledTimes(1);
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "다른 폴더 선택…" })).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(args.onPick).toHaveBeenCalledTimes(1);
  },
};

/** 지난번 폴더가 옮겨졌거나 지워졌을 때 */
export const MissingFolder: Story = {
  args: { missingPath: "/Users/me/Dropbox/노트" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "지난번에 쓰던 폴더를 찾을 수 없어요.",
    );
  },
};

/** 폴더를 여는 중 — 누른 버튼만 로딩, 둘 다 잠김 */
export const Busy: Story = {
  args: { busy: "default" },
  play: async ({ canvasElement }) => {
    const buttons = within(canvasElement).getAllByRole("button");
    for (const b of buttons) await expect(b).toBeDisabled();
    await expect(buttons[0]).toHaveAttribute("aria-busy", "true");
  },
};

/** 쓸 수 없는 폴더를 골랐을 때 */
export const Error: Story = {
  args: { error: "이 폴더에는 쓸 수 없어요. 다른 폴더를 골라 주세요." },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("쓸 수 없어요");
  },
};
