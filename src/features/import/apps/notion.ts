/**
 * Notion「Markdown & CSV」내보내기 가져오기 (DATA-11). 압축을 푼 파일 목록을 받는다(zip 풀기는 호출하는 쪽).
 * - 이름의 ` <32자리 id>`·UUID 꼬리는 뺀다. `X.md` + `X/` 폴더는 X 문서의 하위가 된다(tree.placeNodes).
 * - 상대 링크: 다른 `.md` 문서는 노트 링크로, 그림은 자산으로. 웹 링크는 그대로 둔다.
 * - H1 다음 줄의 `키: 값` 묶음은 Tags(태그)만 태그로 빼고, 나머지는 본문 글로 둔다.
 * - `<aside>이모지 글</aside>` → 콜아웃 블록.
 * - CSV(데이터베이스)는 이 단계에서 가져오지 않고 건너뛴 목록에 남긴다 (컬렉션 변환은 별도 작업).
 */
import { inferColumns, parseCsv } from "./csv";
import {
  escapeHtml,
  decodeSafe,
  placeNodes,
  resolveStem,
  safeSegments,
  stemOf,
  stripNotionId,
  type ImportNode,
  type SourceFile,
} from "./tree";

export type NotionResult = { nodes: ImportNode[]; skipped: string[] };

const PAGE_EXTS = ["md", "markdown"] as const;
const HTML_EXTS = ["html", "htm"] as const;
const LINK = /(!?)\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"\n]*")?\)/g;
const EMOJI_START =
  /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*/u;

/** Notion 내보내기 → 항목 목록. CSV는 이 단계에서 건너뛴다 (데이터베이스 변환은 별도) */
export function convertNotion(files: SourceFile[]): NotionResult {
  return convertMarkdownTree(files, stripNotionId);
}

/**
 * 문서 파일(md·html)의 폴더 구조 → 항목 목록. Notion·AppFlowy·AFFiNE이 같이 쓴다.
 * clean은 이름 정리(Notion은 id 제거, 그 밖은 그대로). CSV는 건너뛴 목록에 남긴다.
 */
export function convertMarkdownTree(
  files: SourceFile[],
  clean: (name: string) => string = (n) => n,
): NotionResult {
  const skipped: string[] = [];
  const safe: SourceFile[] = [];
  const csvs: SourceFile[] = [];
  for (const f of files) {
    const segs = safeSegments(f.path);
    if (!segs) {
      skipped.push(f.path);
      continue;
    }
    const path = segs.join("/");
    if (stemOf(path, PAGE_EXTS) !== null || stemOf(path, HTML_EXTS) !== null) {
      safe.push({ path, text: f.text });
    } else if (/\.csv$/i.test(path)) csvs.push({ path, text: f.text });
  }

  const stems = safe.map((f) => (stemOf(f.path, PAGE_EXTS) ?? stemOf(f.path, HTML_EXTS))!);
  // 데이터베이스: `X.csv`(또는 `X_all.csv`, 우선)는 `X` 이름의 컬렉션이 된다. 같은 이름의 문서가 있으면 건너뛴다
  const dbs = new Map<string, SourceFile>();
  for (const c of csvs) {
    const stem = c.path.replace(/\.csv$/i, "").replace(/_all$/, "");
    if (stems.includes(stem)) {
      skipped.push(c.path);
      continue;
    }
    const prev = dbs.get(stem);
    if (!prev || /_all\.csv$/i.test(c.path)) dbs.set(stem, c);
  }
  const dbStems = [...dbs.keys()];
  const placed = placeNodes([...stems, ...dbStems], clean);
  const byKey = new Map(placed.map((n) => [n.key, n]));
  const nodes: ImportNode[] = [];

  for (const file of safe) {
    const isHtml = stemOf(file.path, HTML_EXTS) !== null;
    const stem = (stemOf(file.path, PAGE_EXTS) ?? stemOf(file.path, HTML_EXTS))!;
    const dir = stem.includes("/") ? stem.slice(0, stem.lastIndexOf("/")) : "";
    const node = byKey.get(`p:${stem}`)!;
    const text = file.text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    if (isHtml) {
      nodes.push({
        key: node.key,
        parentKey: node.parentKey,
        kind: "page",
        title: node.title,
        tags: [],
        markdown: text,
        assetPaths: [],
        format: "html",
      });
      continue;
    }
    const { title, tags, body } = readHead(text);
    const assetPaths = new Set<string>();
    const markdown = transformNotionBody(body, { stems, dir, assetPaths });
    nodes.push({
      key: node.key,
      parentKey: node.parentKey,
      kind: "page",
      title: (title || node.title).slice(0, 200),
      tags,
      markdown,
      assetPaths: [...assetPaths],
    });
  }
  for (const n of placed) {
    if (n.kind === "folder")
      nodes.push({
        key: n.key,
        parentKey: n.parentKey,
        kind: "folder",
        title: n.title,
        tags: [],
        markdown: "",
        assetPaths: [],
      });
  }
  // 데이터베이스 → 컬렉션: 열 종류를 짐작하고, 같은 제목의 문서는 그 레코드로, 나머지 줄은 새 레코드로 만든다
  for (const [stem, csv] of dbs) {
    const node = byKey.get(`p:${stem}`)!;
    const rows = parseCsv(csv.text);
    const header = rows[0] ?? [""];
    const body = rows.slice(1);
    const columns = inferColumns(header, body);
    const key = `c:${stem}`;
    // 레코드(같은 폴더의 문서)는 컬렉션 아래로 옮긴다
    for (const n of nodes) if (n.parentKey === `p:${stem}`) n.parentKey = key;
    nodes.push({
      key,
      parentKey: node.parentKey,
      kind: "collection",
      title: node.title,
      tags: [],
      markdown: "",
      assetPaths: [],
      columns,
    });
    body.forEach((row, i) => {
      const cells = columns.map((_, k) => row[k + 1] ?? "");
      const title = (row[0] ?? "").trim() || "제목 없음";
      const child = nodes.find(
        (n) => n.parentKey === key && n.kind === "page" && !n.cells && n.title === title,
      );
      if (child) child.cells = cells;
      else
        nodes.push({
          key: `r:${stem}#${i}`,
          parentKey: key,
          kind: "page",
          title,
          tags: [],
          markdown: "",
          assetPaths: [],
          cells,
        });
    });
  }
  return { nodes, skipped };
}

