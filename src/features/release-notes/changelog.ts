import changelog from "../../../CHANGELOG.md?raw";

/** 빌드할 때 묶인 CHANGELOG.md 원문. 오프라인에서도 「릴리스 노트 보기」가 된다 (SYS-12) */
export const CHANGELOG_TEXT: string = changelog;

export type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

/** 「## [version]」 섹션 본문. 없거나 항목이 없으면 null (scripts/changelog.mjs와 같은 규칙) */
export function extractSection(markdown: string, version: string): string | null {
  const lines = markdown.split("\n");
  const at = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (at < 0) return null;
  const body: string[] = [];
  for (let i = at + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## [") || /^\[[^\]]+\]:\s+\S/.test(lines[i])) break;
    body.push(lines[i]);
  }
  const hasEntries = body.some((line) => line.trim() !== "" && !/^#{1,6}\s/.test(line));
  return hasEntries ? body.join("\n").trim() : null;
}

/** 릴리스 노트에 쓰는 Markdown의 제목·목록·문단만 읽는다 (화면에 그릴 블록으로 나눈다) */
export function parseBlocks(section: string): Block[] {
  const blocks: Block[] = [];
  let list: string[] | null = null;
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: "list", items: list });
    list = null;
  };

  for (const raw of section.split("\n")) {
    const line = raw.trimEnd();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", text: heading[1] });
    } else if (item) {
      flushParagraph();
      list ??= [];
      list.push(item[1]);
    } else if (line.trim() === "") {
      flushParagraph();
      flushList();
    } else if (list && /^\s+\S/.test(line)) {
      // 들여쓴 줄은 앞 항목의 이어지는 글
      list[list.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** 굵은 글씨·코드·링크만 나눈다. http(s) 링크만 링크가 되고, 나머지는 글로 둔다 */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ kind: "text", text: text.slice(last, index) });
    if (m[1] !== undefined && /^https?:\/\//.test(m[2])) {
      out.push({ kind: "link", text: m[1], href: m[2] });
    } else if (m[1] !== undefined) {
      out.push({ kind: "text", text: m[1] });
    } else if (m[3] !== undefined) {
      out.push({ kind: "bold", text: m[3] });
    } else {
      out.push({ kind: "code", text: m[4] });
    }
    last = index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}
