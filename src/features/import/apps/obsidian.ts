/**
 * Obsidian 보관소(vault) 가져오기 (DATA-11). 보관소 폴더 또는 그 zip의 텍스트 파일을 받아 가져올 항목 목록을 만든다.
 * - `.obsidian/`·`.trash/`·점으로 시작하는 파일은 건너뛴다. `.md`만 문서가 되고, 그림은 자산으로 모은다.
 * - `[[노트]]`·`[[노트|별칭]]`·`[[노트#제목]]` → 노트 링크(`<a data-page-mention>`). 못 찾으면 글자만.
 * - `![[그림.png|300]]` → 보관소 안에서 이름으로 찾은 그림(`![](<경로>)`). `![[노트]]`는 링크로.
 * - YAML front matter(title · tags · aliases) + 본문 `#태그`(코드·제목 줄 밖) → 태그. 제목은 title, 없으면 파일 이름.
 * - `> [!note] 제목` 콜아웃(+/- 접힘 표시는 무시) → 콜아웃 블록. 안의 글은 문단으로 바뀐다(안의 서식은 평문).
 * - 과제 목록(`- [ ]`)·수식(`$…$`)은 그대로 둔다(붙여넣기 변환이 처리).
 * 링크 대상은 `key`(문서 key = `p:<경로>`)로 남으므로, 호출하는 쪽이 가져온 문서 id로 바꾼다.
 */
import {
  placeNodes,
  resolveStem,
  mapOutsideCode,
  escapeHtml,
  safeSegments,
  stemOf,
  type ImportNode,
  type SourceFile,
} from "./tree";

const PAGE_EXTS = ["md", "markdown"] as const;
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"] as const;
const SKIP_DIRS = new Set([".obsidian", ".trash"]);

/** 콜아웃 종류 → 색(SOFT_COLORS) · 이모지 */
const CALLOUT: Record<string, [color: string, emoji: string]> = {
  note: ["blue", "📝"],
  info: ["blue", "ℹ️"],
  todo: ["blue", "☑️"],
  tip: ["green", "💡"],
  hint: ["green", "💡"],
  important: ["purple", "❗"],
  success: ["green", "✅"],
  check: ["green", "✅"],
  done: ["green", "✅"],
  question: ["yellow", "❓"],
  help: ["yellow", "❓"],
  faq: ["yellow", "❓"],
  warning: ["orange", "⚠️"],
  caution: ["orange", "⚠️"],
  attention: ["orange", "⚠️"],
  danger: ["red", "🔥"],
  error: ["red", "🔥"],
  bug: ["red", "🐞"],
  failure: ["red", "❌"],
  fail: ["red", "❌"],
  missing: ["red", "❌"],
  example: ["purple", "🧪"],
  quote: ["gray", "❝"],
  cite: ["gray", "❝"],
  abstract: ["brown", "📄"],
  summary: ["brown", "📄"],
};

export type ObsidianResult = { nodes: ImportNode[]; skipped: string[] };

/** front matter 한 블록을 읽는다. 값이 목록(`- a`)이면 항목을 모은다 */
function frontMatter(text: string): { fields: Map<string, string[]>; body: string } | null {
  const m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!m) return null;
  const fields = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of m[1]!.split("\n")) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) {
      current = kv[1]!.toLowerCase();
      const raw = kv[2]!.trim();
      if (!raw) fields.set(current, []);
      else if (current === "tags" || current === "aliases")
        fields.set(
          current,
          raw
            .replace(/^\[|]$/g, "")
            .split(",")
            .map(unquote)
            .filter(Boolean),
        );
      else fields.set(current, [unquote(raw)]);
      continue;
    }
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && current) fields.get(current)!.push(unquote(item[1]!));
  }
  return { fields, body: text.slice(m[0].length) };
}

const unquote = (s: string) =>
  s
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();

