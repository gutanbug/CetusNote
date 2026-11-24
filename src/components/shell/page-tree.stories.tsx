import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SAMPLE_PAGES } from "@/debug/shell-data";
import { RowMenu } from "@/debug/shell-sample";
import { PageTree, type PageNode, type PageTreeProps } from "./page-tree";

function Tree(props: Partial<PageTreeProps> & { initialExpanded?: string[] }) {
  const [expanded, setExpanded] = React.useState(props.initialExpanded ?? ["work"]);
  const [active, setActive] = React.useState(props.activeId ?? "roadmap");
  return (
    <div className="w-60 bg-sidebar p-2">
      <PageTree
        pages={SAMPLE_PAGES}
        expanded={expanded}
        onExpandedChange={setExpanded}
        activeId={active}
        onOpen={setActive}
        onAddChild={() => {}}
        rowMenu={(node) => <RowMenu node={node} />}
        {...props}
      />
    </div>
  );
}

/**
 * 페이지 트리 — 중첩, 키보드 탐색(↑↓ ← → Home End Enter), Shift+F10 행 메뉴.
 * 트리 안에서 Tab 순서에 있는 행은 하나다.
 */
const meta = {
  title: "L3 셸/SH-PageTree",
  component: Tree,
} satisfies Meta<typeof Tree>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 모두 펼침 */
export const AllExpanded: Story = {
  args: { initialExpanded: ["work", "meetings", "study"], activeId: "m-1118" },
};

/** 키보드 탐색 */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const row = (name: RegExp | string) => c.getByRole("treeitem", { name });
    row("2027 상반기 로드맵").focus();
    await userEvent.keyboard("{ArrowUp}");
    await expect(row("회의록")).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(row("회의록")).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{ArrowRight}");
    await expect(row("11월 18일 주간 회의")).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(row("회의록")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(row("회의록")).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{End}");
    await expect(row(/제주 여행/)).toHaveFocus();
  },
};

/** 글자로 행 찾기 — 제목 앞 글자나 한글 초성. 같은 글자를 거듭 치면 다음 행으로 돈다 */
export const Typeahead: Story = {
  args: { initialExpanded: [] },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const row = (name: RegExp | string) => c.getByRole("treeitem", { name });
    const pause = () => new Promise((r) => setTimeout(r, 600));
    row("업무").focus();
    await userEvent.keyboard("ㅈ");
    await expect(row(/제주 여행/)).toHaveFocus();
    await pause();
    await userEvent.keyboard("공");
    await expect(row("공부")).toHaveFocus();
    await pause();
    await userEvent.keyboard("ㅇ");
    await expect(row("읽고 싶은 책")).toHaveFocus();
    await userEvent.keyboard("ㅇ");
    await expect(row("업무")).toHaveFocus();
  },
};

/** 행 메뉴 — Shift+F10으로 열고 닫으면 행으로 돌아온다 */
export const RowMenuKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole("treeitem", { name: "읽고 싶은 책" });
    row.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    const menu = await within(document.body).findByRole("menu");
    await waitFor(() => expect(menu).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(row).toHaveFocus());
  },
};

/** 우클릭(SHELL-18): 행 메뉴가 열리고, 닫히면 행으로 돌아간다 */
export const RowMenuContextClick: Story = {
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole("treeitem", { name: "읽고 싶은 책" });
    fireEvent.contextMenu(row);
    const menu = await within(document.body).findByRole("menu");
    await waitFor(() => expect(menu).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(row).toHaveFocus());
  },
};

