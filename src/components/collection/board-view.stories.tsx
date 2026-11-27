import type { Meta, StoryObj } from "@storybook/react-vite";
import { DEFAULT_STATUS_OPTIONS, type StatusOption } from "@/components/ui/status-chip";
import * as React from "react";
import { expect, fireEvent, fn, userEvent, within } from "storybook/test";
import {
  BOARD_PAGE,
  BoardView,
  Card,
  type BoardColumn,
  type BoardPlace,
  type BoardViewProps,
} from "./board-view";
import type { RecordItem } from "./fields";
import { SAMPLE_ASSIGNEES, SAMPLE_RECORDS } from "./sample";

/** 상태별 칸 — "상태 없음"은 레코드가 있을 때만 맨 앞에 */
const columnsOf = (items: RecordItem[], statuses: StatusOption[]): BoardColumn[] => {
  const none = items.filter((r) => !statuses.some((s) => s.name === r.status));
  return [
    ...(none.length
      ? [
          {
            key: "status:",
            label: "상태 없음",
            color: "gray" as const,
            items: none,
            none: true,
            calc: `${none.length}개`,
          },
        ]
      : []),
    ...statuses.map((s) => {
      const list = items.filter((r) => r.status === s.name);
      return {
        key: `status:${s.name}`,
        label: s.name,
        color: s.color,
        items: list,
        calc: `${list.length}개`,
        editable: true,
      };
    }),
  ];
};

function move(list: RecordItem[], id: string, status: string | undefined, place: BoardPlace) {
  const item = { ...list.find((r) => r.id === id)!, status };
  const rest = list.filter((r) => r.id !== id);
  const at = place.beforeId
    ? rest.findIndex((r) => r.id === place.beforeId)
    : place.afterId
      ? rest.findIndex((r) => r.id === place.afterId) + 1
      : rest.length;
  rest.splice(at < 0 ? rest.length : at, 0, item);
  return rest;
}

function Live(args: BoardViewProps) {
  const [items, setItems] = React.useState(() => args.columns.flatMap((c) => c.items));
  const [statuses, setStatuses] = React.useState(DEFAULT_STATUS_OPTIONS);
  const [hidden, setHidden] = React.useState<string[]>([]);
  const all = columnsOf(items, statuses);
  return (
    <BoardView
      {...args}
      columns={all.filter((c) => !hidden.includes(c.key))}
      hidden={all
        .filter((c) => hidden.includes(c.key))
        .map((c) => ({ key: c.key, label: c.label, color: c.color, count: c.items.length }))}
      onMove={(id, from, to, place) => {
        args.onMove(id, from, to, place);
        setItems((list) => move(list, id, to.slice(7) || undefined, place));
      }}
      onHideColumn={(key) => {
        args.onHideColumn?.(key);
        setHidden((h) => [...h, key]);
      }}
      onShowColumn={(key) => setHidden((h) => h.filter((k) => k !== key))}
      onAddColumn={() => setStatuses((s) => [...s, { name: "보류", color: "purple" }])}
      onRenameColumn={(key, name) => {
        args.onRenameColumn?.(key, name);
        setStatuses((s) => s.map((o) => (`status:${o.name}` === key ? { ...o, name } : o)));
        setItems((l) => l.map((r) => (`status:${r.status}` === key ? { ...r, status: name } : r)));
      }}
      onColorChange={(key, color) =>
        setStatuses((s) => s.map((o) => (`status:${o.name}` === key ? { ...o, color } : o)))
      }
    />
  );
}

/**
 * 보드 뷰 (COLL-03) — AppFlowy 보드처럼: 칸 색 바탕, 머리의 계산·＋·더 보기 메뉴,
 * 바닥의 "새 레코드", 끌 때 들어갈 자리 선, 칸 안 순서 바꾸기, 숨긴 칸.
 */
