import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Toolbar, type FilterGroup, type OpenMode, type ToolbarProps } from "./toolbar";

const opts = (...names: string[]) => names.map((n) => ({ value: n, label: n }));
const GROUPS: FilterGroup[] = [
  { field: "status", name: "상태", values: opts("할 일", "진행 중", "검토", "완료") },
  { field: "assignee", name: "담당", values: opts("박세연", "이지후", "차민석") },
  { field: "tags", name: "태그", values: opts("기획", "문서", "회의") },
  { field: "fstage001", name: "단계", values: opts("초안", "확정") },
  {
    field: "fcheck001",
    name: "확인",
    values: [
      { value: "true", label: "체크됨" },
      { value: "false", label: "체크 안 됨" },
    ],
  },
];
const SORT_FIELDS = [
  { field: "title", name: "제목" },
  { field: "status", name: "상태" },
  { field: "assignee", name: "담당" },
  { field: "due", name: "마감" },
  { field: "tags", name: "태그" },
  { field: "fstage001", name: "단계" },
  { field: "updated", name: "수정일" },
];

function Live(args: ToolbarProps) {
  const [view, setView] = React.useState(args.view);
  const [filters, setFilters] = React.useState(args.filters);
  const [sort, setSort] = React.useState(args.sort);
  const [search, setSearch] = React.useState(args.search);
  const [mode, setMode] = React.useState<OpenMode | null>(args.openMode ?? null);
  const [def, setDef] = React.useState<OpenMode>(args.defaultOpenMode ?? "modal");
  return (
    <Toolbar
      {...args}
      view={view}
      onViewChange={setView}
      filters={filters}
      onToggleFilter={(f) =>
        setFilters((list) =>
          list.some((x) => x.field === f.field && x.value === f.value)
            ? list.filter((x) => !(x.field === f.field && x.value === f.value))
            : [...list, f],
        )
      }
      onClearFilters={() => setFilters([])}
      sort={sort}
      onSortChange={setSort}
      search={search}
      onSearchChange={setSearch}
      openMode={mode}
      onOpenModeChange={(m) => {
        args.onOpenModeChange?.(m);
        setMode(m);
      }}
      defaultOpenMode={def}
      onOpenModeDefault={(m) => {
        args.onOpenModeDefault?.(m);
        setDef(m);
        setMode(null);
      }}
    />
  );
}

/** 컬렉션 툴바 — 뷰 전환 · 필터 · 정렬 · 검색 · 개수 · 새 레코드 (COLL-01, COLL-06) */
const meta = {
  title: "L6 컬렉션/CL-Toolbar",
  component: Toolbar,
  render: (args) => <Live {...args} />,
  args: {
    view: "grid",
    onViewChange: fn(),
    filters: [],
    filterGroups: GROUPS,
    sortFields: SORT_FIELDS,
    openMode: null,
    defaultOpenMode: "modal",
    onOpenModeChange: fn(),
    onOpenModeDefault: fn(),
    onToggleFilter: fn(),
    onClearFilters: fn(),
    sort: null,
    onSortChange: fn(),
    search: "",
    onSearchChange: fn(),
    shown: 18,
    total: 18,
    onNew: fn(),
  },
  decorators: [(Story) => <div className="w-220 bg-app">{Story()}</div>],
} satisfies Meta<typeof Toolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 필터 2개 · 정렬 켜짐 · 검색 중 */
export const Active: Story = {
  args: {
    filters: [
      { field: "status", value: "진행 중" },
      { field: "assignee", value: "차민석" },
      { field: "fcheck001", value: "false" },
    ],
    sort: { field: "due", dir: "asc" },
    search: "회의",
    shown: 7,
    total: 18,
  },
};

/** 툴 hover 강제 */
export const Hover: Story = {
  decorators: [(Story) => <div data-force="hover">{Story()}</div>],
};

/** 키보드: 칩의 ×로 필터를 풀고, 검색에서 Esc로 비운다 */
export const Keyboard: Story = {
  args: { ...Active.args },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("button", { name: /필터 3/ })).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "필터 풀기: 담당: 차민석" }));
    await expect(c.queryByText("담당: 차민석")).not.toBeInTheDocument();
    const search = c.getByRole("searchbox", { name: "레코드 검색" });
    await userEvent.click(search);
    await userEvent.keyboard("{Escape}");
    await expect(search).toHaveValue("");
    await userEvent.click(c.getByRole("radio", { name: /보드/ }));
    await expect(c.getByRole("radio", { name: /보드/ })).toHaveAttribute("aria-checked", "true");
  },
};

/** 열기 방식 (COLL-07): 컬렉션마다 고르고, 고른 방식을 모든 컬렉션 기본값으로 */
export const OpenModeMenu: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = c.getByRole("button", { name: "열기 방식: 모달" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await expect(await body.findByRole("menuitemradio", { name: /기본값 따르기/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.click(body.getByRole("menuitemradio", { name: "사이드 패널" }));
    await expect(args.onOpenModeChange).toHaveBeenCalledWith("side");
    const side = c.getByRole("button", { name: "열기 방식: 사이드 패널" });
    side.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await body.findByRole("menuitem", { name: /모든 컬렉션 기본값으로/ }));
    await expect(args.onOpenModeDefault).toHaveBeenCalledWith("side");
    await expect(c.getByRole("button", { name: "열기 방식: 사이드 패널" })).toBeInTheDocument();
  },
};
