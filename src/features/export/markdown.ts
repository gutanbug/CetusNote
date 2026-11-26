import { emojiOf } from "@/lib/page-icon";
import type { Page } from "@/lib/storage";
import { detectLanguage } from "@/lib/code-language";
import { calloutTypeOf } from "@/lib/callout-type";
import { collectHeadings } from "@/lib/toc";
import { capUtf8Bytes } from "@/lib/utf8-cap";
import { emojis, shortcodeToEmoji } from "@tiptap/extension-emoji";

/**
 * Tiptap JSON → Markdown (DATA-04). GitHub 호환(2026-11-19 사용자 결정):
 * - 콜아웃 → 이모지를 붙인 인용, 토글 → <details>, 밑줄·하이라이트·첨자 → <u> <mark> <sup> <sub>
 * - 페이지 파일은 front matter(id·tags·created·updated·icon)를 맨 위에 쓴다. 끌 수 있다(옵션, 기본 켬).
 *   그 아래 `# 아이콘 제목` 한 번, 그 아래 본문. 본문 맨 앞이 같은 제목의 H1이면 그 줄을 머리로 써서
 *   제목이 두 번 나오지 않게 한다.
 * - 콜아웃 → `> [!NOTE] 💡 …` (Obsidian·GitHub 종류 이름, lib/callout-type).
 * - 글자색은 Markdown에 없어 버린다. 모르는 블록은 안쪽 내용만 살린다.
 */

type Mark = { type: string; attrs?: Record<string, unknown> };
export type MdNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: MdNode[];
  text?: string;
  marks?: Mark[];
};

// ── 글자 ───────────────────────────────────────────────

/** 본문 글자의 Markdown 기호를 이스케이프한다 */
/** 복사(클립보드 글자)에서는 끈다 — 다른 앱에 붙였을 때 \_ \* 같은 역슬래시가 보이지 않게 */
let escaping = true;

/** 목차 블록이 훑을 문서(또는 조각). 내보내는 동안만 있다 */
let tocRoot: MdNode | undefined;

