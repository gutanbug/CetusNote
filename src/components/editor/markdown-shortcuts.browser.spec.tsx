import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { createExtensions } from "./extensions";

const P = (t: string): JSONContent => ({
  type: "paragraph",
  content: t ? [{ type: "text", text: t }] : [],
});

function sig(n: PMNode): string {
  if (n.isText) {
    let t = n.text ?? "";
    for (const m of n.marks) t = `<${m.type.name}>${t}</${m.type.name}>`;
    return t;
  }
  const attrs = Object.entries(n.attrs)
    .filter(([, v]) => v !== null && v !== false && v !== "" && v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  const parts: string[] = [];
  n.forEach((c) => parts.push(sig(c)));
  const head = `${n.type.name}${attrs ? `[${attrs}]` : ""}`;
  return n.isTextblock || parts.length ? `${head}{${parts.join(" ")}}` : head;
}

function typeAt(setup: JSONContent, typed: string) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({ element, extensions: createExtensions({}), content: setup });
  let at = -1;
  editor.state.doc.descendants((n, pos) => {
    if (at < 0 && n.isTextblock && n.textContent === "|") at = pos + 1;
    return at < 0;
  });
  editor.view.dispatch(editor.state.tr.delete(at, at + 1));
  editor.commands.setTextSelection(at);
  for (const ch of typed) {
    const { from, to } = editor.state.selection;
    const insert = () => editor.state.tr.insertText(ch, from, to);
    const handled = editor.view.someProp("handleTextInput", (f) =>
      f(editor.view, from, to, ch, insert),
    );
    if (!handled) editor.view.dispatch(insert());
  }
  // 바깥 doc{…}과 맨 뒤 빈 문단(자리 표시 문단)은 빼고 본다
  const out = sig(editor.state.doc)
    .slice(4, -1)
    .replace(/ paragraph\{\}$/, "");
  editor.destroy();
  element.remove();
  return out;
}

const DOC = (...c: JSONContent[]): JSONContent => ({ type: "doc", content: c });
const CONTEXTS: Record<string, JSONContent> = {
  top: DOC(P("|")),
  listItem: DOC({ type: "bulletList", content: [{ type: "listItem", content: [P("|")] }] }),
  taskItem: DOC({
    type: "taskList",
    content: [{ type: "taskItem", attrs: { checked: false }, content: [P("|")] }],
  }),
  blockquote: DOC({ type: "blockquote", content: [P("|")] }),
  callout: DOC({ type: "callout", content: [P("|")] }),
  toggle: DOC({
    type: "details",
    attrs: { open: true },
    content: [
      { type: "detailsSummary", content: [{ type: "text", text: "제목" }] },
      { type: "detailsContent", content: [P("|")] },
    ],
  }),
  tableCell: DOC({
    type: "table",
    content: [
      {
        type: "tableRow",
        content: [
          {
            type: "tableCell",
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [P("|")],
          },
          {
            type: "tableCell",
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [P("나")],
          },
        ],
      },
    ],
  }),
  column: DOC({
    type: "columns",
    content: [
      { type: "column", attrs: { width: 1 }, content: [P("|")] },
      { type: "column", attrs: { width: 1 }, content: [P("나")] },
    ],
  }),
};

