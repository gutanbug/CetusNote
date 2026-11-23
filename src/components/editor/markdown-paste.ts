import { Extension } from "@tiptap/core";
import {
  DOMParser as PMDOMParser,
  type ResolvedPos,
  type Schema,
  type Slice,
} from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Marked } from "marked";
import { imagesToFigures } from "./remote-images";

/** 줄 맨 앞 블록 기호: 제목 · 목록 · 할 일 · 인용 · 코드 울타리 · 표 · 구분선 */
const BLOCK_LINE =
  /^\s{0,3}(#{1,6}\s|[-*+]\s|\d{1,9}[.)]\s|>|```|~~~|\|.*\||(?:-{3,}|\*{3,}|_{3,})\s*$)/;
/** 글 안 서식: 굵게 · 기울임 · 취소선 · 코드 · 링크 */
const INLINE = /\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)/;

/** 마크다운으로 보이는 글인지 — 평범한 글은 지금처럼 줄마다 문단으로 붙인다 */
export function looksLikeMarkdown(text: string): boolean {
  const lines = text.split(/\r\n?|\n/);
  return lines.some((l) => BLOCK_LINE.test(l)) || INLINE.test(text);
}

// gfm: 표 · 할 일 · 취소선 · 주소 자동 링크. breaks: 한 줄 바꿈도 살린다(붙여 넣은 글이 이어 붙지 않게)
const marked = new Marked({ gfm: true, breaks: true, async: false });

/**
 * 마크다운 → 에디터 HTML. 결과는 화면에 붙이지 않는 별도 문서에서 읽는다
 * (스크립트·이미지 로드가 일어나지 않는다). 에디터 스키마에 없는 태그는 파서가 버린다.
 */
export function markdownToDom(
  text: string,
  images?: Parameters<typeof imagesToFigures>[1],
): HTMLElement {
  const html = marked.parse(text.replace(/\r\n?/g, "\n")) as string;
  const doc = new window.DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  // GFM 할 일(<li><input type=checkbox> …)을 TaskList/TaskItem 모양으로
  for (const box of doc.querySelectorAll<HTMLInputElement>('li > input[type="checkbox"]')) {
    const li = box.parentElement!;
    li.setAttribute("data-type", "taskItem");
    li.setAttribute("data-checked", String(box.hasAttribute("checked")));
    li.parentElement?.setAttribute("data-type", "taskList");
    box.remove();
    const first = li.firstChild;
    if (first?.nodeType === Node.TEXT_NODE) first.textContent = first.textContent!.trimStart();
  }
  // ![설명](주소)는 내려받을 이미지 자리로 (EDIT-24)
  imagesToFigures(doc.body, images);
  // marked는 코드 블록 끝에 줄바꿈을 하나 더 붙인다
  for (const code of doc.querySelectorAll("pre > code")) {
    const last = code.lastChild;
    if (last?.nodeType === Node.TEXT_NODE) last.textContent = last.textContent!.replace(/\n$/, "");
  }
  return doc.body;
}

/** 마크다운 글을 붙여 넣을 조각으로. 마크다운이 아니면 null(기본 붙여넣기) */
export function markdownSlice(text: string, schema: Schema, $context?: ResolvedPos): Slice | null {
  if (!text.trim() || !looksLikeMarkdown(text)) return null;
  return PMDOMParser.fromSchema(schema).parseSlice(markdownToDom(text), {
    context: $context,
  });
}

/**
 * HTML이 함께 왔어도 글자만 담은 껍데기(코드 편집기 · 터미널: div/span/br/p뿐)면
 * 마크다운 원문으로 본다. 웹 페이지 HTML(제목·목록·표 태그가 있다)은 그대로 HTML로 붙인다.
 */
function plainWrapper(html: string): boolean {
  // 에디터끼리 복사(data-pm-slice)는 이미 구조가 있다
  if (html.includes("data-pm-slice")) return false;
  return !/<(h[1-6]|ul|ol|li|table|pre|blockquote|a|strong|b|em|i|code|img)\b/i.test(html);
}

const key = new PluginKey("markdownPaste");

/**
 * ED-MarkdownPaste (EDIT-23) — 다른 앱이나 AI 답변에서 복사한 마크다운을 제목·목록·할 일·인용·
 * 코드 블록·표·서식으로 바꿔 붙인다. ⇧⌘V(서식 없이 붙여넣기)와 코드 블록 안은 글자 그대로.
 */
export const MarkdownPaste = Extension.create({
  name: "markdownPaste",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        props: {
          // 글자만 온 붙여넣기 (plain = ⇧ 눌러 서식 없이)
          // null이면 ProseMirror가 기본대로(줄마다 문단) 붙인다
          clipboardTextParser: (text, $context, plain, view) =>
            (plain ? null : markdownSlice(text, view.state.schema, $context)) as Slice,
          // 코드 편집기처럼 글자를 HTML 껍데기에 싸서 주는 경우
          handlePaste: (view, event) => {
            const data = event.clipboardData;
            const html = data?.getData("text/html");
            const text = data?.getData("text/plain");
            if (!html || !text || !plainWrapper(html)) return false;
            if (view.state.selection.$from.parent.type.spec.code) return false;
            const slice = markdownSlice(text, view.state.schema, view.state.selection.$from);
            if (!slice) return false;
            view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
            return true;
          },
        },
      }),
    ];
  },
});
