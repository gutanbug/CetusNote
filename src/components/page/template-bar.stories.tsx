import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { TemplateBar } from "./template-bar";

const CATEGORIES = [
  { id: "work", name: "업무" },
  { id: "journal", name: "기록" },
  { id: "study", name: "학습" },
];

function Bar(props: { onDone: () => void; description?: string; pageTitle?: string }) {
  const [category, setCategory] = React.useState("journal");
  const [description, setDescription] = React.useState(props.description ?? "");
  const [pageTitle, setPageTitle] = React.useState(props.pageTitle ?? "");
  return (
    <TemplateBar
      categories={CATEGORIES}
      category={category}
      onCategoryChange={setCategory}
      description={description}
      onDescriptionChange={setDescription}
      pageTitle={pageTitle}
      onPageTitleChange={setPageTitle}
      onDone={props.onDone}
    />
  );
}

/** 템플릿 편집 띠 — 분류 · 카드 설명 · 새 문서 제목 · 완료 (PAGE-14) */
const meta = {
  title: "L5 페이지/PG-TemplateBar",
  component: Bar,
  args: {
    onDone: fn(),
    description: "오늘 할 일 · 기록 · 회고",
    pageTitle: "일일 노트 {{date}}",
  },
} satisfies Meta<typeof Bar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 새 템플릿 — 빈 칸은 안내 문구 */
export const Empty: Story = { args: { description: "", pageTitle: "" } };

/** 좁은 폭 — 줄을 바꿔 놓인다 */
export const Narrow: Story = {
  decorators: [(Story) => <div className="w-120">{Story()}</div>],
};

/** 키보드: 분류 → 설명 → 새 문서 제목 → 완료 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("textbox", { name: "카드 설명" }));
    await userEvent.tab();
    await expect(c.getByRole("textbox", { name: "새 문서 제목" })).toHaveFocus();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await expect(args.onDone).toHaveBeenCalled();
  },
};