/** 모든 위치에서 블록 문법이 구조를 깨지 않고 바뀌는지 본다 */
describe("EDIT-10 블록 단축 입력", () => {
  it.each([
    ["# 제목", "heading[level=1]{제목}"],
    ["- 항목", "bulletList{listItem{paragraph{항목}}}"],
    ["1. 항목", "orderedList[start=1]{listItem{paragraph{항목}}}"],
    ["[ ] 할일", "taskList{taskItem{paragraph{할일}}}"],
    ["[x] 할일", "taskList{taskItem[checked=true]{paragraph{할일}}}"],
    ["> 인용", "blockquote{paragraph{인용}}"],
    [">> 토글", "details{detailsSummary{토글} detailsContent{paragraph{}}}"],
    ["::: 콜", "callout[emoji=💡,color=blue]{paragraph{콜}}"],
    ["```ts ", "codeBlock[language=ts]{}"],
    ["$$$ ", "blockMath"],
  ])("맨 위에서 %j → %s", (typed, expected) => {
    expect(typeAt(CONTEXTS.top, typed)).toBe(expected);
  });

  it("구분선 --- 은 구분선 노드가 된다", () => {
    expect(typeAt(CONTEXTS.top, "--- ")).toMatch(/^horizontalRule/);
  });

  // 목록 항목·체크리스트 항목 안에서는 항목을 목록 밖으로 빼고 블록으로 바꾼다 (EDIT-02)
  it.each([
    ["listItem", "# 제목", "heading[level=1]{제목}"],
    ["listItem", "> 인용", "blockquote{paragraph{인용}}"],
    ["listItem", ">> 토글", "details{detailsSummary{토글} detailsContent{paragraph{}}}"],
    ["listItem", "::: 콜", "callout[emoji=💡,color=blue]{paragraph{콜}}"],
    ["listItem", "```ts ", "codeBlock[language=ts]{}"],
    ["listItem", "$$$ ", "blockMath"],
    ["listItem", "[ ] 할일", "taskList{taskItem{paragraph{할일}}}"],
    ["listItem", "1. 항목", "orderedList[start=1]{listItem{paragraph{항목}}}"],
    ["taskItem", "## 제목", "heading[level=2]{제목}"],
    ["taskItem", "- 항목", "bulletList{listItem{paragraph{항목}}}"],
    ["taskItem", ">> 토글", "details{detailsSummary{토글} detailsContent{paragraph{}}}"],
    ["taskItem", "```ts ", "codeBlock[language=ts]{}"],
  ])("%s 안에서 %j → 목록 밖으로 빼서 %s", (ctx, typed, expected) => {
    expect(typeAt(CONTEXTS[ctx], typed)).toBe(expected);
  });

  it.each(["listItem", "taskItem"])("%s 안의 --- 은 목록 밖 구분선이 된다", (ctx) => {
    expect(typeAt(CONTEXTS[ctx as "listItem"], "---")).toMatch(/^horizontalRule/);
  });

  // 인용·콜아웃·토글 본문·표 칸·칼럼 안에서는 자리가 있어 바로 바뀐다
  it.each([
    ["blockquote", "## 제목", "blockquote{heading[level=2]{제목}}"],
    ["blockquote", "1. 항목", "blockquote{orderedList[start=1]{listItem{paragraph{항목}}}}"],
    [
      "blockquote",
      ">> 토글",
      "blockquote{details{detailsSummary{토글} detailsContent{paragraph{}}}}",
    ],
    ["callout", "# 제목", "callout[emoji=💡,color=blue]{heading[level=1]{제목}}"],
    ["callout", "[ ] 할일", "callout[emoji=💡,color=blue]{taskList{taskItem{paragraph{할일}}}}"],
    [
      "toggle",
      "# 제목",
      "details[open=true]{detailsSummary{제목} detailsContent{heading[level=1]{제목}}}",
    ],
    [
      "toggle",
      "[ ] 할일",
      "details[open=true]{detailsSummary{제목} detailsContent{taskList{taskItem{paragraph{할일}}}}}",
    ],
    ["toggle", "$$$ ", "details[open=true]{detailsSummary{제목} detailsContent{blockMath}}"],
  ])("%s 안에서 %j → %s", (ctx, typed, expected) => {
    expect(typeAt(CONTEXTS[ctx], typed)).toBe(expected);
  });

  it.each([
    ["tableCell", "- 항목", "bulletList{listItem{paragraph{항목}}}"],
    ["tableCell", "> 인용", "blockquote{paragraph{인용}}"],
    ["tableCell", "```ts ", "codeBlock[language=ts]{}"],
    ["column", "# 제목", "heading[level=1]{제목}"],
    ["column", "[x] 할일", "taskList{taskItem[checked=true]{paragraph{할일}}}"],
    ["column", ">> 토글", "details{detailsSummary{토글} detailsContent{paragraph{}}}"],
  ])("%s 안에서 %j → 칸 안에 %s", (ctx, typed, expected) => {
    expect(typeAt(CONTEXTS[ctx], typed)).toContain(expected);
  });
});

describe("EDIT-10 인라인 단축 입력", () => {
  it.each([
    ["**굵게**를", "<bold>굵게</bold> 를"],
    ["__굵게__를", "<bold>굵게</bold> 를"],
    ["*기울임*를", "<italic>기울임</italic> 를"],
    ["_기울임_를", "<italic>기울임</italic> 를"],
    ["~~취소~~를", "<strike>취소</strike> 를"],
    ["`코드`를", "<code>코드</code> 를"],
    ["==강조==를", "<highlight>강조</highlight> 를"],
    ["가**나**다", "가 <bold>나</bold> 다"],
    ["가*나*다", "가 <italic>나</italic> 다"],
    ["가~~나~~다", "가 <strike>나</strike> 다"],
    ["가==나==다", "가 <highlight>나</highlight> 다"],
    ["가`나`다", "가 <code>나</code> 다"],
    ["$x$를", "inlineMath[latex=x] 를"],
    ["$$y$$를", "inlineMath[latex=y] 를"],
  ])("맨 위에서 %j", (typed, expected) => {
    expect(typeAt(CONTEXTS.top, typed)).toBe(`paragraph{${expected}}`);
  });
});
