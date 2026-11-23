import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Backlinks, type BacklinkItem } from "./backlinks";

const hl = (text: string, mention: string) => {
  const i = text.indexOf(mention);
  return { text, highlight: [i, i + mention.length] as [number, number] };
};

const ITEMS: BacklinkItem[] = [
  {
    id: "retro",
    title: "11월 3주 회고",
    emoji: "🪞",
    count: 2,
    snippets: [
      hl(
        "결정 사항은 @2027 상반기 로드맵에 정리했고, 일정은 다음 주에 다시 본다.",
        "@2027 상반기 로드맵",
      ),
      hl(
        "…남은 질문: 채용 일정이 @2027 상반기 로드맵의 2분기 목표와 맞는지",
        "@2027 상반기 로드맵",
      ),
    ],
  },
  {
    id: "meeting",
    title: "11월 18일 주간 회의",
    emoji: "📝",
    count: 1,
    snippets: [hl("안건 1. @2027 상반기 로드맵 초안 검토", "@2027 상반기 로드맵")],
  },
  {
    id: "untitled",
    title: "",
    count: 1,
    snippets: [hl("참고 링크: 로드맵 문서", "로드맵 문서")],
  },
];

/** 본문 아래 백링크 — 이 페이지를 언급한 페이지와 그 문맥 (PAGE-09) */
const meta = {
  title: "L5 페이지/PG-Backlinks",
  component: Backlinks,
  args: { items: ITEMS, onOpen: fn() },
  decorators: [(Story) => <div className="w-180 bg-app p-6">{Story()}</div>],
} satisfies Meta<typeof Backlinks>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 접힌 상태 */
export const Collapsed: Story = { args: { defaultOpen: false } };

/** 키보드: 머리에서 Enter로 접고 펴고, Tab으로 페이지에 가서 연다 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.tab();
    const head = c.getByRole("button", { name: /백링크/ });
    await expect(head).toHaveFocus();
    await expect(head).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Enter}");
    await expect(head).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpen).toHaveBeenCalledWith("retro", { newTab: false, pane: false });
  },
};
