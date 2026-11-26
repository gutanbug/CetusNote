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
  /^\s{0,3}(#{1,6}\s|[-*+]\s|\d{1,9}[.)]\s|>|```|~~~|\|.*\||\$\$\s*$|(?:-{3,}|\*{3,}|_{3,})\s*$)/;
/** 글 안 서식: 굵게 · 기울임 · 취소선 · 코드 · 링크 · 인라인 수식 */
const INLINE =
  /\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|(?<![\\$])\$[^\s$](?:[^$\n]*?[^\s$])?\$(?!\d|\$)/;

/** 마크다운으로 보이는 글인지 — 평범한 글은 지금처럼 줄마다 문단으로 붙인다 */
export function looksLikeMarkdown(text: string): boolean {
  const lines = text.split(/\r\n?|\n/);
  return lines.some((l) => BLOCK_LINE.test(l)) || INLINE.test(text);
}

/**
 * 수식은 marked에 넘기기 전에 글자 토큰으로 바꿔 둔다. marked가 \{ 나 \\ 같은 역슬래시를
 * 풀어 버리면 LaTeX가 깨지기 때문이다. 코드 울타리·코드 span 안의 $는 건드리지 않는다.
 * 블록: 줄 맨 앞 `$$`·줄바꿈·`$$` (내보내기 형식). 인라인: `$x$` (앞뒤가 공백이 아니고 뒤에 숫자가 오지 않아야 한다 —
 * `$5 and $10`은 수식이 아니다).
 */
const MATH_OR_CODE =
  /(?<fence>^[ \t]{0,3}(?<fc>`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]{0,3}\k<fc>[ \t]*$)|(?<span>(?<bt>`+)[^`\n]+?\k<bt>(?!`))|(?<bmath>^\$\$\n(?<bl>[\s\S]*?)\n\$\$[ \t]*$)|(?<imath>(?<![\\$])\$(?<il>[^\s$](?:[^$\n]*?[^\s$])?)\$(?!\d|\$))/gm;

type MathSlot = { block: boolean; latex: string };

function protectMath(text: string): { text: string; slots: MathSlot[] } {
  const slots: MathSlot[] = [];
  const out = text.replace(MATH_OR_CODE, (...args) => {
    const groups = args[args.length - 1] as Record<string, string | undefined>;
    if (groups.fence || groups.span) return args[0] as string;
    if (groups.bmath !== undefined) {
      slots.push({ block: true, latex: groups.bl ?? "" });
      return `\n\nCETUSMATHB${slots.length - 1}END\n\n`;
    }
    slots.push({ block: false, latex: groups.il ?? "" });
    return `CETUSMATHI${slots.length - 1}END`;
  });
  return { text: out, slots };
}

/** 글자 노드 안에서 패턴에 맞는 곳을 make가 돌려준 요소로 바꾼다 (코드·코드 블록 안은 건너뛴다) */
function replaceInText(
  root: HTMLElement,
  pattern: RegExp,
  make: (match: RegExpExecArray) => Element | null,
): void {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n as Text;
    if (!text.parentElement?.closest("code,pre")) texts.push(text);
  }
  for (const text of texts) {
    const value = text.data;
    const re = new RegExp(pattern.source, pattern.flags);
    const frag = doc.createDocumentFragment();
    let last = 0;
    let changed = false;
    for (let m = re.exec(value); m; m = re.exec(value)) {
      const el = make(m);
      if (!el) continue;
      changed = true;
      frag.append(value.slice(last, m.index), el);
      last = m.index + m[0].length;
    }
    if (!changed) continue;
    frag.append(value.slice(last));
    text.replaceWith(frag);
  }
}

/** 보존해 둔 수식 토큰을 수식 노드(div·span[data-type=…], 원래 LaTeX는 data-latex)로 되돌린다 */
function restoreMath(root: HTMLElement, slots: MathSlot[]): void {
  const doc = root.ownerDocument;
  for (const p of [...root.querySelectorAll("p")]) {
    const m = /^CETUSMATHB(\d+)END$/.exec(p.textContent?.trim() ?? "");
    const slot = m && slots[Number(m[1])];
    if (!slot?.block) continue;
    const div = doc.createElement("div");
    div.setAttribute("data-type", "block-math");
    div.setAttribute("data-latex", slot.latex);
    p.replaceWith(div);
  }
  replaceInText(root, /CETUSMATHI(\d+)END/g, (m) => {
    const slot = slots[Number(m[1])];
    if (!slot || slot.block) return null;
    const span = doc.createElement("span");
    span.setAttribute("data-type", "inline-math");
    span.setAttribute("data-latex", slot.latex);
    return span;
  });
}

/** `@2026-11-27` (내보내기 날짜 칩 형식) → 날짜 칩. 실제 없는 날짜는 글자 그대로 둔다 */
function restoreDateChips(root: HTMLElement): void {
  replaceInText(root, /(?<![\w@])@(\d{4}-\d{2}-\d{2})(?![\w-])/g, (m) => {
    const date = m[1]!;
    if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return null;
    const span = root.ownerDocument.createElement("span");
    span.setAttribute("data-type", "date-chip");
    span.setAttribute("data-date", date);
    span.textContent = m[0];
    return span;
  });
}

