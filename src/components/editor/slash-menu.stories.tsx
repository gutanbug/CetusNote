import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Editor } from "@tiptap/core";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";
import thumb from "@/debug/samples/thumb-study.jpg";
import type { ImageSource } from "./image";
import type { MentionSource, MentionTarget } from "./page-mention";
import { filterSlashItems, SLASH_ITEMS } from "./slash-items";
import { SlashMenu } from "./slash-menu";

/** 슬래시 메뉴 — 빈 줄이나 공백 뒤에서 `/`를 입력하면 열린다. ↑↓로 고르고 Enter·Tab으로 넣는다. */
const meta = {
  title: "L4 에디터/ED-SlashMenu",
  component: SlashMenu,
  args: { items: SLASH_ITEMS, activeIndex: 6, query: "", onSelect: fn() },
  parameters: {
    // 포커스는 에디터에 두고 aria-activedescendant로 고른다(콤보박스 팝업 패턴). 목록 스크롤은
    // 방향키가 맡으므로 스크롤 영역 자체가 포커스를 받을 필요가 없다.
    a11y: { config: { rules: [{ id: "scrollable-region-focusable", enabled: false }] } },
  },
} satisfies Meta<typeof SlashMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 카테고리 3개 · 항목(아이콘 · 이름 · 설명 · 단축 입력) · 키보드로 고른 항목(체크리스트) */
export const Default: Story = {};

/** `/목록` — 이름·단축 입력·영문 낱말로 거른다 */
export const Filtered: Story = {
  args: { items: filterSlashItems("목록"), query: "목록", activeIndex: 0 },
};

/** 결과 없음 */
export const Empty: Story = {
  args: { items: [], query: "사진" },
};

/** 실제 쓰임 — `/제목`을 입력하고 ↓ Enter로 "제목 2"를 넣는다 */
export const InEditor: Story = {
  render: () => (
    <EditorSpecimen content="<p>회의 메모</p><p></p>" placeholder="'/'를 입력해 명령어 사용" />
  ),
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    // 입력은 에디터 명령으로 넣는다(IME 없이도 같은 트랜잭션), 키는 실제 keydown으로 보낸다
    editor.chain().focus("end").insertContent("/제목").run();
    const list = await within(document.body).findByRole("listbox", { name: "블록 넣기" });
    // 「제목」은 제목 1–3과 토글 제목 1–3에 걸린다
    await expect(within(list).getAllByRole("option")).toHaveLength(6);
    await expect(within(list).getByRole("option", { selected: true })).toHaveTextContent("제목 1");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(canvasElement.querySelector(".ProseMirror h2")).not.toBeNull());
    editor.commands.insertContent("결정 사항");
    await expect(within(document.body).queryByRole("listbox", { name: "블록 넣기" })).toBeNull();
  },
};

/* ───────────── 명령 전체 검사 (기능 + UI) ───────────── */

const PAGES: MentionTarget[] = [
  { id: "p-weekly", title: "주간 회의록 2026-11-19", icon: "📝" },
  { id: "p-log", title: "CetusNote 개발 로그", icon: "🚀" },
];
const mentions: MentionSource = {
  search: (q) => PAGES.filter((p) => p.title.includes(q.trim())),
  resolve: (id) => PAGES.find((p) => p.id === id) ?? null,
  onOpen: () => {},
};
const STUDY = "assets/01JD0000000000000000000000/study.jpg";
const images = (): ImageSource => ({
  load: async () => thumb,
  upload: async () => STUDY,
  pick: fn(async () => STUDY),
});

const START = "<p>회의 메모</p><p></p>";
const body = () => within(document.body);
const LIST = { name: "블록 넣기" } as const;
const tick = (ms = 250) => new Promise((r) => setTimeout(r, ms));