function escapeText(text: string): string {
  if (!escaping) return text;
  return text.replace(/[\\`*_[\]~$<]/g, "\\$&");
}

/** 줄 맨 앞에서 블록 기호로 읽히는 글자(# > - + 1. ---)를 이스케이프한다 */
function escapeLineStart(line: string): string {
  return line
    .replace(/^(\s*)([#>+])/, "$1\\$2")
    .replace(/^(\s*)-(\s|-|$)/, "$1\\-$2")
    .replace(/^(\s*)(\d+)([.)])(\s|$)/, "$1$2\\$3$4");
}

function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((m) => m.length));
  const fence = "`".repeat(longest + 1);
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

function linkTarget(href: string): string {
  return /[\s()<>]/.test(href) ? `<${href.replace(/[<>]/g, encodeURIComponent)}>` : href;
}

/** 바깥 → 안쪽 순서. code는 따로(다른 마크와 겹치지 않는다) */
const MARK_ORDER = [
  "link",
  "bold",
  "italic",
  "strike",
  "underline",
  "highlight",
  "superscript",
  "subscript",
];
const OPEN: Record<string, (m: Mark) => string> = {
  link: () => "[",
  bold: () => "**",
  italic: () => "*",
  strike: () => "~~",
  underline: () => "<u>",
  highlight: () => "<mark>",
  superscript: () => "<sup>",
  subscript: () => "<sub>",
};
const CLOSE: Record<string, (m: Mark) => string> = {
  link: (m) => `](${linkTarget(String(m.attrs?.href ?? ""))})`,
  bold: () => "**",
  italic: () => "*",
  strike: () => "~~",
  underline: () => "</u>",
  highlight: () => "</mark>",
  superscript: () => "</sup>",
  subscript: () => "</sub>",
};

const sameMark = (a: Mark, b: Mark) =>
  a.type === b.type && (a.type !== "link" || a.attrs?.href === b.attrs?.href);

type InlineMode = "block" | "cell" | "heading";

/** 내보내는 동안 멘션의 지금 제목을 찾는다(없으면 저장된 label) — pageToMarkdown이 잠깐 정한다 */
let mentionTitle: ((id: string) => string | undefined) | undefined;
/** 이 페이지의 경로(맨 위 → 이 페이지 제목). 경로 표시 블록(EDIT-30)이 쓴다 — 블록은 글로 `A › B`가 된다 */
let pagePath: string[] | undefined;
/** 이미지·첨부 경로를 내보낼 경로로 바꾼다(DATA-04 단일 페이지). 없으면 워크스페이스 경로 그대로 */
let assetHref: ((src: string) => string) | undefined;

/**
 * 인라인 내용. 마크를 스택으로 열고 닫아, 이어진 굵게 구간을 하나로 묶는다(`**a**` + `**b**` → `**ab**`).
 * 마크 경계의 공백은 기호 바깥으로 뺀다(`** 굵게**`는 굵게로 읽히지 않으므로).
 */
function inline(nodes: MdNode[] = [], mode: InlineMode = "block"): string {
  let out = "";
  let pendingSpace = "";
  const open: Mark[] = [];

  const emit = (s: string) => {
    out += pendingSpace + s;
    pendingSpace = "";
  };
  const closeAll = () => {
    while (open.length) {
      const m = open.pop()!;
      out += CLOSE[m.type]!(m);
    }
  };

  for (const node of nodes) {
    const marks = (node.marks ?? [])
      .filter((m) => MARK_ORDER.includes(m.type))
      .sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
    let keep = 0;
    while (keep < open.length && keep < marks.length && sameMark(open[keep]!, marks[keep]!)) keep++;
    // 닫을 마크는 공백 앞에서 닫는다
    while (open.length > keep) {
      const m = open.pop()!;
      out += CLOSE[m.type]!(m);
    }

    let text: string;
    if (node.type === "text") {
      const raw = node.text ?? "";
      const isCode = node.marks?.some((m) => m.type === "code");
      text = isCode ? codeSpan(raw) : escapeText(raw);
    } else if (node.type === "hardBreak") {
      text = mode === "block" ? "\\\n" : mode === "cell" ? "<br>" : " ";
    } else if (node.type === "inlineMath") {
      text = `$${String(node.attrs?.latex ?? "")}$`;
    } else if (node.type === "pageMention") {
      // 다른 앱에서도 글이 남게 링크로: [제목](cetusnote://page/<id>)
      const id = String(node.attrs?.id ?? "");
      const title = mentionTitle?.(id) ?? String(node.attrs?.label ?? "");
      text = `[${escapeText(title || "제목 없음")}](cetusnote://page/${id})`;
    } else if (node.type === "dateChip") {
      // 날짜 칩(EDIT-36)은 YYYY-MM-DD 글자로 (알림·시각은 글로 옮기지 않는다)
      text = String(node.attrs?.date ?? "");
    } else if (node.type === "emoji") {
      const name = String(node.attrs?.name ?? "");
      text = shortcodeToEmoji(name, emojis)?.emoji ?? `:${name}:`;
    } else {
      text = inline(node.content, mode);
    }

    // 새로 여는 마크는 앞 공백 뒤에서 연다
    const lead = /^\s*/.exec(text)![0];
    const trail = /\s*$/.exec(text.slice(lead.length))![0];
    const body = text.slice(lead.length, text.length - trail.length);
    if (!body) {
      pendingSpace += text;
      continue;
    }
    emit(lead);
    for (const m of marks.slice(keep)) {
      out += OPEN[m.type]!(m);
      open.push(m);
    }
    out += body;
    pendingSpace = trail;
  }
  closeAll();
  out += pendingSpace;
  return out;
}

// ── 블록 ───────────────────────────────────────────────

const indentLines = (text: string, first: string, rest: string) =>
  text
    .split("\n")
    .map((line, i) => (i === 0 ? first : line ? rest : rest.trimEnd()) + line)
    .join("\n");

function blocks(nodes: MdNode[] = [], sep = "\n\n"): string {
  return nodes
    .map(block)
    .filter((b) => b !== "")
    .join(sep);
}

function paragraph(node: MdNode): string {
  return inline(node.content)
    .split("\n")
    .map((line) => escapeLineStart(line))
    .join("\n");
}

function listItem(node: MdNode, marker: string): string {
  const [first, ...rest] = node.content ?? [];
  const head = first?.type === "paragraph" ? paragraph(first) : first ? block(first) : "";
  const tail = rest.map(block).filter(Boolean);
  const body = [head, ...tail].join("\n");
  return indentLines(body, marker, " ".repeat(marker.length));
}

function table(node: MdNode): string {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? [])
        .map((p) => inline(p.content, "cell"))
        .join("<br>")
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ")
        .trim(),
    ),
  );
  if (!rows.length) return "";
  const cols = Math.max(...rows.map((r) => r.length));
  const line = (cells: string[]) =>
    `| ${Array.from({ length: cols }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  return [line(rows[0]!), line(Array(cols).fill("---")), ...rows.slice(1).map(line)].join("\n");
}

function block(node: MdNode): string {
  switch (node.type) {
    case "paragraph":
      return paragraph(node);
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `${"#".repeat(level)} ${inline(node.content, "heading")}`;
    }
    case "bulletList":
      return (node.content ?? []).map((li) => listItem(li, "- ")).join("\n");
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? []).map((li, i) => listItem(li, `${start + i}. `)).join("\n");
    }
    case "taskList":
      return (node.content ?? [])
        .map((li) => listItem(li, li.attrs?.checked ? "- [x] " : "- [ ] "))
        .join("\n");
    case "blockquote":
      return indentLines(blocks(node.content), "> ", "> ");
    case "callout": {
      // Obsidian·GitHub 콜아웃: `> [!NOTE] 💡 …`. 색은 종류 이름으로 남긴다 (lib/callout-type)
      const emoji = String(node.attrs?.emoji ?? "💡");
      const type = calloutTypeOf(String(node.attrs?.color ?? "blue"));
      return indentLines(blocks(node.content), `> [!${type}] ${emoji} `, "> ");
    }
    case "codeBlock": {
      // 끝의 줄바꿈 하나는 닫는 울타리 앞 빈 줄이 되므로 뺀다
      const code = (node.content ?? [])
        .map((t) => t.text ?? "")
        .join("")
        .replace(/\n$/, "");
      const longest = Math.max(2, ...(code.match(/`+/g) ?? []).map((m) => m.length));
      const fence = "`".repeat(longest + 1);
      // 자동 감지 블록(null)은 내보낼 때 추측한 언어를 적는다
      const lang = String(node.attrs?.language ?? detectLanguage(code) ?? "");
      return `${fence}${lang && lang !== "plaintext" ? lang : ""}\n${code}\n${fence}`;
    }
    case "horizontalRule":
      return "---";
    case "image": {
      // 워크스페이스 기준 경로 그대로. 단일 페이지 내보내기는 assetHref로 바꾼다 (이미지는 assets/에 복사)
      const alt = (node.content ?? []).map((t) => t.text ?? "").join("");
      // 아직 내려받는 중인 웹 이미지(EDIT-24)는 원래 웹 주소로
      const remote = String(node.attrs?.remote ?? "");
      const own = node.attrs?.src;
      const src = own != null ? String(own) : /^https?:\/\//i.test(remote) ? remote : "";
      const href = own != null && assetHref ? assetHref(src) : src;
      return `![${escapeText(alt)}](${linkTarget(href)})`;
    }
    case "attachment": {
      // 파일 첨부는 워크스페이스 기준 경로 링크 (EDIT-31~33, ADR-025). 단일 페이지 내보내기는 assetHref로 바꾼다
      const name = String(node.attrs?.name ?? "") || "첨부";
      const path = String(node.attrs?.path ?? "");
      return `[${escapeText(name)}](${linkTarget(assetHref ? assetHref(path) : path)})`;
    }
    case "blockMath":
      return `$$\n${String(node.attrs?.latex ?? "")}\n$$`;
    case "details": {
      const summary = node.content?.find((n) => n.type === "detailsSummary");
      const content = node.content?.find((n) => n.type === "detailsContent");
      const body = blocks(content?.content);
      return [
        node.attrs?.open ? "<details open>" : "<details>",
        `<summary>${inline(summary?.content, "heading")}</summary>`,
        ...(body ? ["", body, ""] : []),
        "</details>",
      ].join("\n");
    }
    case "toggleHeading": {
      // 제목 줄이 요약이고 나머지 블록이 접히는 내용 (EDIT-28). 제목 단계(H1–H3)는 글로 남지 않는다 (손실)
      const [head, ...rest] = node.content ?? [];
      const summary = head?.type === "heading" ? inline(head.content, "heading") : "";
      const body = blocks(rest);
      return [
        node.attrs?.open !== false ? "<details open>" : "<details>",
        `<summary>${summary}</summary>`,
        ...(body ? ["", body, ""] : []),
        "</details>",
      ].join("\n");
    }
    case "columns":
      // 열을 왼쪽에서 오른쪽, 위에서 아래 순서로 이어 쓴다 (EDIT-34). 가로 배치·열 폭은 글로 남지 않는다 (손실)
      return blocks((node.content ?? []).flatMap((col) => col.content ?? []));
    case "subpage": {
      // 하위 페이지 카드 → 페이지 링크 (EDIT-29)
      const id = String(node.attrs?.pageId ?? "");
      const title = mentionTitle?.(id) ?? "하위 페이지";
      return `[${escapeText(title || "제목 없음")}](cetusnote://page/${id})`;
    }
    case "breadcrumb":
      // 경로 표시 블록 (EDIT-30): 경로를 `A › B`로. 경로를 모르면(복사 등) 블록은 빠진다
      return pagePath?.length ? pagePath.map((t) => escapeText(t || "제목 없음")).join(" › ") : "";
    case "tableOfContents":
      return tocList();
    case "table":
      return table(node);
    case "text":
    case "hardBreak":
    case "inlineMath":
    case "emoji":
    case "pageMention":
    case "dateChip":
      return inline([node]);
    default:
      // 모르는 블록(이후 버전의 블록 등): 안쪽 내용만 살린다
      return node.content ? blocks(node.content) : "";
  }
}

