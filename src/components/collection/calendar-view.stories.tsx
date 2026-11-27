import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { layoutCalendar, type CalendarSpanInput } from "@/features/collection/calendar-span";
import { weekDates } from "@/features/collection/calendar-range";
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
    onModeChange: fn(),
    onReschedule: fn(),
    onCreateRange: fn(),
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

/** 끌어서 옮기기: 막대 가운데를 잡고 2칸 오른쪽 칸으로 끈다 → 기간 전체가 2일 옮겨진다 */
export const MoveDrag: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const [plan] = c.getAllByRole("button", { name: /^“기획 초안”/ }) as HTMLElement[];
    const r = plan!.getBoundingClientRect();
    const cell = canvasElement.querySelector<HTMLElement>('[data-date="2026-11-13"]')!;
    const cr = cell.getBoundingClientRect();
    await userEvent.pointer([
      {
        keys: "[MouseLeft>]",
        target: plan,
        coords: { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 },
      },
      {
        target: cell,
        coords: { clientX: cr.left + cr.width / 2, clientY: cr.top + cr.height / 2 },
      },
      { keys: "[/MouseLeft]", target: cell },
    ]);
    // 잡은 칸은 가운데 칸(11/11) → 11/13으로 끌었으니 2일
    await expect(args.onReschedule).toHaveBeenCalledWith("plan", { kind: "move", days: 2 });
    await expect(args.onOpen).not.toHaveBeenCalled();
  },
};

/** 가장자리 늘이기: 디자인 QA의 오른쪽 손잡이를 11/16까지 끌면 마감만 바뀐다 */
export const EdgeResize: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const [qa] = c.getAllByRole("button", { name: /^“디자인 QA”/ }) as HTMLElement[];
    const handle = qa!.querySelector<HTMLElement>('[data-handle="due"]')!;
    const hr = handle.getBoundingClientRect();
    const cell = canvasElement.querySelector<HTMLElement>('[data-date="2026-11-16"]')!;
    const cr = cell.getBoundingClientRect();
    await userEvent.pointer([
      {
        keys: "[MouseLeft>]",
        target: handle,
        coords: { clientX: hr.left + hr.width / 2, clientY: hr.top + hr.height / 2 },
      },
      {
        target: cell,
        coords: { clientX: cr.left + cr.width / 2, clientY: cr.top + cr.height / 2 },
      },
      { keys: "[/MouseLeft]", target: cell },
    ]);
    await expect(args.onReschedule).toHaveBeenCalledWith("qa", { kind: "due", date: "2026-11-16" });
  },
};

/** 빈 날 끌어 만들기: 11/17을 눌러 11/19에서 놓으면 그 범위로 새 레코드 */
export const CreateDrag: Story = {
  play: async ({ canvasElement, args }) => {
    const from = canvasElement.querySelector<HTMLElement>('[data-date="2026-11-17"]')!;
    const to = canvasElement.querySelector<HTMLElement>('[data-date="2026-11-19"]')!;
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    await userEvent.pointer([
      {
        keys: "[MouseLeft>]",
        target: from,
        coords: { clientX: a.left + a.width / 2, clientY: a.top + a.height / 2 },
      },
      { target: to, coords: { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 } },
      { keys: "[/MouseLeft]", target: to },
    ]);
    await expect(args.onCreateRange).toHaveBeenCalledWith({
      start: "2026-11-17",
      due: "2026-11-19",
    });
  },
};

/** 키보드: 막대에 포커스 → ⌥→ 는 하루 옮기고, ⌥⇧→ 는 마감을 하루 늘린다. 결과는 aria-live로 알린다 */
export const AltArrow: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const [plan] = c.getAllByRole("button", { name: /^“기획 초안”/ }) as HTMLElement[];
    plan!.focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await expect(args.onReschedule).toHaveBeenLastCalledWith("plan", { kind: "move", days: 1 });
    await userEvent.keyboard("{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}");
    await expect(args.onReschedule).toHaveBeenLastCalledWith("plan", {
      kind: "due",
      date: "2026-11-13",
    });
    const live = canvasElement.querySelector('[aria-live="polite"].sr-only');
    await expect(live?.textContent ?? "").toContain("기획 초안");
  },
};

/** 주 보기: 한 주 7칸, 키 막대는 그대로. 다음 주로 넘기면 상위에 알린다 */
export const Week: Story = {
  globals: { theme: "both" },
  args: {
    mode: "week",
    monthLabel: "11월 22일 – 11월 28일",
    days: weekDates("2026-11-22").map((date) => ({
      date,
      day: Number(date.slice(8)),
      today: date === "2026-11-20",
    })),
    weeks: layoutCalendar(weekDates("2026-11-22"), RECORDS, 5).weeks,
    dayItems: layoutCalendar(weekDates("2026-11-22"), RECORDS, 5).dayItems,
  },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    // 라이트·다크 두 열이므로 막대는 열마다 하나씩 (주 안 한 조각)
    await expect(c.getAllByRole("button", { name: /^“릴리스 준비”/ }).length).toBeGreaterThan(0);
    await userEvent.click(c.getAllByRole("button", { name: "다음 주" })[0]!);
    await expect(args.onNext).toHaveBeenCalled();
  },
};