/** 내용을 바꾸고 끝에 캐럿. 포커스는 다음 프레임에 들어오므로 기다린다(키 입력이 에디터로 가게) */
async function reset(editor: Editor, html = START) {
  editor.commands.setContent(html);
  if (html === START) editor.commands.focus("end");
  else {
    // 문서 끝에는 늘 빈 문단이 붙는다 — 끝이 아니라 첫 글 블록(목록·표 칸·코드 블록 안) 끝에 캐럿
    let at = -1;
    editor.state.doc.descendants((n, pos) => {
      if (at < 0 && n.isTextblock) at = pos + 1 + n.content.size;
      return at < 0;
    });
    editor.chain().focus().setTextSelection(at).run();
  }
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
}
/** 캐럿 자리에 `/검색어`를 넣고 열린 목록을 돌려준다 */
async function slash(editor: Editor, query: string) {
  editor.chain().focus().insertContent(`/${query}`).run();
  return body().findByRole("listbox", LIST);
}
const contains = (editor: Editor, type: string) => {
  let found = false;
  editor.state.doc.descendants((n) => {
    if (n.type.name === type) found = true;
    return !found;
  });
  return found;
};
const optionTitle = (o: HTMLElement) => o.querySelector(".font-medium")?.textContent;
const selected = (list: HTMLElement) => within(list).getByRole("option", { selected: true });

/** 명령마다 실행 뒤 문서가 어떤 모양이어야 하는지 */
const CHECK: Record<string, (e: Editor) => Promise<void> | void> = {
  paragraph: (e) => {
    expect(e.isActive("paragraph")).toBe(true);
    expect(e.isActive("heading")).toBe(false);
  },
  heading1: (e) => expect(e.isActive("heading", { level: 1 })).toBe(true),
  heading2: (e) => expect(e.isActive("heading", { level: 2 })).toBe(true),
  heading3: (e) => expect(e.isActive("heading", { level: 3 })).toBe(true),
  bulletList: (e) => expect(e.isActive("bulletList")).toBe(true),
  orderedList: (e) => expect(e.isActive("orderedList")).toBe(true),
  taskList: (e) => expect(e.isActive("taskList")).toBe(true),
  toggle: (e) => expect(contains(e, "details")).toBe(true),
  blockquote: (e) => expect(e.isActive("blockquote")).toBe(true),
  divider: (e) => expect(contains(e, "horizontalRule")).toBe(true),
  image: (e) => expect(contains(e, "image")).toBe(true),
  codeBlock: (e) => expect(e.isActive("codeBlock")).toBe(true),
  table: (e) => {
    expect(e.isActive("table")).toBe(true);
    // 3×3, 머리글 줄 있음
    let rows = 0;
    let headers = 0;
    e.state.doc.descendants((n) => {
      if (n.type.name === "tableRow") rows++;
      if (n.type.name === "tableHeader") headers++;
    });
    expect(rows).toBe(3);
    expect(headers).toBe(3);
  },
  callout: (e) => expect(e.isActive("callout")).toBe(true),
  tableOfContents: (e) => expect(contains(e, "tableOfContents"), "목차 블록 노드").toBe(true),
  pageMention: async (e) => {
    expect(e.state.doc.textContent).toContain("@");
    await body().findByRole("listbox", { name: "페이지 멘션" });
  },
  blockMath: (e) => {
    expect(contains(e, "blockMath"), "수식 블록 노드").toBe(true);
    expect(body().queryByRole("dialog", { name: "수식 편집" }), "수식 편집 창").not.toBeNull();
  },
  inlineMath: (e) => {
    expect(contains(e, "inlineMath"), "인라인 수식 노드").toBe(true);
    expect(body().queryByRole("dialog", { name: "수식 편집" }), "수식 편집 창").not.toBeNull();
  },
  toggleHeading1: (e) => expect(toggleLevel(e)).toBe(1),
  toggleHeading2: (e) => expect(toggleLevel(e)).toBe(2),
  toggleHeading3: (e) => expect(toggleLevel(e)).toBe(3),
  columns2: (e) => expectColumns(e, 2),
  columns3: (e) => expectColumns(e, 3),
  columns4: (e) => expectColumns(e, 4),
  breadcrumb: (e) => expect(contains(e, "breadcrumb"), "경로 표시 블록").toBe(true),
  date: (e) => expect(contains(e, "dateChip"), "날짜 칩").toBe(true),
  dateTomorrow: (e) => expect(contains(e, "dateChip"), "내일 날짜 칩").toBe(true),
};