/** 태그 한 개 정리: 앞의 `#` 떼기, 공백 금지 */
function normTag(t: string): string | null {
  const v = t.replace(/^#+/, "").trim();
  return v && !/^\d+$/.test(v) ? v : null;
}

/** 본문 한 줄의 `#태그` (코드 밖, 제목 줄 아님) */
const INLINE_TAG = /(^|[\s(])#([\p{L}_/][\p{L}\p{N}_/-]*)/gu;

export function convertObsidianVault(files: SourceFile[]): ObsidianResult {
  const skipped: string[] = [];
  const safe: SourceFile[] = [];
  for (const f of files) {
    const segs = safeSegments(f.path);
    if (!segs) {
      skipped.push(f.path);
      continue;
    }
    if (segs.some((s) => s.startsWith(".") || SKIP_DIRS.has(s))) continue;
    safe.push({ path: segs.join("/"), text: f.text });
  }

  const pages = safe.filter((f) => stemOf(f.path, PAGE_EXTS) !== null);
  const stems = pages.map((f) => stemOf(f.path, PAGE_EXTS)!);
  const images = safe.filter((f) => stemOf(f.path, IMAGE_EXTS) !== null).map((f) => f.path);
  const imageByName = new Map<string, string>();
  for (const p of [...images].sort(
    (a, b) => a.split("/").length - b.split("/").length || (a < b ? -1 : 1),
  )) {
    const base = p.slice(p.lastIndexOf("/") + 1).toLowerCase();
    if (!imageByName.has(base)) imageByName.set(base, p);
  }

  const nodes: ImportNode[] = [];
  const placed = placeNodes(stems);
  const placedByKey = new Map(placed.map((n) => [n.key, n]));

  for (const file of pages) {
    const stem = stemOf(file.path, PAGE_EXTS)!;
    const dir = stem.includes("/") ? stem.slice(0, stem.lastIndexOf("/")) : "";
    const ctx = { stems, dir, imageByName, assetPaths: new Set<string>() };
    const text = file.text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const front = frontMatter(text);
    const body = front ? front.body : text;
    const fmTitle = front?.fields.get("title")?.[0];
    const tags = new Set<string>();
    for (const t of front?.fields.get("tags") ?? []) {
      const n = normTag(t);
      if (n) tags.add(n);
    }
    const markdown = transformBody(body, ctx, tags);
    const base = stem.slice(stem.lastIndexOf("/") + 1);
    const node = placedByKey.get(`p:${stem}`)!;
    nodes.push({
      key: node.key,
      parentKey: node.parentKey,
      kind: "page",
      title: (fmTitle || base).slice(0, 200),
      tags: [...tags],
      markdown,
      assetPaths: [...ctx.assetPaths],
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
  return { nodes, skipped };
}

type Ctx = {
  stems: string[];
  dir: string;
  imageByName: Map<string, string>;
  assetPaths: Set<string>;
};

/** 본문 전체 변환: 콜아웃 블록 → 줄 단위(코드 펜스 건너뜀) 링크·그림·태그 */
export function transformBody(body: string, ctx: Ctx, tags: Set<string>): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fenceMark = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMark) {
      if (fence === null) fence = fenceMark[1]!;
      else if (line.trimStart().startsWith(fence)) fence = null;
      out.push(line);
      continue;
    }
    if (fence !== null) {
      out.push(line);
      continue;
    }
    const callout = /^>\s?\[!([\w-]+)][+-]?\s*(.*)$/.exec(line);
    if (callout) {
      const inner: string[] = [];
      while (i + 1 < lines.length && /^>/.test(lines[i + 1]!)) {
        inner.push(lines[++i]!.replace(/^>\s?/, ""));
      }
      out.push(calloutHtml(callout[1]!, callout[2]!.trim(), inner, ctx, tags));
      continue;
    }
    out.push(transformLine(line, ctx, tags));
  }
  return out.join("\n");
}

/** 콜아웃 한 개 → HTML 조각(빈 줄로 앞뒤를 띄워 Markdown 블록이 끊기지 않게 한다) */
function calloutHtml(
  kind: string,
  title: string,
  inner: string[],
  ctx: Ctx,
  tags: Set<string>,
): string {
  const [color, emoji] = CALLOUT[kind.toLowerCase()] ?? ["gray", "📌"];
  const head = title || kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase();
  const paras = [head, ...inner]
    .filter((l) => l.trim() !== "")
    .map((l) => `<p>${transformLine(l, ctx, tags)}</p>`);
  return `\n<div data-type="callout" data-emoji="${escapeHtml(emoji)}" data-color="${color}">\n${paras.join("\n")}\n</div>\n`;
}

/** 한 줄: 그림 임베드 → 링크 임베드 → 위키링크 → (코드 밖에서) 태그 수집 */
function transformLine(line: string, ctx: Ctx, tags: Set<string>): string {
  const isHeading = /^\s*#{1,6}\s/.test(line);
  return mapOutsideCode(line, (part) => {
    let s = part.replace(/!\[\[([^\]\n]+)\]\]/g, (_m, inner: string) => embed(inner, ctx));
    s = s.replace(/\[\[([^\]\n]+)\]\]/g, (_m, inner: string) => link(inner, ctx));
    if (!isHeading) {
      for (const m of s.matchAll(INLINE_TAG)) {
        const n = normTag(m[2]!);
        if (n) tags.add(n);
      }
    }
    return s;
  });
}

/** `[[target#heading^block|alias]]` 의 대상과 글자 */
function parseTarget(inner: string): { target: string; label: string | null } {
  const [left, alias] = splitAlias(inner);
  const target = left.split("#")[0]!.trim();
  return { target, label: alias ?? null };
}

function splitAlias(inner: string): [string, string | null] {
  const i = inner.indexOf("|");
  return i < 0 ? [inner, null] : [inner.slice(0, i), inner.slice(i + 1).trim() || null];
}

function link(inner: string, ctx: Ctx): string {
  const { target, label } = parseTarget(inner);
  const stem = resolveStem(target, ctx.stems, ctx.dir);
  const text = label ?? (target.slice(target.lastIndexOf("/") + 1) || inner);
  if (!stem) return escapeHtml(text);
  return `<a data-page-mention="p:${escapeHtml(stem)}">${escapeHtml(text)}</a>`;
}

function embed(inner: string, ctx: Ctx): string {
  const [left, size] = splitAlias(inner);
  const name = left.trim();
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if ((IMAGE_EXTS as readonly string[]).includes(ext)) {
    const base = name.slice(name.lastIndexOf("/") + 1).toLowerCase();
    const path = ctx.imageByName.get(base) ?? null;
    if (!path) return escapeHtml(name);
    ctx.assetPaths.add(path);
    const alt = size && /^\d+$/.test(size) ? "" : (size ?? "");
    return `![${alt.replace(/[[\]]/g, "")}](<${path}>)`;
  }
  // 노트 임베드는 링크로 둔다
  return link(inner, ctx);
}