/** 폴더(SHELL-14) — 이름을 누르면 펼치고 접는다(열리지 않음). 문서는 이름을 누르면 열리고 펼침은 화살표로만 */
export const Folders: Story = {
  args: { initialExpanded: [] },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const row = (name: RegExp | string) => c.getByRole("treeitem", { name });
    await userEvent.click(row("업무"));
    await expect(row("업무")).toHaveAttribute("aria-expanded", "true");
    await expect(row("업무")).toHaveAttribute("aria-selected", "false");
    await userEvent.click(row("업무"));
    await expect(row("업무")).toHaveAttribute("aria-expanded", "false");
    // 키보드: 폴더에서 Enter → 펼침
    row("공부").focus();
    await userEvent.keyboard("{Enter}");
    await expect(row("공부")).toHaveAttribute("aria-expanded", "true");
    // 문서는 이름을 눌러도 펼치지 않고 연다
    await userEvent.click(row("업무"));
    await userEvent.click(row("회의록"));
    await expect(row("회의록")).toHaveAttribute("aria-selected", "true");
    await expect(row("회의록")).toHaveAttribute("aria-expanded", "false");
  },
};

/** 행의 ＋ 메뉴 — 섹션 ＋와 같다. 문서 아래에는 폴더를 둘 수 없어 새 폴더가 꺼진다 */
export const AddMenu: Story = {
  args: {
    initialExpanded: ["work"],
    addMenu: (node) => (
      <>
        <DropdownMenuItem>새 페이지</DropdownMenuItem>
        <DropdownMenuItem disabled={node.kind !== "folder"}>새 폴더</DropdownMenuItem>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "업무에 추가" }));
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("menuitem", { name: "새 폴더" })).not.toHaveAttribute("aria-disabled"),
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(c.getByRole("button", { name: "회의록에 추가" }));
    await waitFor(() =>
      expect(body.getByRole("menuitem", { name: "새 폴더" })).toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
    await userEvent.keyboard("{Escape}");
  },
};

/** 끌어다 놓을 자리 (SHELL-06) — 앞(위 선) · 뒤(아래 선) · 안쪽(테두리). 끄는 행은 반투명 */
export const DropTargets: Story = {
  // 끄는 행의 반투명은 끄는 동안만 보이는 상태라 대비 규칙에서 뺀다(SH-SidebarItem Dragging과 같다)
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Tree draggingId="reading" dropTarget={{ id: "roadmap", position: "before" }} />
      <Tree draggingId="reading" dropTarget={{ id: "roadmap", position: "after" }} />
      <Tree draggingId="reading" dropTarget={{ id: "study", position: "inside" }} />
    </div>
  ),
};

/** 끌어다 놓기: 위쪽 가장자리면 앞, 가운데면 안쪽. 놓을 수 없는 곳(문서 안의 폴더)은 표시하지 않는다 */
export const DragAndDrop: Story = {
  args: {
    onDrop: fn(),
    canDrop: (id, target, position) =>
      !(id === "study" && position === "inside" && target !== "work"),
  },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const row = (name: string) => c.getByRole("treeitem", { name });
    const dt = new DataTransfer();
    const at = (el: HTMLElement, ratio: number) => {
      const r = el.getBoundingClientRect();
      return { dataTransfer: dt, clientX: r.left + 20, clientY: r.top + r.height * ratio };
    };
    const reading = row("읽고 싶은 책");
    fireEvent.dragStart(reading, { dataTransfer: dt });
    await waitFor(() => expect(reading).toHaveAttribute("data-drag", "true"));

    const roadmap = row("2027 상반기 로드맵");
    fireEvent.dragOver(roadmap, at(roadmap, 0.1));
    await waitFor(() =>
      expect(roadmap.querySelector("[data-slot=drop-indicator]")).toHaveAttribute(
        "data-position",
        "before",
      ),
    );
    fireEvent.dragOver(roadmap, at(roadmap, 0.5));
    await waitFor(() =>
      expect(roadmap.querySelector("[data-slot=drop-indicator]")).toHaveAttribute(
        "data-position",
        "inside",
      ),
    );
    fireEvent.drop(roadmap, at(roadmap, 0.5));
    await expect(args.onDrop).toHaveBeenCalledWith("reading", "roadmap", "inside");
    fireEvent.dragEnd(reading, { dataTransfer: dt });
    await waitFor(() =>
      expect(canvasElement.querySelector("[data-slot=drop-indicator]")).toBeNull(),
    );

    // 폴더를 문서 안쪽에는 못 넣는다 → 가까운 가장자리(뒤)로
    const study = row("공부");
    fireEvent.dragStart(study, { dataTransfer: dt });
    const travel = row("제주 여행 준비물 — 3박 4일, 렌터카, 우천 대비");
    fireEvent.dragOver(travel, at(travel, 0.6));
    await waitFor(() =>
      expect(travel.querySelector("[data-slot=drop-indicator]")).toHaveAttribute(
        "data-position",
        "after",
      ),
    );
    fireEvent.dragEnd(study, { dataTransfer: dt });
  },
};