/** 넣은 토글 제목의 제목 단계 */
function toggleLevel(e: Editor): unknown {
  let level: unknown = null;
  e.state.doc.descendants((n) => {
    if (n.type.name === "toggleHeading") level = n.firstChild?.attrs.level;
  });
  return level;
}

/** 넣은 단 블록의 열 수 */
function expectColumns(e: Editor, count: number) {
  expect(contains(e, "columns"), "단 나누기 블록").toBe(true);
  let columns = 0;
  e.state.doc.descendants((n) => {
    if (n.type.name === "column") columns++;
  });
  expect(columns).toBe(count);
}

/** 실패하면 어떤 경우인지 이름을 붙인다 */
async function check(id: string, editor: Editor, label = id) {
  await waitFor(() => CHECK[id]!(editor)).catch((e: Error) =>
    Promise.reject(new Error(`[${label}] ${e.message}`)),
  );
}

/** 실행 뒤 따로 뜬 창(멘션 제안 · 수식 편집)을 닫는다 */
async function closeSide(id: string) {
  if (id !== "pageMention" && id !== "blockMath" && id !== "inlineMath") return;
  await userEvent.keyboard("{Escape}");
  await waitFor(() => {
    expect(body().queryByRole("listbox", { name: "페이지 멘션" })).toBeNull();
    expect(body().queryByRole("dialog", { name: "수식 편집" })).toBeNull();
  });
}

const Full = () => (
  <EditorSpecimen
    content={START}
    images={images()}
    mentions={mentions}
    placeholder="'/'를 입력해 명령어 사용"
  />
);

/** 27개 명령 전부 — 이름으로 찾아 ↓로 고르고 Enter. 선택 표시·aria-activedescendant·실행 결과·`/` 지움 */
export const EveryCommandEnter: Story = {
  render: Full,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    for (const item of SLASH_ITEMS) {
      await reset(editor);
      const list = await slash(editor, item.title);
      const k = filterSlashItems(item.title).indexOf(item);
      for (let i = 0; i < k; i++) await userEvent.keyboard("{ArrowDown}");
      const opt = selected(list);
      await expect(optionTitle(opt), item.id).toBe(item.title);
      await waitFor(() =>
        expect(editor.view.dom.getAttribute("aria-activedescendant"), item.id).toBe(opt.id),
      );
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(body().queryByRole("listbox", LIST)).toBeNull());
      await check(item.id, editor);
      await expect(editor.state.doc.textContent, item.id).not.toContain("/");
      // 닫히면 에디터의 콤보박스 속성도 지운다(멘션은 이어서 멘션 제안이 열리므로 남는다)
      if (item.id !== "pageMention")
        await waitFor(() =>
          expect(editor.view.dom.hasAttribute("aria-activedescendant"), item.id).toBe(false),
        );
      await closeSide(item.id);
    }
  },
};

/** 27개 명령 전부 — `/`만 쳐서 열린 전체 목록에서 마우스로 누른다. 포커스는 에디터에 남는다 */
export const EveryCommandClick: Story = {
  render: Full,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    for (const item of SLASH_ITEMS) {
      await reset(editor);
      const list = await slash(editor, "");
      const options = within(list).getAllByRole("option");
      await expect(options).toHaveLength(SLASH_ITEMS.length);
      const opt = options.find((o) => optionTitle(o) === item.title)!;
      await userEvent.click(opt);
      await check(item.id, editor);
      await expect(editor.state.doc.textContent, item.id).not.toContain("/");
      if (item.id !== "blockMath" && item.id !== "inlineMath")
        await expect(editor.view.hasFocus(), item.id).toBe(true);
      await closeSide(item.id);
    }
  },
};

