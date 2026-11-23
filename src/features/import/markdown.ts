/**
 * Markdown 가져오기(DATA-08) — 파일 글을 페이지 머리(제목·아이콘·태그)와 본문으로 나눈다.
 * 이 앱의 내보내기(DATA-04) 모양을 되돌릴 수 있게 맞췄다:
 * `---` front matter(title, tags) → `# 이모지 제목` → 본문.
 * 본문을 블록으로 바꾸는 일은 에디터 쪽(markdown-import)이 한다.
 */

export type ParsedMarkdown = {
  title: string;
  /** 제목 앞 이모지 (없으면 null) */
  icon: string | null;
  tags: string[];
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

/** `[a, "b"]` 또는 `a, b` */
function list(raw: string): string[] {
  const v = raw.trim().replace(/^\[|\]$/g, "");
  return v
    .split(",")
    .map(scalar)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 맨 앞 `---` … `---` 블록. 없으면 null */
function frontMatter(text: string): { fields: Map<string, string>; rest: string } | null {
  const m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!m) return null;
  const fields = new Map<string, string>();
  for (const line of m[1]!.split("\n")) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) fields.set(kv[1]!.toLowerCase(), kv[2]!);
  }
  return { fields, rest: text.slice(m[0].length) };
}

export function parseMarkdownFile(name: string, raw: string): ParsedMarkdown {
  let text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  let title: string | null = null;
  let tags: string[] = [];
  const front = frontMatter(text);
  if (front) {
    text = front.rest;
    const t = front.fields.get("title");
    if (t !== undefined) title = scalar(t).trim() || null;
    const tg = front.fields.get("tags");
    if (tg !== undefined) tags = [...new Set(list(tg))];
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
    title: (title || name.trim() || "제목 없음").slice(0, TITLE_MAX),
    icon,
    tags,
    body: text.replace(/^\s*\n/, ""),
  };
}
