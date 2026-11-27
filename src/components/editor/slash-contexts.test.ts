import { describe, expect, it, vi } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import { createExtensions } from "./extensions";
import { SLASH_ITEMS, type SlashContext, type SlashItem } from "./slash-items";

/** 캐럿이 놓이는 문맥 — 문단 텍스트는 `본문 /x`, 캐럿은 `x` 뒤 */
const BODY = "본문 /x";
const p = (text = BODY): JSONContent => ({
  type: "paragraph",
  content: text ? [{ type: "text", text }] : [],
});

const CONTEXTS: Record<string, JSONContent> = {
  문단: { type: "doc", content: [p()] },
  "글머리 목록": {
    type: "doc",
    content: [{ type: "bulletList", content: [{ type: "listItem", content: [p()] }] }],
  },
  "번호 목록": {
    type: "doc",
    content: [{ type: "orderedList", content: [{ type: "listItem", content: [p()] }] }],
  },
  체크리스트: {
    type: "doc",
    content: [
      {
        type: "taskList",
        content: [{ type: "taskItem", attrs: { checked: false }, content: [p()] }],
      },
    ],
  },
  인용: { type: "doc", content: [{ type: "blockquote", content: [p()] }] },
  콜아웃: { type: "doc", content: [{ type: "callout", content: [p()] }] },
  토글: {
    type: "doc",
    content: [
      {
        type: "details",
        attrs: { open: true },
        content: [
          { type: "detailsSummary", content: [{ type: "text", text: "토글 제목" }] },
          { type: "detailsContent", content: [p()] },
        ],
      },
    ],
  },
  "단(열)": {
    type: "doc",
    content: [
      {
        type: "columns",
        content: [
          { type: "column", attrs: { width: 1 }, content: [p()] },
          { type: "column", attrs: { width: 1 }, content: [p("옆 열")] },
        ],
      },
    ],
  },
  표셀: {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [p()] },
              { type: "tableCell", content: [p("다른 셀")] },
            ],
          },
        ],
      },
    ],
  },
  제목: {
    type: "doc",
    content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: BODY }] }],
  },
  "토글 제목": {
    type: "doc",
    content: [
      {
        type: "toggleHeading",
        attrs: { open: true },
        content: [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "접힌 제목" }] },
          p(),
        ],
      },
    ],
  },
};

/** 항목이 만들어야 할 노드(없으면 null = 구조·문장 보존만 확인) */
const EXPECT: Record<string, { node: string; container: boolean } | { text: string } | null> = {
  paragraph: null,
  heading1: { node: "heading", container: false },
  heading2: { node: "heading", container: false },
  heading3: { node: "heading", container: false },
  toggleHeading1: { node: "toggleHeading", container: true },
  toggleHeading2: { node: "toggleHeading", container: true },
  toggleHeading3: { node: "toggleHeading", container: true },
  bulletList: null,
  orderedList: null,
  taskList: null,
  toggle: { node: "details", container: true },
  blockquote: { node: "blockquote", container: true },
  divider: { node: "horizontalRule", container: false },
  image: null,
  file: null,
  pdf: null,
  video: null,
  audio: null,
  codeBlock: { node: "codeBlock", container: true },
  table: { node: "table", container: true },
  callout: { node: "callout", container: true },
  columns2: { node: "columns", container: true },
  columns3: { node: "columns", container: true },
  columns4: { node: "columns", container: true },
  subpage: { node: "subpage", container: false },
  breadcrumb: { node: "breadcrumb", container: false },
  tableOfContents: { node: "tableOfContents", container: false },
  pageMention: { text: "@" },
  blockMath: { node: "blockMath", container: false },
  emoji: null,
  inlineMath: { node: "inlineMath", container: false },
  date: { node: "dateChip", container: false },
  dateTomorrow: { node: "dateChip", container: false },
};

/** 같은 블록 안에서 같은 항목을 고르면 끄는 동작이므로 노드 존재를 확인하지 않는다 (인용 안 인용 → 한 겹 풀림) */
const TOGGLED_OFF = new Set(["인용|blockquote"]);

