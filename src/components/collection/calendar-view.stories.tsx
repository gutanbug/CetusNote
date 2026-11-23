import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { CalendarView, type CalendarDay } from "./calendar-view";
import { SAMPLE_RECORDS } from "./sample";

/** 2026년 11월: 11월 1일이 일요일 → 42칸 */
const DAYS: CalendarDay[] = Array.from({ length: 42 }, (_, i) => {
  const d = new Date(2026, 10, 1 + i);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const many = date === "2026-11-21";
  return {
    date,
    day: d.getDate(),
    out: d.getMonth() !== 10,
    today: date === "2026-11-20",
    items: many
      ? [
          SAMPLE_RECORDS[1]!,
          { id: "x1", title: "주간 회고", status: "할 일", tags: [] },
          { id: "x2", title: "디자인 QA", status: "진행 중", tags: [] },
          { id: "x3", title: "배포 점검", status: "완료", tags: [] },
          { id: "x4", title: "고객 인터뷰 정리", tags: [] },
        ]
      : SAMPLE_RECORDS.filter((r) => r.due?.date === date),
  };
});

/** 캘린더 뷰 — 월 7열 격자, 마감일 칸에 레코드 (COLL-04) */
const meta = {
  title: "L6 컬렉션/CL-CalendarView",
  component: CalendarView,
  args: {
    monthLabel: "2026년 11월",
    days: DAYS,
    onPrev: fn(),
    onNext: fn(),
    onToday: fn(),
    onOpen: fn(),
    onNew: fn(),
  },
  decorators: [(Story) => <div className="w-220 bg-app p-6">{Story()}</div>],
} satisfies Meta<typeof CalendarView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 날짜 칸 hover 강제 — ＋가 드러난다 */
export const Hover: Story = {
  decorators: [(Story) => <div data-force="hover">{Story()}</div>],
};

/** 키보드: 칸의 ＋로 만들고, "+2개 더"로 나머지를 본다 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    c.getByRole("button", { name: "11월 5일 마감 레코드 만들기" }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onNew).toHaveBeenCalledWith("2026-11-05");
    await userEvent.click(c.getByRole("button", { name: /\+2개 더/ }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("button", { name: "고객 인터뷰 정리" }));
    await expect(args.onOpen).toHaveBeenCalledWith("x4", expect.anything());
    await userEvent.click(c.getByRole("button", { name: "다음 달" }));
    await expect(args.onNext).toHaveBeenCalled();
  },
};

/** 이번 달에 마감인 레코드가 없음 — 화면이 넣는 안내가 격자 위에 보인다 */
export const Empty: Story = {
  args: {
    days: DAYS.map((d) => ({ ...d, items: [] })),
    empty: <p className="text-center text-ui text-secondary">이번 달에 마감인 레코드가 없어요.</p>,
  },
};