const meta = {
  title: "L6 컬렉션/CL-BoardView",
  component: BoardView,
  render: (args) => <Live {...args} />,
  args: {
    columns: columnsOf(SAMPLE_RECORDS, DEFAULT_STATUS_OPTIONS),
    onOpen: fn(),
    onOpenPage: fn(),
    onTrash: fn(),
    onMove: fn(),
    onNew: fn(),
    onHideColumn: fn(),
    onRenameColumn: fn(),
    onDeleteColumn: fn(),
    onMoveColumn: fn(),
    calc: "count",
    onCalcChange: fn(),
  },
  decorators: [(Story) => <div className="w-340 bg-app p-6">{Story()}</div>],
} satisfies Meta<typeof BoardView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 칸·카드 hover 강제 — 머리 ＋·메뉴와 카드 동작이 보인다 */
export const Hover: Story = {
  decorators: [(Story) => <div data-force="hover">{Story()}</div>],
};

/** 정렬이 걸려 칸 안 순서를 바꿀 수 없을 때 (칸 사이 옮기기만) */
export const Sorted: Story = { args: { reorderable: false } };

/** 키보드: Alt+→로 옆 칸, Alt+↑로 칸 안 위로. 포커스는 카드에 남는다 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const card = () => canvasElement.querySelector<HTMLElement>('[data-record="r4"]')!;
    card().focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await expect(args.onMove).toHaveBeenCalledWith(
      "r4",
      "status:할 일",
      "status:진행 중",
      expect.objectContaining({ afterId: "r1" }),
    );
    await expect(card()).toHaveFocus();
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await expect(args.onMove).toHaveBeenLastCalledWith("r4", "status:진행 중", "status:진행 중", {
      beforeId: "r1",
    });
    await expect(card()).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpen).toHaveBeenCalledWith("r4", expect.anything());
  },
};

/** 끌어서 놓기: 다른 칸에 떨어뜨리면 들어갈 자리에 카드가 흐리게 미리 보이고 상태가 바뀐다 */
export const DragAndDrop: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const card = canvasElement.querySelector<HTMLElement>('[data-record="r2"]')!;
    const done = c.getByRole("region", { name: /완료/ });
    const dataTransfer = new DataTransfer();
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(done, { dataTransfer, clientY: 9999 });
    await expect(done).toHaveAttribute("data-dropline", "true");
    await expect(done.querySelector('[data-slot="drop-preview"]')).not.toBeNull();
    // 원래 자리는 비우고(떠 있는 카드) 놓으면 끝난다
    await expect(card.closest("li")).toHaveAttribute("data-lifted", "true");
    fireEvent.drop(done, { dataTransfer, clientY: 9999 });
    await expect(args.onMove).toHaveBeenCalledWith(
      "r2",
      "status:검토",
      "status:완료",
      expect.objectContaining({ afterId: "r6" }),
    );
  },
};

/** 칸 메뉴: 숨기면 맨 끝 "숨긴 칸"에 남고, 누르면 다시 보인다 */
export const HideColumn: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "검토 칸 메뉴" }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("menuitem", { name: "숨기기" }));
    await expect(args.onHideColumn).toHaveBeenCalledWith("status:검토");
    const show = c.getByRole("button", { name: /검토 칸 보이기/ });
    await userEvent.click(show);
    await expect(c.getByRole("region", { name: /검토/ })).toBeInTheDocument();
  },
};

/** 칸 메뉴: 이름 바꾸기 — 입력에서 Enter */
export const RenameColumn: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "검토 칸 메뉴" }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("menuitem", { name: "이름 바꾸기" }));
    const input = await c.findByRole("textbox", { name: "칸 이름" });
    await userEvent.clear(input);
    await userEvent.type(input, "리뷰 대기{Enter}");
    await expect(args.onRenameColumn).toHaveBeenCalledWith("status:검토", "리뷰 대기");
  },
};