/**
 * 목차 블록 (ED-TableOfContents): 본문 H1–H3를 들여쓴 목록으로, 앵커는 GitHub 방식.
 * 제목이 하나도 없으면 아무것도 쓰지 않는다(블록이 빠진다).
 */
function tocList(): string {
  return collectHeadings(tocRoot)
    .map((h) => `${"  ".repeat(h.depth)}- [${inline(h.node.content, "heading")}](#${h.slug})`)
    .join("\n");
}

// ── 페이지 ─────────────────────────────────────────────

/**
 * 문서(Tiptap JSON)만 Markdown으로.
 * escape: false면 글자 속 마크다운 기호를 이스케이프하지 않는다(복사해 다른 앱에 붙일 글자, EDIT-26).
 */
export function docToMarkdown(
  doc: MdNode,
  options: {
    escape?: boolean;
    titleOf?: (id: string) => string | undefined;
    path?: string[];
  } = {},
): string {
  escaping = options.escape ?? true;
  mentionTitle = options.titleOf;
  pagePath = options.path;
  tocRoot = doc;
  try {
    return blocks(doc.content);
  } finally {
    escaping = true;
    mentionTitle = undefined;
    pagePath = undefined;
    tocRoot = undefined;
  }
}

/**
 * 페이지 전체: `# 아이콘 제목` + 본문. 끝은 줄바꿈 하나.
 * 본문 맨 앞 H1이 제목과 같으면 그 줄은 머리에 합쳐 한 번만 쓴다.
 * titleOf를 주면 멘션을 지금 제목으로 적는다(없거나 undefined면 넣을 때의 제목).
 */