/** 영문 낱말·단축 입력으로 찾고 Tab으로 넣는다 */
export const KeywordsWithTab: Story = {
  render: Full,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    const cases: [string, string][] = [
      ["h1", "heading1"],
      ["h2", "heading2"],
      ["###", "heading3"],
      ["ul", "bulletList"],
      ["ol", "orderedList"],
      ["todo", "taskList"],
      ["checklist", "taskList"],
      ["details", "toggle"],
      ["quote", "blockquote"],
      ["hr", "divider"],
      ["```", "codeBlock"],
      ["table", "table"],
      ["callout", "callout"],
      ["TEXT", "paragraph"],
    ];
    // 수식 블록(latex)은 Tab 뒤 편집 창으로 포커스가 옮겨 가는데, 테스트의 Tab 흉내가 그 창을
    // 닫아 버린다. 실제 브라우저에서는 열린다(미리보기 확인). Enter 경로는 EveryCommandEnter가 본다.
    for (const [q, id] of cases) {
      await reset(editor);
      const list = await slash(editor, q);
      await expect(optionTitle(selected(list)), q).toBe(
        SLASH_ITEMS.find((it) => it.id === id)!.title,
      );
      await userEvent.keyboard("{Tab}");
      await check(id, editor, q);
      await closeSide(id);
    }
  },
};

/** 키보드 — 처음은 첫 항목, ↑는 맨 끝으로 돌고 ↓ 16번이면 제자리. 고른 항목은 목록 안에 보인다. Esc는 글자를 남기고 닫는다 */
export const KeyboardNavigation: Story = {
  render: Full,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await reset(editor);
    const list = await slash(editor, "");
    await expect(optionTitle(selected(list))).toBe("텍스트");
    await userEvent.keyboard("{ArrowUp}");
    // 맨 끝 항목(날짜 묶음의 마지막)으로 돈다
    await expect(optionTitle(selected(list))).toBe("내일 날짜");
    // 맨 끝 항목이 목록 안에 보이게 스크롤됐다
    await waitFor(() => {
      const o = selected(list).getBoundingClientRect();
      const l = list.getBoundingClientRect();
      expect(o.bottom).toBeLessThanOrEqual(l.bottom + 1);
      expect(o.top).toBeGreaterThanOrEqual(l.top - 1);
    });
    await userEvent.keyboard("{ArrowDown}");
    await expect(optionTitle(selected(list))).toBe("텍스트");
    for (let i = 0; i < SLASH_ITEMS.length; i++) await userEvent.keyboard("{ArrowDown}");
    await expect(optionTitle(selected(list))).toBe("텍스트");
    // 고른 항목은 하나뿐
    await expect(within(list).getAllByRole("option", { selected: true })).toHaveLength(1);
    // 마우스를 올리면 그 항목으로 옮긴다
    const callout = within(list)
      .getAllByRole("option")
      .find((o) => optionTitle(o) === "콜아웃")!;
    await userEvent.hover(callout);
    await waitFor(() => expect(optionTitle(selected(list))).toBe("콜아웃"));
    await waitFor(() =>
      expect(editor.view.dom.getAttribute("aria-activedescendant")).toBe(callout.id),
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body().queryByRole("listbox", LIST)).toBeNull());
    await expect(editor.state.doc.lastChild?.textContent).toBe("/");
    await expect(contains(editor, "callout")).toBe(false);
  },
};

/** 검색어를 치는 동안 — 결과가 줄고, 고른 항목은 첫 항목으로. 없으면 안내문, `/`를 지우면 닫힌다 */
export const LiveFiltering: Story = {
  render: Full,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await reset(editor);
    let list = await slash(editor, "");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    editor.commands.insertContent("제목");
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(6));
    await expect(optionTitle(selected(list))).toBe("제목 1");
    editor.commands.insertContent(" 3");
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(2));
    await expect(optionTitle(selected(list))).toBe("제목 3");
    // 지우면 다시 늘어난다
    await userEvent.keyboard("{Backspace}{Backspace}");
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(6));
    await userEvent.keyboard("{Backspace}{Backspace}");
    await waitFor(() =>
      expect(within(list).getAllByRole("option")).toHaveLength(SLASH_ITEMS.length),
    );
    // 결과 없음: 목록 대신 안내문, Enter는 메뉴가 가로채지 않는다(줄바꿈)
    editor.commands.insertContent("데이터베이스");
    const status = await body().findByRole("status");
    await expect(status).toHaveTextContent("“데이터베이스”에 해당하는 블록이 없어요.");
    await waitFor(() => expect(editor.view.dom.hasAttribute("aria-activedescendant")).toBe(false));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(body().queryByText(/해당하는 블록이 없어요/)).toBeNull());
    await expect(editor.state.doc.textContent).toContain("/데이터베이스");
    // `/`까지 지우면 닫힌다
    await reset(editor);
    list = await slash(editor, "");
    await userEvent.keyboard("{Backspace}");
    await waitFor(() => expect(body().queryByRole("listbox", LIST)).toBeNull());
  },
};