/** 끄는 중(멈춤): "진행 중" 칸 맨 위에 카드가 흐리게 미리 보이고, "검토" 칸의 원래 자리는 비어 있다 */
export const DropPreview: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const card = canvasElement.querySelector<HTMLElement>('[data-record="r2"]')!;
    const doing = c.getByRole("region", { name: /진행 중/ });
    const dataTransfer = new DataTransfer();
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(doing, { dataTransfer, clientY: 0 });
    const skeleton = doing.querySelector('[data-slot="drop-preview"]');
    await expect(skeleton).not.toBeNull();
    // 첫 카드 앞에 열린다
    await expect(skeleton?.nextElementSibling).toHaveAttribute("data-card", "r1");
    // 끄는 카드의 내용이 그대로 보인다
    await expect(skeleton).toHaveTextContent("온보딩 문서 개편");
  },
};

/** 카드 메뉴로 옮기기 — 끌기 대신. Alt+화살표와 같은 동작이고 단축키가 함께 보인다 */
export const CardMenuMove: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "온보딩 문서 개편 메뉴" }));
    const body = within(canvasElement.ownerDocument.body);
    const right = await body.findByRole("menuitem", { name: /오른쪽 칸으로/ });
    await expect(right).toHaveTextContent("⌥");
    await userEvent.click(right);
    await expect(args.onMove).toHaveBeenCalledWith(
      "r2",
      "status:검토",
      "status:완료",
      expect.objectContaining({ afterId: "r6" }),
    );
  },
};

/** 카드에 사용자 속성 (COLL-08) — 카드 표시를 켠 속성이 값이 있을 때 작게 */
const STAGES = [
  { name: "검토 중", color: "yellow" as const },
  { name: "초안", color: "gray" as const },
  { name: "확정", color: "green" as const },
];

export const CardProperties: Story = {
  args: {
    columns: columnsOf(
      SAMPLE_RECORDS.map((r, i) =>
        i < 3
          ? {
              ...r,
              extra: [
                {
                  key: "fstage001",
                  name: "단계",
                  text: STAGES[i]!.name,
                  chips: [STAGES[i]!],
                },
                { key: "fbudget01", name: "예산", text: ["1,200,000", "300,000", "80,000"][i]! },
              ],
            }
          : r,
      ),
      DEFAULT_STATUS_OPTIONS,
    ),
  },
};

/** 같은 칩 수의 카드 — 하나는 지남(긴 글자), 하나는 아니다. 속성 줄은 모두 한 줄이어야 한다 */
const META_CARD_LATE: RecordItem = {
  id: "meta-late",
  title: "온보딩 문서 개편",
  status: "할 일",
  statusColor: "gray",
  tags: [
    { name: "INNOGRID", color: "blue" },
    { name: "이슈", color: "red" },
  ],
  due: { date: "2026-10-02", text: "10월 2일", late: true },
};
const META_CARD_ON_TIME: RecordItem = {
  id: "meta-ok",
  title: "주간 회의 정리",
  status: "할 일",
  statusColor: "gray",
  tags: [
    { name: "INNOGRID", color: "blue" },
    { name: "작업", color: "green" },
  ],
  due: { date: "2026-11-27", text: "11월 27일", late: false },
};
const META_CARD_LONG: RecordItem = {
  id: "meta-long",
  title: "긴 태그와 담당이 함께 있는 카드",
  status: "할 일",
  statusColor: "gray",
  assignee: SAMPLE_ASSIGNEES[0],
  tags: [
    { name: "아주 긴 태그 이름의 칩입니다", color: "green" },
    { name: "INNOGRID", color: "blue" },
    { name: "이슈", color: "red" },
  ],
  due: { date: "2026-10-02", text: "10월 2일", late: true },
};
export const CardMetaOneLine: Story = {
  args: { columns: [] },
  render: () => (
    <div className="grid w-72 gap-3 bg-app p-6">
      <Card item={META_CARD_LATE} />
      <Card item={META_CARD_ON_TIME} />
      <Card item={META_CARD_LONG} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const cards = canvasElement.querySelectorAll<HTMLElement>('[data-slot="collection-card"]');
    await expect(cards).toHaveLength(3);
    const meta = [...cards].map((c) => c.querySelector<HTMLElement>(":scope > span.flex-nowrap"));
    const [late, onTime, long] = meta.map((el) => {
      if (!el) throw new Error("meta row not found");
      return el;
    });
    const h = (el: HTMLElement) => el.getBoundingClientRect().height;
    // 한 줄 높이(칩 22px)보다 작아야 한다 — 두 줄이면 약 48px
    await expect(h(late!)).toBeLessThan(30);
    await expect(h(onTime!)).toBeLessThan(30);
    await expect(h(long!)).toBeLessThan(30);
    // 지남이 있어도 같은 높이 (글자는 시각에서만 빠지고 스크린 리더에는 남는다)
    await expect(h(late!)).toBe(h(onTime!));
    await expect(cards[0]).toHaveTextContent("지남");
    await expect(cards[1]).not.toHaveTextContent("지남");
  },
};

