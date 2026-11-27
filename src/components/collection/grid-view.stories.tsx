import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { GridView, type GridViewProps } from "./grid-view";
import { AddPropertyMenu, PropertyMenu, PropertyValueCell } from "./property";
import { SAMPLE_ASSIGNEES, SAMPLE_ENTRIES, SAMPLE_PROPERTIES, SAMPLE_RECORDS } from "./sample";
import type { RecordItem } from "./fields";
import { IconButton } from "@/components/ui/icon-button";
import { Plus } from "lucide-react";

/** 화면(컬렉션 뷰)이 넣는 빈 상태 안내 견본 */
const EMPTY_NOTE = (
  <div className="grid justify-items-center gap-3 text-center">
    <p className="text-ui text-secondary">조건에 맞는 레코드가 없어요.</p>
    <Button variant="secondary" size="sm">
      필터와 검색 풀기
    </Button>
  </div>
);

function Live(args: GridViewProps) {
  const [items, setItems] = React.useState(args.items);
  const patch = (id: string, p: Partial<(typeof items)[number]>) =>
    setItems((list) => list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  return (
    <GridView
      {...args}
      items={items}
      onStatusChange={(id, status) => {
        args.onStatusChange(id, status);
        patch(id, { status });
      }}
      onAssigneeChange={(id, assignee) => patch(id, { assignee })}
      onStartChange={(id, date) =>
        patch(id, {
          start: date ? { date, text: date.slice(5).replace("-", "/"), late: false } : undefined,
        })
      }
      onDueChange={(id, date) =>
        patch(id, {
          due: date ? { date, text: date.slice(5).replace("-", "/"), late: false } : undefined,
        })
      }
    />
  );
}

/** 표 뷰 — 행 36px, 값 칸은 눌러서 팝오버로 고친다 (COLL-02) */
const meta = {
  title: "L6 컬렉션/CL-GridView",
  component: GridView,
  render: (args) => <Live {...args} />,
  args: {
    items: SAMPLE_RECORDS,
    onOpen: fn(),
    onOpenPage: fn(),
    onStatusChange: fn(),
    onAssigneeChange: fn(),
    onDueChange: fn(),
    onStartChange: fn(),
    assigneeChoices: SAMPLE_ASSIGNEES,
    onNew: fn(),
  },
  decorators: [(Story) => <div className="w-220 bg-app p-6">{Story()}</div>],
} satisfies Meta<typeof GridView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 행 hover 강제 — "페이지로 열기"가 드러난다 */
export const Hover: Story = {
  decorators: [(Story) => <div data-force="hover">{Story()}</div>],
};

export const Empty: Story = {
  args: { items: [], empty: EMPTY_NOTE },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("조건에 맞는 레코드가 없어요.")).toBeVisible();
  },
};

/** 레코드 n개 견본 — 큰 목록 스토리용 (SYS-11) */
function manyItems(n: number): RecordItem[] {
  const statuses = ["할 일", "진행 중", "검토", "완료"] as const;
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    title: `레코드 ${i + 1} 회의록`,
    status: statuses[i % 4],
    statusColor: "gray" as const,
    assignee: SAMPLE_ASSIGNEES[i % SAMPLE_ASSIGNEES.length],
    due: { date: "2026-11-24", text: "11월 24일", late: false },
    tags: [{ name: "회의", color: "blue" as const }],
  }));
}

const tenThousand = manyItems(10_000);

const titled = (title: (i: number) => string): RecordItem[] =>
  Array.from({ length: 4 }, (_, i) => ({
    id: `tw${i}`,
    title: title(i),
    status: "할 일",
    statusColor: "gray" as const,
    assignee: SAMPLE_ASSIGNEES[0],
    due: { date: "2026-11-27", text: "11월 27일", late: false },
    tags: [{ name: "회의", color: "blue" as const }],
  }));
const SHORT_TITLES = titled((i) => `짧은 ${i + 1}`);
const LONG_TITLES = titled(
  (i) => `아주 긴 제목 ${i + 1} `.repeat(12) + "끝 — 열 너비는 제목 길이와 상관없다",
);

/**
 * 제목 열 너비는 긴 제목에도 짧은 제목에도 같다 (표 고정 너비). 긴 제목은 말줄임되고 전체는 title 속성에 있다.
 */
