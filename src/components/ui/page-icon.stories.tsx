import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageIcon } from "./page-icon";
import { SAMPLE_IMAGE_ICON } from "./page-icon-sample";

const meta = {
  title: "L1 UI/UI-PageIcon",
  component: PageIcon,
  args: { icon: "📝" },
} satisfies Meta<typeof PageIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 세 종류 — 이모지 · lucide 아이콘 · 올린 이미지. 글자 크기(1em)를 따른다 */
export const Kinds: Story = {
  render: () => (
    <div className="grid gap-4">
      {(["text-ui", "text-h3", "text-page-icon"] as const).map((size) => (
        <div key={size} className={`flex items-center gap-3 ${size}`}>
          <PageIcon icon="📝" />
          <PageIcon icon="lucide:book-open" />
          <PageIcon icon="lucide:rocket:orange" />
          <PageIcon icon={SAMPLE_IMAGE_ICON} />
          <span className="text-ui text-secondary">회의록</span>
        </div>
      ))}
    </div>
  ),
};

/** 아이콘 색 — 기본(보조 글자색) + 소프트 컬러 9종 */
export const Colors: Story = {
  render: () => (
    <div className="flex gap-3 text-h3">
      {["", "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"].map(
        (c) => (
          <PageIcon key={c || "default"} icon={c ? `lucide:star:${c}` : "lucide:star"} />
        ),
      )}
    </div>
  ),
};

/** 사이드바 행처럼 — 제목 옆 작은 크기 */
export const InRow: Story = {
  render: () => (
    <ul className="grid w-60 gap-0.5 text-ui">
      {[
        ["📝", "회의록"],
        ["lucide:calendar:blue", "주간 일정"],
        ["lucide:coffee:brown", "카페 메모"],
        [SAMPLE_IMAGE_ICON, "제주 여행"],
      ].map(([icon, title]) => (
        <li key={title} className="flex h-7 items-center gap-2 rounded-md px-2 hover:bg-hover">
          <span className="w-4.5 shrink-0 text-center leading-none">
            <PageIcon icon={icon!} />
          </span>
          {title}
        </li>
      ))}
    </ul>
  ),
};