/** 첫 H1을 제목으로 빼고, 바로 뒤의 `키: 값` 줄 묶음에서 Tags만 태그로 뺀다 */
function readHead(text: string): { title: string | null; tags: string[]; body: string } {
  const lines = text.split("\n");
  const h1 = /^#[ \t]+(.+?)[ \t]*$/.exec(lines[0] ?? "");
  if (!h1) return { title: null, tags: [], body: text };
  const title = h1[1]!.trim();
  const tags: string[] = [];
  let i = 1;
  // H1 바로 다음의 속성 줄(빈 줄 전까지)
  const rest: string[] = [];
  const props: string[] = [];
  while (i < lines.length && /^[^:\n]{1,40}:\s*\S/.test(lines[i]!)) props.push(lines[i++]!);
  for (const line of props) {
    const [, key, value] = /^([^:\n]{1,40}):\s*(.*)$/.exec(line)!;
    if (/^(tags?|태그)$/i.test(key!.trim())) {
      for (const t of value!.split(",")) if (t.trim()) tags.push(t.trim());
    } else rest.push(line);
  }
  const bodyLines = [...rest, ...lines.slice(i)];
  return { title, tags: [...new Set(tags)], body: bodyLines.join("\n").replace(/^\s*\n/, "") };
}

type Ctx = { stems: string[]; dir: string; assetPaths: Set<string> };

function transformNotionBody(body: string, ctx: Ctx): string {
  const out: string[] = [];
  const lines = body.split("\n");
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fm = /^\s*(```+|~~~+)/.exec(line);
    if (fm) {
      if (fence === null) fence = fm[1]!;
      else if (line.trimStart().startsWith(fence)) fence = null;
      out.push(line);
      continue;
    }
    if (fence !== null) {
      out.push(line);
      continue;
    }
    if (/^\s*<aside>\s*$/.test(line)) {
      const inner: string[] = [];
      while (i + 1 < lines.length && !/^\s*<\/aside>\s*$/.test(lines[i + 1]!))
        inner.push(lines[++i]!);
      if (i + 1 < lines.length) i++; // </aside>
      out.push(asideHtml(inner.join("\n").trim(), ctx));
      continue;
    }
    out.push(links(line, ctx));
  }
  return out.join("\n");
}

/** 콜아웃: 앞의 이모지를 아이콘으로, 나머지를 문단으로 */
function asideHtml(inner: string, ctx: Ctx): string {
  const m = EMOJI_START.exec(inner);
  const emoji = m ? m[1]! : "💡";
  const text = m ? inner.slice(m[0].length) : inner;
  const paras = text
    .split(/\n\s*\n|\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${links(l, ctx)}</p>`);
  if (!paras.length) paras.push("<p></p>");
  return `\n<div data-type="callout" data-emoji="${escapeHtml(emoji)}" data-color="gray">\n${paras.join("\n")}\n</div>\n`;
}

/** 한 줄의 상대 링크: `.md`는 노트 링크, 그림은 자산, 나머지(웹 주소 등)는 그대로 */
function links(line: string, ctx: Ctx): string {
  return line.replace(LINK, (whole, bang: string, label: string, href: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#") || href.startsWith("/"))
      return whole;
    const path = decodeSafe(href).split("#")[0]!;
    if (bang) {
      const joined = safeSegments(ctx.dir ? `${ctx.dir}/${path}` : path);
      if (!joined) return escapeHtml(label);
      const rel = joined.join("/");
      ctx.assetPaths.add(rel);
      return `![${label}](<${rel}>)`;
    }
    if (/\.md$/i.test(path)) {
      const stem = resolveStem(path.replace(/\.md$/i, ""), ctx.stems, ctx.dir, stripNotionId);
      if (stem)
        return `<a data-page-mention="p:${escapeHtml(stem)}">${escapeHtml(label || stripNotionId(stem.split("/").pop()!))}</a>`;
      return label;
    }
    // 그 밖의 첨부 파일 링크는 글자만 남긴다
    return label || path;
  });
}
