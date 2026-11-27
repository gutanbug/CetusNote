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
