import { msg } from "@/lib/i18n";
/**
 * 문서 가져오기(DATA-08) — 파일 글을 페이지 머리(제목·아이콘·태그)와 본문으로 나눈다.
 * 이 앱의 내보내기(DATA-04) 모양을 되돌릴 수 있게 맞췄다:
 * `---` front matter(title, tags) → `# 이모지 제목` → 본문.
 * 본문을 블록으로 바꾸는 일은 에디터 쪽(markdown-import)이 한다.
 */

export type ParsedMarkdown = {
  title: string;
  /** 제목 앞 이모지 (없으면 null) */
  icon: string | null;
  tags: string[];
  /** front matter의 원래 페이지 id (CetusNote가 내보낸 파일에만 있다). 페이지 링크를 잇는 데 쓴다 */
  id: string | null;
  body: string;
};

const TITLE_MAX = 200;
/** 제목 맨 앞의 이모지 하나(합자·변형 선택자 포함) + 공백 */
const LEADING_EMOJI =
  /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s+/u;
/** 내보내기가 글자 속 마크다운 기호 앞에 붙인 역슬래시 */
const unescape = (s: string) => s.replace(/\\([\\`*_[\]~$<#>-])/g, "$1");

/** YAML 한 줄 값: "따옴표"(JSON) 또는 그대로 */
function scalar(raw: string): string {
  const v = raw.trim();
  if (v.startsWith('"')) {
    try {
      return String(JSON.parse(v));
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

/**
 * YAML 흐름 목록 `[a, "b, c"]`의 안쪽을 나눈다. 따옴표 안의 쉼표는 나누지 않는다.
 */
function flowItems(inner: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]!;
    if (quote) {
      cur += c;
      if (quote === '"' && c === "\\" && i + 1 < inner.length) {
        cur += inner[++i]!;
      } else if (c === quote) {
        quote = null;
      }
    } else if (c === '"' || c === "'") {
      quote = c;
      cur += c;
    } else if (c === ",") {
      parts.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  parts.push(cur);
  return parts.map((p) => scalar(p).trim()).filter(Boolean);
}

/** `tags: [a, "b, c"]` 같은 한 줄 값. 대괄호가 없으면 YAML 한 값(태그 하나)으로 읽는다 */
function list(raw: string): string[] {
  const v = raw.trim();
  if (v.startsWith("[") && v.endsWith("]")) return flowItems(v.slice(1, -1));
  const one = scalar(v).trim();
  return one ? [one] : [];
}

/** 맨 앞 `---` … `---` 블록. 없으면 null. `key:` 뒤의 `- 항목` 줄은 `blocks`에 모은다 */
function frontMatter(
  text: string,
): { fields: Map<string, string>; blocks: Map<string, string[]>; rest: string } | null {
  const m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!m) return null;
  const fields = new Map<string, string>();
  const blocks = new Map<string, string[]>();
  let open: string | null = null;
  for (const line of m[1]!.split("\n")) {
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && open !== null) {
      blocks.get(open)!.push(item[1]!);
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    open = null;
    if (kv) {
      const key = kv[1]!.toLowerCase();
      fields.set(key, kv[2]!);
      if (kv[2]!.trim() === "") {
        open = key;
        blocks.set(key, []);
      }
    }
  }
  return { fields, blocks, rest: text.slice(m[0].length) };
}

export function parseMarkdownFile(name: string, raw: string): ParsedMarkdown {
  let text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  let title: string | null = null;
  let tags: string[] = [];
  let id: string | null = null;
  const front = frontMatter(text);
  if (front) {
    text = front.rest;
    const t = front.fields.get("title");
    if (t !== undefined) title = scalar(t).trim() || null;
    const tagBlock = front.blocks.get("tags");
    const tg = front.fields.get("tags");
    if (tagBlock !== undefined) {
      // `tags:` 아래 `- 항목` 줄들
      tags = [...new Set(tagBlock.map((s) => scalar(s).trim()).filter(Boolean))];
    } else if (tg !== undefined) {
      tags = [...new Set(list(tg))];
    }
    const i = front.fields.get("id");
    if (i !== undefined) id = scalar(i).trim() || null;
  }
  // 본문 맨 앞의 H1은 페이지 제목으로 (front matter 제목이 따로 있고 다르면 본문에 남긴다)
  let icon: string | null = null;
  const h1 = /^\s*#[ \t]+(.+?)[ \t]*#*[ \t]*(?:\n|$)/.exec(text);
  if (h1) {
    let heading = h1[1]!.trim();
    const emoji = LEADING_EMOJI.exec(heading);
    const plain = unescape(emoji ? heading.slice(emoji[0].length) : heading).trim();
    if (title === null || plain === title) {
      if (emoji) icon = emoji[1]!;
      heading = plain;
      title ??= heading;
      text = text.slice(h1[0].length);
    }
  }
  return {
    title: (title || name.trim() || msg().features.untitled).slice(0, TITLE_MAX),
    icon,
    tags,
    id,
    body: text.replace(/^\s*\n/, ""),
  };
}
