import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { SAMPLE_WORKSPACES } from "@/debug/shell-data";
import { WorkspaceMenu } from "@/debug/shell-sample";
import { WorkspaceSwitcher } from "./workspace-switcher";

/** 워크스페이스 스위처 — 아바타 + 이름 + 펼침. 누르면 워크스페이스 메뉴 */
const meta = {
  title: "L3 셸/SH-WorkspaceSwitcher",
  component: WorkspaceSwitcher,
  args: {
    name: "내 노트",
    workspaces: SAMPLE_WORKSPACES,
    onCreate: fn(),
    onOpenFolder: fn(),
    children: <WorkspaceMenu />,
  },
  decorators: [(Story) => <div className="w-60 bg-sidebar pb-2">{Story()}</div>],
} satisfies Meta<typeof WorkspaceSwitcher>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 · hover (툴바의 상태 강제로 확인) */
export const Default: Story = {};

/** 목록 없이(이전 방식) — 맨 위 카드에 이름 + 폴더 정보 */
export const CardOnly: Story = {
  args: { workspaces: undefined, detail: "~/Documents/내 노트 · 페이지 24개" },
};

/** 긴 이름 — 말줄임 */
export const LongName: Story = { args: { name: "회사 프로젝트 문서 보관함 (2026)" } };

// 열린 메뉴는 Radix가 스토리 루트를 aria-hidden으로 가린다 — 그 안의 트리거 포커스만 예외로 둔다
const menuOpenA11y = { a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } } };

/** 열림 — open을 켜 둬 메뉴가 바로 보인다(트리거 클릭에 기대지 않는다) */
export const Open: Story = {
  args: { open: true, onOpenChange: fn() },
  parameters: menuOpenA11y,
  play: async ({ args }) => {
    const menu = await within(document.body).findByRole("menu");
    await waitFor(() => expect(menu).toBeVisible());
    // 워크스페이스 행: 이름 + 폴더 위치·문서 수, 지금 것에 체크
    await expect(within(menu).getByText("페이지 24개 · ~/Documents/내 노트")).toBeVisible();
    await expect(
      within(menu).getByRole("menuitem", { name: /내 노트.*지금 열림/ }),
    ).toHaveAttribute("aria-current", "true");
    await userEvent.click(within(menu).getByRole("menuitem", { name: /새 워크스페이스/ }));
    await expect(args.onCreate).toHaveBeenCalled();
  },
};

const onSelectOther = fn();
const onRemoveOther = fn();

/** 목록에서 빼기 (SHELL-16) — ×를 누르거나 행에서 Delete. 전환으로 번지지 않고, 지금 열린 행에는 없다 */
export const RemoveFromList: Story = {
  parameters: menuOpenA11y,
  args: {
    open: true,
    onOpenChange: fn(),
    workspaces: SAMPLE_WORKSPACES.map((w) =>
      w.current ? w : { ...w, onSelect: onSelectOther, onRemove: onRemoveOther },
    ),
  },
  play: async ({ args }) => {
    onSelectOther.mockClear();
    onRemoveOther.mockClear();
    const menu = await within(document.body).findByRole("menu");
    await waitFor(() => expect(menu).toBeVisible());
    const current = within(menu).getByRole("menuitem", { name: /지금 열림/ });
    await expect(current.querySelector('[data-slot="workspace-remove"]')).toBeNull();
    await expect(current).not.toHaveAttribute("aria-keyshortcuts");

    const work = within(menu).getByRole("menuitem", { name: /업무 노트/ });
    await expect(work).toHaveAttribute("aria-keyshortcuts", "Delete");
    await userEvent.click(work.querySelector<HTMLElement>('[data-slot="workspace-remove"]')!);
    await expect(onRemoveOther).toHaveBeenCalledTimes(1);
    await expect(onSelectOther).not.toHaveBeenCalled();

    const trip = within(menu).getByRole("menuitem", { name: /여행 준비/ });
    trip.focus();
    await userEvent.keyboard("{Delete}");
    await expect(onRemoveOther).toHaveBeenCalledTimes(2);
    await expect(onSelectOther).not.toHaveBeenCalled();
    // 빼도 메뉴는 열린 채 — Esc는 닫기 요청(onOpenChange(false))만 보낸다
    await userEvent.keyboard("{Escape}");
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};