const META_CARD_MANY: RecordItem = {
  id: "meta-many",
  title: "태그가 많은 카드",
  status: "할 일",
  statusColor: "gray",
  tags: [
    { name: "이슈", color: "red" },
    { name: "작업", color: "green" },
    { name: "INNOGRID", color: "blue" },
    { name: "회의", color: "purple" },
    { name: "디자인", color: "orange" },
    { name: "리뷰", color: "yellow" },
  ],
  due: { date: "2026-11-27", text: "11월 27일", late: false },
};
/** 좁은 카드 + 태그 많음 — 들어가지 않는 칩은 「+N」으로 접고 줄은 한 줄 */
export const CardMetaOverflow: Story = {
  args: { columns: [] },
  render: () => (
    <div className="grid w-56 gap-3 bg-app p-6">
      <Card item={META_CARD_MANY} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector<HTMLElement>('[data-slot="collection-card"]');
    const row = card?.querySelector<HTMLElement>(":scope > span.flex-nowrap");
    if (!card || !row) throw new Error("card or meta row not found");
    const more = card.querySelector<HTMLElement>('[data-slot="collection-card-more"]');
    await expect(more).toBeTruthy();
    await expect(more!.textContent).toMatch(/^\+\d+$/);
    await expect(more!.getAttribute("aria-label")).toMatch(/^외 \d+개: /);
    await expect(row.getBoundingClientRect().height).toBeLessThan(30);
  },
};

/** 넓은 카드 — 칩이 모두 들어가면 「+N」이 없다 */
export const CardMetaWide: Story = {
  args: { columns: [] },
  render: () => (
    <div className="grid w-340 gap-3 bg-app p-6">
      <Card item={META_CARD_ON_TIME} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector<HTMLElement>('[data-slot="collection-card"]');
    const row = card?.querySelector<HTMLElement>(":scope > span.flex-nowrap");
    if (!card || !row) throw new Error("card or meta row not found");
    await expect(card.querySelector('[data-slot="collection-card-more"]')).toBeNull();
    await expect(row.getBoundingClientRect().height).toBeLessThan(30);
  },
};

/** 레코드 1만 개 — 칸마다 카드는 BOARD_PAGE장까지만 그리고 「더 보기」로 늘린다 (SYS-11) */
const tenThousandColumns = columnsOf(
  Array.from({ length: 10_000 }, (_, i) => ({
    id: `b${i}`,
    title: `카드 ${i + 1}`,
    status: DEFAULT_STATUS_OPTIONS[i % DEFAULT_STATUS_OPTIONS.length]!.name,
    statusColor: "gray" as const,
    tags: [],
  })),
  DEFAULT_STATUS_OPTIONS,
);
export const TenThousandCards: Story = {
  // 큰 데이터는 args로 두지 않는다 — 테스트 채널의 메시지 크기를 넘는다
  args: { columns: [] },
  render: (args) => <Live {...args} columns={tenThousandColumns} />,
  play: async ({ canvasElement }) => {
    const cards = () => canvasElement.querySelectorAll("[data-card]").length;
    await expect(cards()).toBeLessThanOrEqual(4 * BOARD_PAGE);
    const more = within(canvasElement).getAllByRole("button", { name: /더 보기 · \d+개/ })[0]!;
    await userEvent.click(more);
    await expect(cards()).toBeGreaterThan(BOARD_PAGE);
  },
};