/** 페이지 5000개(폴더 100개 × 49문서 + 폴더) — 모두 펼쳐도 DOM에는 보이는 행과 포커스 행만 둔다 (SYS-10) */
const MANY_FOLDERS: PageNode[] = Array.from({ length: 100 }, (_, f) => ({
  id: `f${f}`,
  title: `프로젝트 ${f + 1}`,
  kind: "folder" as const,
  children: Array.from({ length: 49 }, (_, i) => ({
    id: `f${f}-${i}`,
    title: `문서 ${f + 1}-${i + 1}`,
  })),
}));
const MANY_IDS = MANY_FOLDERS.map((f) => f.id);

/**
 * 많은 페이지 — 트리 높이를 고정해 스크롤 영역으로 만든다. 행은 보이는 만큼만 DOM에 있고,
 * 구간 밖으로 간 포커스 행도 남아 있으며, aria-setsize는 실제 형제 수다.
 */
export const ManyPages: Story = {
  args: { pages: MANY_FOLDERS, initialExpanded: MANY_IDS, activeId: "f0-0", className: "h-96" },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const tree = c.getByRole("tree");
    await waitFor(() =>
      expect(tree.querySelectorAll('[role="treeitem"]').length).toBeGreaterThan(0),
    );
    // 5100행 중 DOM에 있는 행은 100개 미만
    await expect(tree.querySelectorAll('[role="treeitem"]').length).toBeLessThan(100);
    await expect(c.getByRole("treeitem", { name: "문서 1-1" })).toHaveAttribute(
      "aria-setsize",
      "49",
    );
    // 맨 아래로 가도 그 행은 포커스를 잃지 않는다
    c.getByRole("treeitem", { name: "프로젝트 1" }).focus();
    await userEvent.keyboard("{End}");
    await expect(c.getByRole("treeitem", { name: "문서 100-49" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(c.getByRole("treeitem", { name: "프로젝트 1" })).toHaveFocus();
  },
};

/**
 * 행 메뉴를 연 채 멀리 스크롤해도(행이 구간 밖으로 밀려도) Esc로 닫으면 포커스는 그 행으로 돌아간다(SH-PageTree).
 */
export const RowMenuScrollAway: Story = {
  args: { pages: MANY_FOLDERS, initialExpanded: MANY_IDS, activeId: "f0-0", className: "h-96" },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const tree = c.getByRole("tree");
    const row = c.getByRole("treeitem", { name: "문서 1-1" });
    // 우클릭은 행에 포커스를 주지 않는다 — 그래도 메뉴가 열린 동안 행은 남아 있어야 한다
    fireEvent.contextMenu(row);
    await waitFor(() => expect(within(document.body).getByRole("menu")).toBeVisible());
    tree.scrollTop = tree.scrollHeight;
    tree.dispatchEvent(new Event("scroll"));
    await waitFor(() => expect(tree.scrollTop).toBeGreaterThan(1000));
    const scrolled = tree.scrollTop;
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(c.getByRole("treeitem", { name: "문서 1-1" })).toHaveFocus());
    // 포커스를 돌려주려고 목록을 맨 위로 되감지 않는다
    expect(tree.scrollTop).toBe(scrolled);
  },
};