async function expectClosed(label: string) {
  await tick();
  await expect(body().queryByRole("listbox", LIST), label).toBeNull();
  await expect(body().queryByText(/해당하는 블록이 없어요/), label).toBeNull();
}

/** 열리는 곳 · 안 열리는 곳 */
export const WhereItOpens: Story = {
  render: Full,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    const opens = async (html: string, label: string, before = "") => {
      await reset(editor, html);
      editor.commands.insertContent(`${before}/`);
      await body()
        .findByRole("listbox", LIST)
        .catch(() => {
          throw new Error(`[${label}] 슬래시 메뉴가 열리지 않았어요`);
        });
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(body().queryByRole("listbox", LIST)).toBeNull());
    };
    await opens("<p></p>", "빈 문단");
    await opens("<p>회의 메모</p>", "공백 뒤", " ");
    await opens("<h2>결정 사항</h2>", "제목 안 공백 뒤", " ");
    await opens("<ul><li><p></p></li></ul>", "목록 항목");
    await opens("<blockquote><p></p></blockquote>", "인용");
    await opens("<table><tr><td><p></p></td></tr></table>", "표 칸");

    // 글 중간(날짜 1/2)에서는 열지 않는다
    await reset(editor, "<p>날짜 1</p>");
    editor.commands.insertContent("/2");
    await expectClosed("날짜 1/2");
    // 코드 블록 안
    await reset(editor, "<pre><code>const a = 1;</code></pre>");
    editor.commands.insertContent(" /");
    await expectClosed("코드 블록 안");
    // URL 같은 글자 사이
    await reset(editor, "<p>https:</p>");
    editor.commands.insertContent("//example.com");
    await expectClosed("URL");
  },
};

/** 다른 블록 안에서 실행 — 목록 안 코드 블록, 표 칸 안 목록, 인용 안 체크리스트, 글 뒤의 수식 블록 */
export const InsideOtherBlocks: Story = {
  render: Full,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    const run = async (html: string, query: string, ok: () => void) => {
      await reset(editor, html);
      await slash(editor, query);
      await userEvent.keyboard("{Enter}");
      await waitFor(ok).catch((e: Error) => {
        throw new Error(`[${query} in ${html}] ${e.message} — ${JSON.stringify(editor.getJSON())}`);
      });
      await expect(editor.state.doc.textContent).not.toContain("/");
    };
    // 빈 목록 항목에서는 그 줄을 코드 블록으로 바꾼다(목록 밖으로) — 블록 "바꾸기"와 같다
    await run("<ul><li><p></p></li></ul>", "코드 블록", () => {
      expect(editor.isActive("codeBlock")).toBe(true);
    });
    await run("<table><tr><td><p></p></td></tr></table>", "글머리", () => {
      expect(editor.isActive("bulletList")).toBe(true);
      expect(editor.isActive("table")).toBe(true);
    });
    await run("<blockquote><p></p></blockquote>", "체크", () => {
      expect(editor.isActive("taskList")).toBe(true);
      expect(editor.isActive("blockquote")).toBe(true);
    });
    // 글이 있는 줄: 제목은 그 줄을 바꾸고, 수식 블록은 다음 자리에 넣는다
    await reset(editor, "<p>회의 메모</p>");
    editor.commands.insertContent(" ");
    await slash(editor, "제목 2");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(editor.isActive("heading", { level: 2 })).toBe(true));
    await expect(editor.state.doc.firstChild?.textContent.trim()).toBe("회의 메모");

    await reset(editor, "<p>피타고라스</p>");
    editor.commands.insertContent(" ");
    await slash(editor, "수식");
    await userEvent.keyboard("{Enter}");
    await body().findByRole("dialog", { name: "수식 편집" });
    await expect(editor.state.doc.firstChild?.textContent.trim()).toBe("피타고라스");
    await expect(editor.state.doc.child(1).type.name).toBe("blockMath");
    await closeSide("blockMath");
  },
};

