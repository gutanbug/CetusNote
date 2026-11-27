import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { layoutCalendar, type CalendarSpanInput } from "@/features/collection/calendar-span";
import { CalendarView, type CalendarDay } from "./calendar-view";

/** 2026년 11월: 11월 1일이 일요일 → 42칸 (6주) */
const DATES: string[] = Array.from({ length: 42 }, (_, i) => {
  const d = new Date(2026, 10, 1 + i);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
});

const DAYS: CalendarDay[] = DATES.map((date, i) => {
  const d = new Date(2026, 10, 1 + i);
  return {
    date,
    day: d.getDate(),
    out: d.getMonth() !== 10,
    today: date === "2026-11-20",
  };
});

/** 막대 샘플. 시작·마감 조합을 골고루 넣는다 */
const RECORDS: CalendarSpanInput[] = [
  // 3일짜리 (11/10–11/12, 화–목) — 막대 폭 = 3칸
  { id: "plan", title: "기획 초안", status: "진행 중", start: "2026-11-10", due: "2026-11-12" },
  // 기획 초안과 겹침 → 다른 줄
  { id: "qa", title: "디자인 QA", status: "할 일", start: "2026-11-11", due: "2026-11-14" },
  // 주 경계(11/28 → 11/29)를 넘음 → 두 조각
  { id: "release", title: "릴리스 준비", status: "완료", start: "2026-11-26", due: "2026-12-02" },
  // 시작만 → 그 날 하루짜리
  { id: "only-start", title: "시작만 있는 일", start: "2026-11-20", due: null },
  // 마감만 → 그 날 하루짜리
  { id: "only-due", title: "마감만 있는 일", start: null, due: "2026-11-27" },
  // 11/21에 다섯 개 → 줄 3개를 넘어 "+2개 더"
  { id: "x1", title: "주간 회고", status: "할 일", start: "2026-11-21", due: "2026-11-21" },
  { id: "x2", title: "디자인 QA 2", status: "진행 중", start: "2026-11-21", due: "2026-11-21" },
  { id: "x3", title: "배포 점검", status: "완료", start: "2026-11-21", due: "2026-11-21" },
  { id: "x4", title: "고객 인터뷰 정리", start: "2026-11-21", due: "2026-11-21" },
  { id: "x5", title: "회의록 정리", start: "2026-11-21", due: "2026-11-21" },
];

const LAYOUT = layoutCalendar(DATES, RECORDS);

/** 캘린더 뷰 — 월 7열 격자, 시작~마감 기간을 이어진 막대로 (COLL-04) */
const meta = {
  title: "L6 컬렉션/CL-CalendarView",
  component: CalendarView,
  args: {
    monthLabel: "2026년 11월",
    days: DAYS,
    weeks: LAYOUT.weeks,
    dayItems: LAYOUT.dayItems,
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

/** 라이트·다크 두 열로 그린다 */
export const Default: Story = { globals: { theme: "both" } };

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

/** 이번 달에 날짜가 있는 레코드가 없음 — 화면이 넣는 안내가 격자 위에 보인다 */
export const Empty: Story = {
  args: {
    weeks: layoutCalendar(DATES, []).weeks,
    dayItems: {},
    empty: (
      <p className="text-center text-ui text-secondary">이번 달에 날짜가 있는 레코드가 없어요.</p>
    ),
  },
};

/** 막대 모양 검증: 3칸 폭, 주 경계에서 두 조각(끝만 둥글게), 겹치는 막대는 다른 줄 */
export const Spans: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const weeks = Array.from(
      canvasElement.querySelectorAll<HTMLElement>('[data-slot="calendar-week"]'),
    );
    // 날짜 칸 경계: 주 안의 role=group 7개 (DOM 순서 = 요일 순서)
    const cellOf = (date: string) => {
      const idx = DATES.indexOf(date);
      const week = weeks[Math.floor(idx / 7)];
      const el = week?.querySelectorAll<HTMLElement>('[role="group"]')[idx % 7];
      if (!el) throw new Error(`no cell ${date}`);
      return el.getBoundingClientRect();
    };
    const barsNamed = (name: string) =>
      c.getAllByRole("button", { name: new RegExp(`^“${name}”`) }) as HTMLElement[];

    // 기획 초안: 11/10–11/12 → 3칸 폭
    const [plan] = barsNamed("기획 초안");
    const planCells = cellOf("2026-11-12").right - cellOf("2026-11-10").left;
    await expect(Math.abs(plan!.getBoundingClientRect().width - planCells)).toBeLessThan(
      planCells * 0.05,
    );

    // 릴리스 준비: 11/26–12/02는 두 주에 걸쳐 두 조각, 바깥 끝만 둥글다
    const [first, second] = barsNamed("릴리스 준비");
    await expect(barsNamed("릴리스 준비").length).toBe(2);
    const radius = (el: HTMLElement, side: "Left" | "Right") =>
      getComputedStyle(el).getPropertyValue(`border-top-${side.toLowerCase()}-radius`);
    await expect(parseFloat(radius(first!, "Left"))).toBeGreaterThan(0);
    await expect(parseFloat(radius(first!, "Right"))).toBe(0);
    await expect(parseFloat(radius(second!, "Left"))).toBe(0);
    await expect(parseFloat(radius(second!, "Right"))).toBeGreaterThan(0);

    // 겹치는 막대는 줄(top)이 달라야 한다
    const [qa] = barsNamed("디자인 QA");
    await expect(
      Math.abs(plan!.getBoundingClientRect().top - qa!.getBoundingClientRect().top),
    ).toBeGreaterThan(4);
  },
};