/**
 * `<details><summary><h2>제목</h2></summary>…` (내보내기 형식 · 토글 제목) → 토글 제목 블록.
 * 요약 안에 H1–H3 하나만 있을 때만 바꾼다. 그 밖의 토글은 기존 details 변환을 따른다.
 */
function toggleHeadingsFromDetails(root: HTMLElement): void {
  for (const details of [...root.querySelectorAll("details")]) {
    const summary = details.firstElementChild;
    const heading = summary?.tagName === "SUMMARY" ? summary.firstElementChild : null;
    if (!heading || !/^H[1-3]$/.test(heading.tagName) || summary?.children.length !== 1) continue;
    const doc = root.ownerDocument;
    const h = doc.createElement(heading.tagName.toLowerCase());
    h.textContent = heading.textContent;
    const box = doc.createElement("div");
    box.setAttribute("data-type", "toggleHeading");
    box.setAttribute("data-open", String(details.hasAttribute("open")));
    box.append(h, ...[...details.childNodes].filter((n) => n !== summary));
    details.replaceWith(box);
  }
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

/** 열 표지 주석 (내보내기 형식 · DATA-04): `<!-- cetusnote:column width=2 -->` … `<!-- /cetusnote:column -->` */
const COLUMN_MARK = /^\s*(\/)?cetusnote:(columns?)(?:\s+width=([\d.]+))?\s*$/;

function columnMark(node: ChildNode): { close: boolean; kind: string; width: number } | null {
  if (node.nodeType !== Node.COMMENT_NODE) return null;
  const m = COLUMN_MARK.exec(node.textContent ?? "");
  return m ? { close: Boolean(m[1]), kind: m[2]!, width: Number(m[3]) || 1 } : null;
}

function newColumn(doc: Document, width: number): HTMLElement {
  const col = doc.createElement("div");
  col.setAttribute("data-type", "column");
  col.setAttribute("data-width", String(width));
  return col;
}

/**
 * 열 표지 주석 사이의 블록을 열 블록(div[data-type=columns] > div[data-type=column])으로 묶는다 (DATA-04).
 * 열 안의 중첩 열은 재귀로 묶는다. 짝이 없는 표지는 주석 그대로 둔다.
 */
function columnsFromComments(parent: Element): void {
  const doc = parent.ownerDocument;
  const nodes = [...parent.childNodes];
  const out: ChildNode[] = [];
  const boxes: Element[] = [];
  let i = 0;
  while (i < nodes.length) {
    const mark = columnMark(nodes[i]!);
    if (mark?.kind !== "columns" || mark.close) {
      out.push(nodes[i]!);
      i++;
      continue;
    }
    // 짝이 되는 /columns 찾기 (중첩 깊이)
    let depth = 0;
    let end = -1;
    for (let j = i; j < nodes.length && end < 0; j++) {
      const m = columnMark(nodes[j]!);
      if (m?.kind !== "columns") continue;
      depth += m.close ? -1 : 1;
      if (depth === 0) end = j;
    }
    if (end < 0) {
      out.push(nodes[i]!);
      i++;
      continue;
    }
    const box = doc.createElement("div");
    box.setAttribute("data-type", "columns");
    let column: HTMLElement | null = null;
    let inner = 0;
    for (const node of nodes.slice(i + 1, end)) {
      const m = columnMark(node);
      if (m?.kind === "columns") inner += m.close ? -1 : 1;
      if (inner === 0 && m?.kind === "column") {
        if (m.close) {
          column = null;
        } else {
          column = newColumn(doc, m.width);
          box.append(column);
        }
        continue;
      }
      // 열 표지 밖의 글(손으로 고친 파일)은 너비 1짜리 열로 감싼다. 블록 사이 빈 줄은 버린다
      if (!column) {
        if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue;
        column = newColumn(doc, 1);
        box.append(column);
      }
      column.append(node);
    }
    for (const col of box.children) {
      const filled = [...col.childNodes].some(
        (n) => n.nodeType === Node.ELEMENT_NODE || !!n.textContent?.trim(),
      );
      // 빈 열도 에디터 스키마(block+)에 맞게 빈 문단을 하나 둔다
      if (!filled) col.append(doc.createElement("p"));
      columnsFromComments(col);
    }
    boxes.push(box);
    out.push(box);
    i = end + 1;
  }
  // 열 밖의 요소(인용·목록 안 등)에 있는 표지도 같은 방식으로 묶는다
  for (const node of out) {
    if (node.nodeType === Node.ELEMENT_NODE && !boxes.includes(node as Element))
      columnsFromComments(node as Element);
  }
  if (boxes.length) parent.replaceChildren(...out);
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
  const protectedMath = protectMath(text.replace(/\r\n?/g, "\n"));
  const html = marked.parse(protectedMath.text) as string;
  const doc = new window.DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  // 토글 제목 (<details><summary><h2>…) 과 수식·날짜 칩 (DATA-04 왕복)
  toggleHeadingsFromDetails(doc.body);
  // 열 표지 주석 → 열 블록 (DATA-04 왕복). 콜아웃보다 먼저 묶어야 인용 안의 열도 이어진다
  columnsFromComments(doc.body);
  restoreMath(doc.body, protectedMath.slots);
  restoreDateChips(doc.body);
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
