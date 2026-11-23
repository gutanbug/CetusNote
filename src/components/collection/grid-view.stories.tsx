import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { GridView, type GridViewProps } from "./grid-view";
import { AddPropertyMenu, PropertyMenu, PropertyValueCell } from "./property";
import { SAMPLE_ASSIGNEES, SAMPLE_ENTRIES, SAMPLE_PROPERTIES, SAMPLE_RECORDS } from "./sample";
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

/** 50행을 넘으면 "더 보기" */
export const More: Story = {
  args: {
    pageSize: 3,
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
    await expect(focused?.getAttribute("aria-colindex")).toBe("5");
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