export function pageToMarkdown(
  page: Page,
  titleOf?: (id: string) => string | undefined,
  path?: string[],
  options: PageMarkdownOptions = {},
): string {
  mentionTitle = titleOf;
  pagePath = path;
  assetHref = options.assetHref;
  try {
    return pageMarkdown(page, options);
  } finally {
    assetHref = undefined;
    mentionTitle = undefined;
    pagePath = undefined;
    tocRoot = undefined;
  }
}

/** 노드 안의 글자만 이어 붙인다 (제목 비교용) */
function plainText(node: MdNode): string {
  return node.text ?? (node.content ?? []).map(plainText).join("");
}

export type PageMarkdownOptions = {
  /** 이미지·첨부의 워크스페이스 경로를 내보낼 상대 경로로 바꾼다 (DATA-04, 단일 페이지 내보내기) */
  assetHref?: (src: string) => string;
  /** 맨 위에 front matter(id·태그·만든·고친 날짜·아이콘)를 쓴다. 기본 켬 (DATA-04, 사용자 결정) */
  frontMatter?: boolean;
};

/**
 * front matter 블록. 값은 JSON 문자열로 적어 YAML 큰따옴표 문자열과 같게 읽힌다.
 * 다시 가져올 때 `id`로 페이지 링크(cetusnote://page/<id>)를 잇고, `tags`로 태그를 되살린다.
 */
