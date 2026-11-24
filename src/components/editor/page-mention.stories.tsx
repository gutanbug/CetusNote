import type { Meta, StoryObj } from "@storybook/react-vite";
import { NodeSelection } from "@tiptap/pm/state";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";
import { MentionMenu } from "./mention-menu";
import type { MentionSource, MentionTarget } from "./page-mention";

const PAGES: MentionTarget[] = [
  { id: "p-weekly", title: "주간 회의록 2026-11-19", icon: "📝" },
  { id: "p-tracker", title: "작업 트래커", icon: "🗃" },
  { id: "p-log", title: "CetusNote 개발 로그", icon: "🚀" },
  { id: "p-cq", title: "CSS Container Queries 정리", icon: null },
];

const source = (onOpen: (id: string) => void = fn()): MentionSource => ({
  search: (q) => PAGES.filter((p) => p.title.toLowerCase().includes(q.trim().toLowerCase())),
  resolve: (id) => PAGES.find((p) => p.id === id) ?? null,
  onOpen,
});

const mention = (id: string, label: string) =>
  `<a data-page-mention="${id}" href="cetusnote://page/${id}">${label}</a>`;

/**
 * 페이지 멘션 — `@`로 다른 페이지를 넣는다. 칩은 대상의 지금 제목·아이콘을 보이고, 누르면 그 페이지로 간다.
 * 대상이 지워지면 넣을 때의 제목을 흐리게 줄을 긋는다(깨진 링크).
 */
const meta = {
  title: "L4 에디터/ED-PageMention",
  component: MentionMenu,
  args: { items: PAGES, activeIndex: 0, query: "", onSelect: fn() },
  parameters: {
    a11y: { config: { rules: [{ id: "scrollable-region-focusable", enabled: false }] } },
  },
} satisfies Meta<typeof MentionMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 제안 목록 — 검색어가 없으면 최근 페이지 */
export const Menu: Story = {};

/** 검색 결과 없음 */
export const MenuEmpty: Story = { args: { items: [], query: "디자인 시스템" } };

/** 칩 — 아이콘 있음 · 아이콘 없음 · 깨진 링크(지워진 페이지). 제목은 대상의 지금 제목을 따른다 */
export const Chips: Story = {
  render: () => (
    <EditorSpecimen
      mentions={source()}
      content={`<p>이번 주부터 ${mention("p-tracker", "작업 트래커")}에 모아 관리해요.</p><p>관련 페이지: ${mention("p-log", "개발 로그(옛 제목)")} · ${mention("p-cq", "CSS Container Queries 정리")} · ${mention("p-gone", "지난 분기 회고")}</p>`}
    />
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(await c.findByText("CetusNote 개발 로그")).toBeVisible();
    await expect(c.getByLabelText("지난 분기 회고 (지워진 페이지)")).toBeVisible();
  },
};

/** 실제 쓰임 — `@회의`를 입력하고 Enter로 넣는다. 칩을 누르거나, 칩을 골라 Enter를 누르면 연다 */
export const InEditor: Story = {
  args: { onSelect: fn() },
  render: (args) => (
    <EditorSpecimen
      mentions={source(args.onSelect as (id: string) => void)}
      content="<p>회의 메모</p>"
    />
  ),
  play: async ({ canvasElement, args }) => {
    const editor = getEditor(canvasElement);
    editor.chain().focus("end").insertContent(" @회의").run();
    const list = await within(document.body).findByRole("listbox", { name: "페이지 멘션" });
    await expect(within(list).getByRole("option", { selected: true })).toHaveTextContent(
      "주간 회의록 2026-11-19",
    );
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(canvasElement.querySelector("[data-page-mention='p-weekly']")).not.toBeNull(),
    );
    await expect(within(document.body).queryByRole("listbox", { name: "페이지 멘션" })).toBeNull();
    // 저장 형식: { id, label }
    const json = JSON.stringify(editor.getJSON());
    await expect(json).toContain(
      '"type":"pageMention","attrs":{"id":"p-weekly","label":"주간 회의록 2026-11-19"}',
    );
    // 누르면 연다
    await userEvent.click(within(canvasElement).getByRole("link", { name: /주간 회의록/ }));
    await expect(args.onSelect).toHaveBeenCalledWith("p-weekly", { newTab: false });
    // 칩을 골라 Enter
    let at = -1;
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name === "pageMention") at = pos;
    });
    editor.commands.focus();
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, at)));
    await userEvent.keyboard("{Enter}");
    await expect(args.onSelect).toHaveBeenCalledTimes(2);
  },
};

/**
 * 화면 읽기 프로그램 연결 — 포커스는 편집기에 남고, ↓↑로 고르면 편집기의 aria-activedescendant가
 * 고른 항목을 가리킨다. 목록은 aria-controls로 묶이고, 닫히면 연결을 지운다.
 */
export const ActiveOption: Story = {
  render: () => <EditorSpecimen mentions={source()} content="<p>회의 메모</p>" />,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    const dom = editor.view.dom;
    editor.chain().focus("end").insertContent(" @").run();
    const list = await within(document.body).findByRole("listbox", { name: "페이지 멘션" });
    await expect(dom).toHaveAttribute("aria-controls", list.id);
    await expect(dom).toHaveAttribute("aria-autocomplete", "list");
    const options = within(list).getAllByRole("option");
    await expect(options.length).toBeGreaterThan(1);
    await expect(options[0]).toHaveAttribute("aria-selected", "true");
    await expect(dom).toHaveAttribute("aria-activedescendant", options[0]!.id);
    await waitFor(() => expect(dom).toHaveFocus());

    await userEvent.keyboard("{ArrowDown}");
    await expect(options[0]).toHaveAttribute("aria-selected", "false");
    await expect(options[1]).toHaveAttribute("aria-selected", "true");
    await expect(dom).toHaveAttribute("aria-activedescendant", options[1]!.id);

    await userEvent.keyboard("{ArrowUp}");
    await expect(dom).toHaveAttribute("aria-activedescendant", options[0]!.id);

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(within(document.body).queryByRole("listbox", { name: "페이지 멘션" })).toBeNull(),
    );
    await expect(dom).not.toHaveAttribute("aria-activedescendant");
    await expect(dom).not.toHaveAttribute("aria-controls");
  },
};

/** 결과가 없으면 안내문, Esc로 닫는다 */
export const NoResult: Story = {
  render: () => <EditorSpecimen mentions={source()} content="<p></p>" />,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    editor.chain().focus("end").insertContent("@디자인").run();
    const empty = await within(document.body).findByText("“디자인”에 맞는 페이지가 없어요.");
    await waitFor(() => expect(empty).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(within(document.body).queryByText("“디자인”에 맞는 페이지가 없어요.")).toBeNull(),
    );
  },
};