export const TitleColumnWidth: Story = {
  args: { items: [] },
  render: (args) => (
    <div className="grid w-220 gap-6">
      <GridView {...args} items={SHORT_TITLES} />
      <GridView {...args} items={LONG_TITLES} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const tables = canvasElement.querySelectorAll<HTMLTableElement>('table[role="grid"]');
    await expect(tables).toHaveLength(2);
    const [short, long] = [...tables].map((t) =>
      [...t.querySelectorAll<HTMLElement>("thead th")].map(
        (th) => th.getBoundingClientRect().width,
      ),
    );
    await expect(short[0]).toBeGreaterThan(200);
    // 모든 열의 너비가 두 표에서 같다 (제목 열뿐 아니라 뒤 열도 밀리지 않는다)
    await expect(short).toHaveLength(long.length);
    short.forEach((w, i) => expect(Math.abs(w - long[i]!)).toBeLessThan(1));
    const longTitle = tables[1]!.querySelector<HTMLElement>('td[data-col="0"] span[title]');
    await expect(longTitle).not.toBeNull();
    await expect(longTitle!.scrollWidth).toBeGreaterThan(longTitle!.clientWidth);
    await expect(longTitle).toHaveAttribute("title", expect.stringContaining("끝"));
  },
};

/**
 * 고정 칸 (COLL-02): 제목 뒤 앞 두 칸(상태·담당)을 왼쪽에 붙인다. 가로로 끝까지 밀어도 고정 칸은 제자리에 쌓이고, 그 뒤 칸은 밀려 나간다.
 */
export const PinnedColumns: Story = {
  args: { items: SHORT_TITLES, pinned: 2 },
  render: (args) => (
    <div className="w-120">
      <GridView {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<HTMLTableElement>('table[role="grid"]');
    await expect(table).not.toBeNull();
    const scroller = table!.parentElement!;
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    scroller.scrollLeft = 200;
    const heads = [...table!.querySelectorAll<HTMLElement>("thead th")];
    const inner = scroller.getBoundingClientRect().left + scroller.clientLeft;
    const rect = (i: number) => heads[i]!.getBoundingClientRect();
    // 제목 → 상태 → 담당 순으로 앞 칸 너비만큼 밀려 붙는다
    await expect(Math.abs(rect(0).left - inner)).toBeLessThan(2);
    await expect(Math.abs(rect(1).left - inner - rect(0).width)).toBeLessThan(2);
    await expect(Math.abs(rect(2).left - inner - rect(0).width - rect(1).width)).toBeLessThan(2);
    // 고정하지 않은 칸에는 왼쪽 위치를 주지 않는다
    await expect(heads[3]!.style.left).toBe("");
    await expect(heads[2]!.style.left).not.toBe("");
  },
};

/**
 * 1만 행: 화면에 보이는 행과 여유 행만 DOM에 그린다. aria-rowcount는 전체 수, 키보드로 멀리 내려가면 따라간다 (SYS-11)
 */
export const TenThousandRows: Story = {
  // 큰 데이터는 args로 두지 않는다 — 테스트 채널의 메시지 크기를 넘는다
  args: { items: [] },
  render: (args) => <Live {...args} items={tenThousand} />,
  play: async ({ canvasElement, args }) => {
    const table = canvasElement.querySelector<HTMLTableElement>('table[role="grid"]');
    if (!table) throw new Error("grid table not found");
    await expect(table).toHaveAttribute("aria-rowcount", "10001");
    const drawn = table.querySelectorAll('tbody tr[role="row"]').length;
    await expect(drawn).toBeLessThan(80);
    const first = table.querySelector<HTMLElement>('td[data-row="0"][data-col="0"] button');
    first?.focus();
    for (let i = 0; i < 120; i++) await userEvent.keyboard("{ArrowDown}");
    await waitFor(async () => {
      // 셀의 키보드 대상은 셀 안 첫 버튼이다 (focusOf)
      const cell = canvasElement.querySelector<HTMLElement>('td[data-row="120"][data-col="0"]');
      await expect(cell?.querySelector("button")).toHaveFocus();
    });
    await expect(args.onOpen).not.toHaveBeenCalled();
  },
};

/** 키보드: 제목으로 상세를 열고, 상태 칸 메뉴에서 값을 고른다 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    c.getByRole("button", { name: "스프린트 리뷰 준비" }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpen).toHaveBeenCalledWith("r1", expect.anything());
    await userEvent.click(c.getByRole("button", { name: /온보딩 문서 개편 상태/ }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("menuitemradio", { name: "완료" }));
    await expect(args.onStatusChange).toHaveBeenCalledWith("r2", "완료");
  },
};

/** 상태 다시 고르기: 이미 고른 상태를 한 번 더 고르면 비운다 (값이 되돌아오지 않는다) */
export const StatusReselect: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(c.getByRole("button", { name: /온보딩 문서 개편 상태/ }));
    await userEvent.click(await body.findByRole("menuitemradio", { name: "검토" }));
    await expect(args.onStatusChange).toHaveBeenLastCalledWith("r2", undefined);
    await expect(
      c.getByRole("button", { name: /온보딩 문서 개편 상태/ }).textContent,
    ).not.toContain("검토");
  },
};

