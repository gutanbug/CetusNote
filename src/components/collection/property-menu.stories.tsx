import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { PropertyMenu } from "./property";
import { SAMPLE_ENTRIES, SAMPLE_PROPERTIES } from "./sample";

const stage = SAMPLE_ENTRIES.find((e) => e.key === "fstage001")!;
const trigger = (
  <button type="button" className="rounded-md px-2 py-1 text-ui text-secondary">
    단계 속성 메뉴
  </button>
);

/** 속성 하나 편집 (COLL-08) — 이름 · 옵션 · 순서 · 카드 표시 · 숨기기 · 지우기(두 번 눌러 확인) */
const meta = {
  title: "L6 컬렉션/CL-PropertyMenu",
  component: PropertyMenu,
  args: {
    entry: stage,
    options: SAMPLE_PROPERTIES.find((p) => p.id === "fstage001")!.options,
    onRename: fn(),
    onToggleHidden: fn(),
    onToggleCard: fn(),
    onMove: fn(),
    onDelete: fn(),
    onRenameOption: fn(),
    onDeleteOption: fn(),
    children: trigger,
  },
  decorators: [(Story) => <div className="h-110 bg-app p-6">{Story()}</div>],
} satisfies Meta<typeof PropertyMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 기본 속성 — 이름을 못 바꾸고 지울 수 없다 */
export const Builtin: Story = {
  args: {
    entry: SAMPLE_ENTRIES[1]!,
    options: undefined,
    onRename: undefined,
    onDelete: undefined,
    children: (
      <button type="button" className="rounded-md px-2 py-1 text-ui text-secondary">
        담당 속성 메뉴
      </button>
    ),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "담당 속성 메뉴" }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText("기본 속성")).toBeInTheDocument();
    await expect(body.queryByRole("textbox", { name: "속성 이름" })).toBeNull();
    await expect(body.queryByRole("button", { name: /속성 지우기/ })).toBeNull();
    await userEvent.keyboard("{Escape}");
  },
};

/** 키보드: 이름 바꾸고 Enter, 옵션 이름 바꾸기, 지우기는 두 번 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(c.getByRole("button", { name: "단계 속성 메뉴" }));
    const name = await body.findByRole("textbox", { name: "속성 이름" });
    await userEvent.clear(name);
    await userEvent.type(name, "진행 단계{Enter}");
    await expect(args.onRename).toHaveBeenCalledWith("진행 단계");

    await userEvent.click(c.getByRole("button", { name: "단계 속성 메뉴" }));
    const opt = await body.findByRole("textbox", { name: "옵션 이름: 초안" });
    await userEvent.clear(opt);
    await userEvent.type(opt, "기획{Enter}");
    await expect(args.onRenameOption).toHaveBeenCalledWith("초안", "기획");

    const del = body.getByRole("button", { name: "속성 지우기" });
    await userEvent.click(del);
    await expect(args.onDelete).not.toHaveBeenCalled();
    await userEvent.click(body.getByRole("button", { name: /한 번 더 누르면/ }));
    await expect(args.onDelete).toHaveBeenCalled();
  },
};