function frontMatterOf(page: Page): string {
  const emoji = emojiOf(page.icon);
  const lines = [
    `id: ${JSON.stringify(page.id)}`,
    `tags: [${page.props.tags.map((t) => JSON.stringify(t)).join(", ")}]`,
    `created: ${JSON.stringify(page.createdAt)}`,
    `updated: ${JSON.stringify(page.updatedAt)}`,
    ...(emoji ? [`icon: ${JSON.stringify(emoji)}`] : []),
  ];
  return `---\n${lines.join("\n")}\n---\n\n`;
}

function pageMarkdown(page: Page, options: PageMarkdownOptions = {}): string {
  const title = page.title.trim() || "제목 없음";
  const nodes = (page.content as MdNode).content ?? [];
  const [first, ...rest] = nodes;
  const sameTitle =
    first?.type === "heading" &&
    Number(first.attrs?.level ?? 1) === 1 &&
    plainText(first).trim() === title;
  // 아이콘·이미지 아이콘(PAGE-10)은 글로 옮길 수 없어 이모지만 넣는다
  const emoji = emojiOf(page.icon);
  const heading = `# ${emoji ? `${emoji} ` : ""}${escapeText(title)}`;
  // 목차는 본문에 실제로 내보내는 제목만 가리킨다(머리로 합친 첫 H1은 빼고)
  tocRoot = { content: sameTitle ? rest : nodes };
  const body = blocks(sameTitle ? rest : nodes);
  const text = [heading, body].filter(Boolean).join("\n\n") + "\n";
  return options.frontMatter === false ? text : frontMatterOf(page) + text;
}

/** `.md`(3바이트)를 뺀 파일 이름 바이트 상한. 파일 시스템 한도는 255바이트 */
const MD_NAME_MAX_BYTES = 252;

/** 저장 대화상자의 기본 파일 이름. 파일 이름에 못 쓰는 글자를 빼고, `.md`를 포함해 255바이트(UTF-8)를 넘기지 않는다 */
export function markdownFileName(page: Pick<Page, "title">): string {
  const base = capUtf8Bytes(
    page.title
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+/, ""),
    MD_NAME_MAX_BYTES,
  ).trim();
  return `${base || "제목 없음"}.md`;
}
