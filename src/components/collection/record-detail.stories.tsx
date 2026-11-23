import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ChecklistProgress, RecordDetail } from "./record-detail";
import { PropertyValueCell } from "./property";
import { SAMPLE_ASSIGNEES, SAMPLE_PROPERTIES, SAMPLE_RECORDS } from "./sample";

/** 레코드 상세 모달 — 페이지와 같은 에디터, 이전·다음 이동, 진행률 (COLL-05) */
const meta = {
  title: "L6 컬렉션/CL-RecordDetail",
  component: RecordDetail,
  args: {
    open: true,
    onOpenChange: fn(),
    item: SAMPLE_RECORDS[0]!,
    position: { index: 3, total: 18 },
    onPrev: fn(),
    onNext: fn(),
    onOpenPage: fn(),
    onTitleChange: fn(),
    onStatusChange: fn(),
    onAssigneeChange: fn(),
    onDueChange: fn(),
    assigneeChoices: SAMPLE_ASSIGNEES,
    progress: { done: 2, total: 4 },
    children: (
      <p className="text-body text-primary">
        리뷰 전에 데모 시나리오를 한 번 돌려 보고, 지난 스프린트 지표를 정리해 둔다.
      </p>
    ),
  },
  // Debug 화면: 모달은 화면 전체를 덮으므로 버튼으로 따로 띄운다
  parameters: { debug: { isolate: true } },
} satisfies Meta<typeof RecordDetail>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 빈 레코드 — 첫 레코드라 이전이 꺼져 있다 */
export const Empty: Story = {
  args: {
    item: SAMPLE_RECORDS[4]!,
    position: { index: 1, total: 18 },
    onPrev: undefined,
    progress: undefined,
    children: undefined,
  },
};

/** 진행률 0 · 50 · 100% */
export const Progress: Story = {
  render: () => (
    <div className="grid w-140 gap-2 bg-app p-6">
      <ChecklistProgress done={0} total={4} />
      <ChecklistProgress done={2} total={4} />
      <ChecklistProgress done={4} total={4} />
    </div>
  ),
};

/** 키보드: 다음 레코드, 담당 이름 적기, Esc로 닫기 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("button", { name: "다음 레코드" }));
    await expect(args.onNext).toHaveBeenCalled();
    await userEvent.click(body.getByRole("button", { name: /^담당:/ }));
    await userEvent.keyboard("김하늘{Enter}");
    await expect(args.onAssigneeChange).toHaveBeenCalledWith("김하늘");
    await userEvent.keyboard("{Escape}");
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

const rows = [
  { key: "status", name: "상태", kind: "status" as const },
  { key: "due", name: "마감", kind: "due" as const },
  ...SAMPLE_PROPERTIES.slice(0, 4).map((p) => ({
    key: p.id,
    name: p.name,
    kind: p.type,
    content: (
      <PropertyValueCell
        field={p}
        value={
          p.type === "number"
            ? 1200000
            : p.type === "checkbox"
              ? true
              : p.type === "multi"
                ? ["개발"]
                : "검토 중"
        }
        onChange={fn()}
        className="min-h-7.5 px-2"
      />
    ),
  })),
  { key: "tags", name: "태그", kind: "tags" as const },
];

/** 사용자 속성 행 (COLL-08) — 순서는 컬렉션 속성 순서, 담당은 숨김. 아래 "속성 추가" */
export const CustomRows: Story = {
  args: {
    rows,
    addProperty: (
      <button type="button" className="px-2 py-1 text-ui text-tertiary">
        ＋ 속성 추가
      </button>
    ),
  },
};

/** 사이드 패널 (COLL-07) — 오른쪽에 붙어 목록을 밀어낸다. Esc로 닫는다 */
export const Side: Story = {
  args: { variant: "side", rows },
  parameters: { debug: { isolate: false } },
  render: (args) => (
    <div className="flex h-160 w-260 bg-app">
      <div className="flex-1 p-6 text-ui text-secondary">표 · 보드 · 캘린더 자리</div>
      <div className="w-110 shrink-0">
        <RecordDetail {...args} className="h-full" />
      </div>
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const panel = c.getByRole("complementary", { name: /레코드:/ });
    // 열리면 포커스가 패널로 온다 — 표에서 Enter로 열어도 Esc로 닫힌다
    await expect(panel).toHaveFocus();
    c.getByRole("textbox", { name: "제목" }).focus();
    await userEvent.keyboard("{Escape}");
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};