/** 셀 이동 (role=grid): 화살표로 셀을 옮기고, Enter로 값 칸 메뉴를 열고, Esc로 메뉴를 닫으면 같은 셀로 돌아온다 */
export const ArrowKeys: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("grid", { name: "레코드 표" })).toBeInTheDocument();
    const first = c.getByRole("button", { name: "스프린트 리뷰 준비" });
    first.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(c.getByRole("button", { name: "온보딩 문서 개편" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    const status = c.getByRole("button", { name: /온보딩 문서 개편 상태/ });
    await expect(status).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole("menuitemradio", { name: "완료" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(status).toHaveFocus());
    await userEvent.keyboard("{Home}");
    await expect(c.getByRole("button", { name: "온보딩 문서 개편" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    await expect(c.getByRole("button", { name: "스프린트 리뷰 준비" })).toHaveFocus();
    // Ctrl+End: 표의 오른쪽 아래 셀 (마지막 행, 마지막 열)
    await userEvent.keyboard("{Control>}{End}{/Control}");
    const focused = canvasElement.ownerDocument.activeElement?.closest("td");
    await expect(focused?.closest("tr")?.getAttribute("aria-rowindex")).toBe(
      String(SAMPLE_RECORDS.length + 1),
    );
    // 고정 열 6개(제목·상태·담당·시작·마감·태그)의 마지막 열
    await expect(focused?.getAttribute("aria-colindex")).toBe("6");
  },
};

const VALUES: Record<string, Record<string, string | number | boolean | string[]>> = {
  r1: { fbudget01: 1200000, fstage001: "검토 중", fteam0001: ["디자인", "개발"], fcheck001: true },
  r2: { fbudget01: 300000, fstage001: "초안", flink0001: "cetus.example/onboarding" },
  r3: { fstage001: "확정", fteam0001: ["운영"] },
};

/** 사용자 속성 열 (COLL-08) — 머리를 누르면 속성 메뉴, 맨 끝 ＋로 속성 추가. 메모는 숨김 */
export const CustomColumns: Story = {
  args: {
    columns: SAMPLE_ENTRIES.filter((e) => !e.hidden).map((e) => {
      const def = SAMPLE_PROPERTIES.find((p) => p.id === e.key);
      return {
        key: e.key,
        name: e.name,
        kind: e.kind,
        menu: (trigger: React.ReactElement) => (
          <PropertyMenu
            entry={e}
            options={def?.options}
            onToggleHidden={fn()}
            onToggleCard={fn()}
            onMove={fn()}
            onRenameOption={fn()}
            onDeleteOption={fn()}
          >
            {trigger}
          </PropertyMenu>
        ),
        cell: def
          ? (item: { id: string }) => (
              <PropertyValueCell
                field={def}
                value={VALUES[item.id]?.[def.id] ?? null}
                onChange={fn()}
              />
            )
          : undefined,
      };
    }),
    addColumn: (
      <AddPropertyMenu onAdd={fn()} align="end">
        <IconButton label="속성 추가">
          <Plus strokeWidth={1.5} />
        </IconButton>
      </AddPropertyMenu>
    ),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("columnheader", { name: /단계/ })).toBeInTheDocument();
    await expect(c.queryByRole("columnheader", { name: /메모/ })).toBeNull();
    await userEvent.click(c.getByRole("button", { name: "단계 속성 메뉴" }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole("textbox", { name: "옵션 이름: 초안" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
  },
};

/** 열 너비 상태를 들고 있는 견본 — 바뀐 너비가 화면에 남는다 (COLL-02) */
function WidthLive(args: GridViewProps) {
  const [widths, setWidths] = React.useState<Record<string, number>>(args.widths ?? {});
  return (
    <GridView
      {...args}
      widths={widths}
      onWidthsChange={(next) => {
        args.onWidthsChange?.(next);
        setWidths(next);
      }}
    />
  );
}

const widthHandle = (root: HTMLElement, name: string) =>
  within(root).getByRole("separator", { name: `“${name}” 칸 너비` });
const firePointer = (el: HTMLElement, type: string, clientX: number) =>
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX }));

/**
 * 열 너비 조절 (COLL-02): 끌면 미리 보고 손을 뗄 때 한 번 저장한다. ←/→는 한 칸씩, 더블클릭은 기본 너비로.
 */
export const ResizeColumns: Story = {
  args: { widths: {}, onWidthsChange: fn() },
  render: (args) => <WidthLive {...args} />,
  play: async ({ canvasElement, args }) => {
    const saves = args.onWidthsChange as unknown as ReturnType<typeof fn>;
    const handle = widthHandle(canvasElement, "상태");
    const th = handle.closest("th")!;
    const startW = th.getBoundingClientRect().width;
    const box = handle.getBoundingClientRect();
    const x0 = box.left + box.width / 2;
    // 끄는 동안: 미리 보기만 바뀌고 저장은 아직
    firePointer(handle, "pointerdown", x0);
    firePointer(handle, "pointermove", x0 + 40);
    await waitFor(() => expect(th.getBoundingClientRect().width).toBeCloseTo(startW + 40, 0));
    await expect(args.onWidthsChange).not.toHaveBeenCalled();
    // 손을 떼면 한 번 저장
    firePointer(handle, "pointerup", x0 + 40);
    await expect(args.onWidthsChange).toHaveBeenCalledTimes(1);
    const dragged = saves.mock.calls[0]?.[0] as Record<string, number>;
    await expect(Math.abs((dragged.status ?? 0) - (startW + 40))).toBeLessThanOrEqual(1);
    // ←/→는 한 칸(16px)씩
    handle.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(args.onWidthsChange).toHaveBeenCalledTimes(2);
    await expect(handle).toHaveAttribute("aria-valuenow", String((dragged.status ?? 0) + 16));
    // 더블클릭은 기본 너비(키 제거)
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await expect(args.onWidthsChange).toHaveBeenCalledTimes(3);
    const reset = saves.mock.calls[2]?.[0] as Record<string, number>;
    await expect(reset).not.toHaveProperty("status");
    await expect(handle).toHaveAttribute("aria-valuenow", "160");
  },
};

const LINK_ENTRY = SAMPLE_ENTRIES.find((e) => e.key === "flink0001")!;
const LINK_DEF = SAMPLE_PROPERTIES.find((p) => p.id === "flink0001")!;
const LONG_URL = `https://cetus.example/docs/${"very-long-segment-".repeat(12)}end`;

/** 긴 URL 칸은 열 안에서 잘린다 — 칸 밖으로 넘치지 않고, 전체 값은 title 속성에 있다 (COLL-02) */
export const LongValueClipped: Story = {
  args: {
    columns: [
      {
        key: "flink0001",
        name: LINK_ENTRY.name,
        kind: LINK_ENTRY.kind,
        cell: () => <PropertyValueCell field={LINK_DEF} value={LONG_URL} onChange={fn()} />,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const td = canvasElement.querySelector<HTMLElement>('tbody td[data-row="0"][data-col="1"]')!;
    const btn = td.querySelector<HTMLElement>("button")!;
    const value = btn.querySelector<HTMLElement>("span[title]")!;
    await expect(value).toHaveAttribute("title", LONG_URL);
    const cellRight = td.getBoundingClientRect().right;
    await expect(btn.getBoundingClientRect().right).toBeLessThanOrEqual(cellRight + 0.5);
    await expect(value.getBoundingClientRect().right).toBeLessThanOrEqual(cellRight + 0.5);
    await expect(value.scrollWidth).toBeGreaterThan(value.clientWidth);
  },
};
