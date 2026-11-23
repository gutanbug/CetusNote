import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { TemplateGallery, type TemplateGalleryItem } from "./template-gallery";
import { SAMPLE_DOCS } from "./template-samples";

const CATEGORIES = [
  { id: "work", name: "업무" },
  { id: "journal", name: "기록" },
  { id: "study", name: "학습" },
];
const ITEMS: Record<string, TemplateGalleryItem[]> = {
  work: [
    {
      id: "meeting",
      emoji: "📝",
      name: "회의록",
      description: "참석자 · 안건 · 결정 · 액션 아이템",
      doc: SAMPLE_DOCS.meeting,
    },
    {
      id: "weekly",
      emoji: "🗓",
      name: "주간 리뷰",
      description: "한 주의 성과 · 막힌 것 · 다음 주 계획",
      doc: SAMPLE_DOCS.weekly,
    },
  ],
  journal: [
    {
      id: "daily",
      emoji: "🌤",
      name: "일일 노트",
      description: "오늘 할 일 · 기록 · 회고",
      doc: SAMPLE_DOCS.daily,
    },
    {
      id: "todo",
      emoji: "✅",
      name: "할 일",
      description: "오늘 · 이번 주 · 대기",
      doc: SAMPLE_DOCS.todo,
    },
  ],
  study: [
    {
      id: "study",
      emoji: "📚",
      name: "학습 노트",
      description: "요약 · 예제 코드 · 기억할 점",
      doc: SAMPLE_DOCS.study,
    },
  ],
};

type GalleryProps = {
  onPick: (id: string) => void;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCreate?: () => void;
};

function Gallery({ onPick, ...actions }: GalleryProps) {
  const [open, setOpen] = React.useState(true);
  const [category, setCategory] = React.useState("work");
  return (
    <TemplateGallery
      open={open}
      onOpenChange={setOpen}
      categories={CATEGORIES}
      category={category}
      onCategoryChange={setCategory}
      items={ITEMS[category] ?? []}
      onPick={onPick}
      {...actions}
    />
  );
}

/** 템플릿 갤러리 — 왼쪽 분류(↑↓로 바로 바뀐다) + 카드 그리드. 카드를 누르면 그 모양으로 페이지를 만든다 */
const meta = {
  title: "L5 페이지/PG-TemplateGallery",
  component: Gallery,
  args: { onPick: fn(), onEdit: fn(), onDuplicate: fn(), onDelete: fn(), onCreate: fn() },
  // Debug 화면: 모달은 화면 전체를 덮으므로 버튼으로 따로 띄운다
  parameters: { debug: { isolate: true } },
} satisfies Meta<typeof Gallery>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 키보드: 분류를 ↓로 옮기고 Tab(새 템플릿 → 카드)으로 카드에 가서 Enter */
export const Keyboard: Story = {
  play: async ({ args }) => {
    const body = within(document.body);
    const work = await body.findByRole("tab", { name: "업무" });
    work.focus();
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(body.getByRole("tab", { name: "기록" })).toHaveFocus());
    await waitFor(() => expect(body.getByRole("heading", { name: "템플릿 · 기록" })).toBeVisible());
    await userEvent.tab();
    await waitFor(() => expect(body.getByRole("button", { name: "새 템플릿" })).toHaveFocus());
    await userEvent.tab();
    await waitFor(() =>
      expect(body.getByRole("button", { name: /^일일 노트 오늘/ })).toHaveFocus(),
    );
    await userEvent.keyboard("{Enter}");
    await expect(args.onPick).toHaveBeenCalledWith("daily");
  },
};

/** ··· 메뉴: 카드 오른쪽 위 버튼으로 편집 · 복제 · 삭제 (PAGE-14) */
export const CardMenu: Story = {
  play: async ({ args }) => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "회의록 템플릿 메뉴" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "편집" }));
    await expect(args.onEdit).toHaveBeenCalledWith("meeting");
    await userEvent.click(await body.findByRole("button", { name: "주간 리뷰 템플릿 메뉴" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "삭제" }));
    await expect(args.onDelete).toHaveBeenCalledWith("weekly");
  },
};

/** 메뉴 없이 (고르기만) — 콜백을 주지 않으면 ··· 버튼이 없다 */
export const PickOnly: Story = {
  args: { onEdit: undefined, onDuplicate: undefined, onDelete: undefined, onCreate: undefined },
};