/** 실행 취소 — 명령 하나는 ⌘Z로 되돌린다 */
export const UndoCommand: Story = {
  render: Full,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    for (const query of ["제목 1", "표", "구분선", "콜아웃", "토글"]) {
      await reset(editor);
      await tick(600); // 앞 입력과 실행 취소 묶음을 나눈다
      await slash(editor, query);
      await userEvent.keyboard("{Enter}");
      const before = editor.state.doc.childCount;
      await waitFor(() => expect(editor.state.doc.textContent).not.toContain("/"));
      editor.commands.undo();
      await waitFor(() => {
        expect(contains(editor, "table"), query).toBe(false);
        expect(contains(editor, "horizontalRule"), query).toBe(false);
        expect(contains(editor, "callout"), query).toBe(false);
        expect(contains(editor, "details"), query).toBe(false);
        expect(editor.isActive("heading"), query).toBe(false);
      });
      await expect(before).toBeGreaterThan(0);
    }
  },
};

/** 이미지 저장소가 없을 때(`/이미지`) — 글자만 지우고 아무것도 넣지 않는다. 오류 없이 계속 쓸 수 있다 */
export const ImageWithoutSource: Story = {
  render: () => <EditorSpecimen content={START} />,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await reset(editor);
    await slash(editor, "이미지");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(editor.state.doc.textContent).toBe("회의 메모"));
    await expect(contains(editor, "image")).toBe(false);
    editor.commands.insertContent("계속");
    await expect(editor.state.doc.textContent).toBe("회의 메모계속");
  },
};

/** 읽기 전용 — `/`를 넣어도 열리지 않는다 */
export const ReadOnlyNeverOpens: Story = {
  render: () => <EditorSpecimen content="<p>회의 메모 </p>" editable={false} />,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    editor.chain().focus("end").insertContent("/").run();
    await expectClosed("읽기 전용");
  },
};

/** 이미지 명령은 고르기 대화상자를 연다(pick) — 고르면 그 자리에 들어간다 */
export const ImagePick: Story = {
  render: () => {
    const src = images();
    (window as unknown as { __slashImages: ImageSource }).__slashImages = src;
    return <EditorSpecimen content={START} images={src} />;
  },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    const src = (window as unknown as { __slashImages: ImageSource }).__slashImages;
    await reset(editor);
    await slash(editor, "사진");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(src.pick).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(contains(editor, "image")).toBe(true));
    await expect(
      within(canvasElement).getByRole("slider", { name: "이미지 너비" }),
    ).toBeInTheDocument();
  },
};

/** 수식 블록 흐름 — 식을 적용하면 캐럿이 수식 뒤로 가서 이어 쓴 글이 수식을 덮지 않는다. 빈 수식을 Esc로 닫으면 지우고 에디터로 돌아온다 */
export const BlockMathFlow: Story = {
  render: Full,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    const count = () => {
      let n = 0;
      editor.state.doc.descendants((x) => {
        if (x.type.name === "blockMath") n++;
      });
      return n;
    };
    await reset(editor);
    await slash(editor, "수식");
    await userEvent.keyboard("{Enter}");
    const dialog = await body().findByRole("dialog", { name: "수식 편집" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "LaTeX" }), "x^2{Enter}");
    await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
    await expect(editor.state.selection.empty).toBe(true);
    await userEvent.keyboard("다음 줄");
    await waitFor(() => expect(editor.state.doc.textContent).toContain("다음 줄"));
    await expect(count()).toBe(1);

    // 두 번째 수식도 앞의 것을 덮지 않는다
    await userEvent.keyboard("{Enter}");
    await slash(editor, "수식");
    await userEvent.keyboard("{Enter}");
    const second = await body().findByRole("dialog", { name: "수식 편집" });
    await userEvent.type(within(second).getByRole("textbox", { name: "LaTeX" }), "y{Enter}");
    await waitFor(() => expect(count()).toBe(2));

    // 빈 수식은 취소하면 지운다
    await userEvent.keyboard("{Enter}");
    await slash(editor, "수식");
    await userEvent.keyboard("{Enter}");
    await body().findByRole("dialog", { name: "수식 편집" });
    await waitFor(() => expect(count()).toBe(3));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(count()).toBe(2));
    await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
  },
};
