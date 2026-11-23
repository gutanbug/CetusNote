import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea } from "./scroll-area";

const PAGES = [
  "주간 회고",
  "독서 노트 — 사피엔스",
  "여행 준비물",
  "회의록 11/18",
  "아이디어 메모",
  "장보기 목록",
  "제품 로드맵",
  "운동 기록",
  "레시피: 된장찌개",
  "영화 보고 싶은 것",
  "2027 목표",
  "블로그 초안",
  "읽을 논문",
  "가계부 11월",
];

const meta = {
  title: "L1 UI/UI-ScrollArea",
  component: ScrollArea,
} satisfies Meta<typeof ScrollArea>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 내용을 내리면 상단 구분선이 생긴다 */
export const Default: Story = {
  render: () => (
    <ScrollArea className="h-60 w-64 rounded-md bg-sidebar" aria-label="페이지 목록">
      <ul className="grid gap-0.5 p-1">
        {PAGES.map((p) => (
          <li key={p} className="rounded-md px-2 py-1 text-ui text-secondary hover:bg-hover">
            {p}
          </li>
        ))}
      </ul>
    </ScrollArea>
  ),
};
