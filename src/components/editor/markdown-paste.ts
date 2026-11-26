import { Extension } from "@tiptap/core";
import {
  DOMParser as PMDOMParser,
  type ResolvedPos,
  type Schema,
  type Slice,
} from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Marked } from "marked";
import { calloutColorOf } from "@/lib/callout-type";
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

/** `[!NOTE] 💡` 머리의 콜아웃 종류 표지 (내보내기 형식 · Obsidian 형식 모두) */
const CALLOUT_OPEN = /^\[!([A-Za-z][\w-]*)\][ \t]*/;
/** 콜아웃 머리 이모지 한 개 (변형 선택자·ZWJ 묶음 포함) */
const LEADING_EMOJI = /^(\p{Extended_Pictographic}️?(?:⃣|‍\p{Extended_Pictographic}️?)*)[ \t]*/u;
const PAGE_LINK = "cetusnote://page/";

/**
 * `> [!NOTE] 💡 …` 인용을 콜아웃 블록(`div[data-type=callout]`)으로 바꾼다 (DATA-08).
 * 머리 줄에 이모지가 없으면 기본 💡을 쓴다. 종류 이름은 lib/callout-type이 색으로 옮긴다.
 */
function calloutsFromQuotes(root: HTMLElement): void {
  for (const quote of [...root.querySelectorAll("blockquote")]) {
    const first = quote.firstElementChild;
    const lead = first?.firstChild;
    if (first?.tagName !== "P" || lead?.nodeType !== Node.TEXT_NODE) continue;
    const open = CALLOUT_OPEN.exec(lead.textContent ?? "");
    if (!open) continue;
    let rest = (lead.textContent ?? "").slice(open[0].length);
    let emoji = "💡";
    const em = LEADING_EMOJI.exec(rest);
    if (em) {
      emoji = em[1]!;
      rest = rest.slice(em[0].length);
    }
    lead.textContent = rest;
    // 줄바꿈(breaks)으로 생긴 <br>과 빈 글자를 걷어내고, 남은 것이 없으면 머리 문단을 뺀다
    while (
      first.firstChild &&
      (first.firstChild.nodeName === "BR" ||
        (first.firstChild.nodeType === Node.TEXT_NODE && !first.firstChild.textContent))
    )
      first.firstChild.remove();
    if (!first.childNodes.length) first.remove();
    const box = root.ownerDocument.createElement("div");
    box.setAttribute("data-type", "callout");
    box.setAttribute("data-emoji", emoji);
    box.setAttribute("data-color", calloutColorOf(open[1]!));
    box.append(...quote.childNodes);
    quote.replaceWith(box);
  }
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
  links?: { pageLabel?: (id: string) => string | undefined },
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
  // > [!NOTE] 💡 … 인용은 콜아웃 블록으로 (DATA-08)
  calloutsFromQuotes(doc.body);
  // cetusnote://page/<id> 링크 중 워크스페이스에 있는 페이지는 페이지 멘션으로 (DATA-10)
  if (links?.pageLabel)
    for (const a of [...doc.querySelectorAll<HTMLAnchorElement>(`a[href^="${PAGE_LINK}"]`)]) {
      const id = a.getAttribute("href")!.slice(PAGE_LINK.length);
      const label = id ? links.pageLabel(id) : undefined;
      if (label === undefined) continue;
      const span = doc.createElement("span");
      span.setAttribute("data-page-mention", id);
      span.textContent = label || "제목 없음";
      a.replaceWith(span);
    }
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