function run(context: string, item: SlashItem) {
  const editor = new Editor({ extensions: createExtensions(), content: CONTEXTS[context]! });
  // "/x"의 `/` 위치를 찾는다
  let slashAt = -1;
  editor.state.doc.descendants((n, pos) => {
    if (slashAt < 0 && n.isText && n.text!.includes("/x")) slashAt = pos + n.text!.indexOf("/x");
    return slashAt < 0;
  });
  const caret = slashAt + 2;
  editor.commands.setTextSelection(caret);
  const ctx: SlashContext = {
    editBlockMath: vi.fn(),
    editInlineMath: vi.fn(),
    pickImage: vi.fn(),
    pickAttachment: vi.fn(),
    pickEmoji: vi.fn(),
    createSubpage: vi.fn(() => "page-new"),
    openSubpage: vi.fn(),
  };
  const before = editor.getText();
  let error: string | null = null;
  try {
    item.run(editor, { from: slashAt, to: caret }, ctx);
  } catch (e) {
    error = String(e);
  }
  const doc = editor.state.doc;
  const problems: string[] = [];
  if (error) problems.push(`throw: ${error}`);
  try {
    doc.check();
  } catch (e) {
    problems.push(`invalid doc: ${String(e).slice(0, 120)}`);
  }
  if (doc.textContent.includes("/x")) problems.push("/x 남음");
  if (before.includes("본문") && !doc.textContent.includes("본문")) problems.push("본문 소실");
  const want = EXPECT[item.id];
  if (want === undefined) problems.push(`EXPECT에 ${item.id} 없음`);
  else if (want && "node" in want && !TOGGLED_OFF.has(`${context}|${item.id}`)) {
    let found = false;
    doc.descendants((n) => {
      if (n.type.name === want.node) found = true;
      return !found;
    });
    if (!found) problems.push(`${want.node} 없음`);
    else if (want.container) {
      const $c = editor.state.selection.$from;
      let inside = false;
      for (let d = $c.depth; d > 0; d--) if ($c.node(d).type.name === want.node) inside = true;
      if (!inside) problems.push(`캐럿이 ${want.node} 안에 없음`);
    }
  } else if (want && "text" in want) {
    if (!doc.textContent.includes(want.text)) problems.push(`"${want.text}" 없음`);
  }
  if (
    item.id === "image" ||
    item.id === "file" ||
    item.id === "pdf" ||
    item.id === "video" ||
    item.id === "audio"
  ) {
    const called = ctx.pickImage
      ? (ctx.pickImage as ReturnType<typeof vi.fn>).mock.calls.length
      : 0;
    const picked = (ctx.pickAttachment as ReturnType<typeof vi.fn>).mock.calls.length + called;
    if (picked !== 1) problems.push("선택기 호출 안 됨");
  }
  if (item.id === "emoji" && (ctx.pickEmoji as ReturnType<typeof vi.fn>).mock.calls.length !== 1)
    problems.push("이모지 피커 호출 안 됨");
  if (
    item.id === "subpage" &&
    (ctx.openSubpage as ReturnType<typeof vi.fn>).mock.calls.length !== 1
  )
    problems.push("하위 페이지 안 열림");
  editor.destroy();
  return problems;
}

describe("슬래시 명령 × 문맥 매트릭스 (EDIT-07)", () => {
  it.each(Object.keys(CONTEXTS).flatMap((c) => SLASH_ITEMS.map((it) => [c, it] as const)))(
    "%s 안에서 '%s'",
    (context, item) => {
      expect(run(context, item)).toEqual([]);
    },
  );
});

describe("빈 목록 항목에서 블록 명령 (EDIT-07)", () => {
  it.each(["callout", "blockquote", "toggle"])(
    "'%s' — 항목을 목록 밖으로 빼서 바꾼다(빈 글머리가 남지 않는다)",
    (id) => {
      const editor = new Editor({
        extensions: createExtensions(),
        content: {
          type: "doc",
          content: [
            {
              type: "bulletList",
              content: [
                { type: "listItem", content: [p("첫 항목")] },
                { type: "listItem", content: [p("/x")] },
              ],
            },
          ],
        },
      });
      const end = editor.state.doc.content.size - 3;
      editor.commands.setTextSelection(end);
      const item = SLASH_ITEMS.find((i) => i.id === id)!;
      item.run(editor, { from: end - 2, to: end }, {} as SlashContext);
      const top = editor.getJSON().content!.map((n) => n.type);
      expect(top[0]).toBe("bulletList");
      expect(editor.getJSON().content![0]!.content).toHaveLength(1);
      expect(top).toContain(id === "toggle" ? "details" : id);
      editor.destroy();
    },
  );
});
