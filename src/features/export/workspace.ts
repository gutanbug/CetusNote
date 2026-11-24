import type { FieldDef, Page } from "@/lib/storage";
import { pageToMarkdown, type MdNode } from "./markdown";

/**
 * 워크스페이스 전체 Markdown 내보내기 (DATA-10, ADR-014). 이 파일은 "무엇을 어느 경로에 쓸지"만 정한다.
 * 실제 쓰기는 Rust(`workspace_export_markdown`)가 한다.
 *
 * 폴더 모양:
 *   <고른 폴더>/<워크스페이스> Markdown <날짜>/
 *     <문서>.md                     글 문서
 *     <문서>/<자식>.md              자식이 있는 문서는 같은 이름의 폴더에 자식을 둔다
 *     <폴더>/…                      폴더(kind folder)는 디렉터리만 된다
 *     <컬렉션>/index.md             컬렉션 본문 + 레코드 표(제목·상태·담당·마감·태그·사용자 속성)
 *     <컬렉션>/<레코드>.md          레코드는 글 문서와 같다
 *     assets/<페이지 id>/<파일>     본문이 쓰는 이미지. 워크스페이스 assets와 같은 경로를 쓴다
 * 휴지통·템플릿·.history는 내보내지 않는다.
 */

export type ExportFile = { path: string; text: string } | { path: string; asset: string };

export type WorkspaceExportManifest = { rootName: string; files: ExportFile[] };

export type WorkspaceExport = {
  manifest: WorkspaceExportManifest;
  /** 글로 쓴 문서 수(컬렉션의 index.md는 넣지 않는다) */
  documents: number;
  /** 같이 복사할 이미지 수 */
  assets: number;
  /** 건너뛴 페이지 수 (휴지통 안, 템플릿) */
  skipped: { trashed: number; templates: number };
};

export type WorkspaceExportInput = {
  pages: readonly Page[];
  /** workspace.json의 order: 부모 id(최상위는 "root") → 자식 id 목록 */
  order: Readonly<Record<string, readonly string[]>>;
  workspaceName: string;
  /** 지역 날짜 YYYY-MM-DD */
  date: string;
};

const UNTITLED = "제목 없음";
const ROOT_KEY = "root";
const INDEX = "index";
const NAME_MAX = 100;

/** 파일·폴더 이름 한 조각: 금지 글자·제어 문자를 빼고, 공백을 줄이고, 앞의 점을 떼고, 100자로 자른다 */
export function sanitizeFileName(raw: string): string {
  const cleaned = raw
    // 제어 문자를 빼는 것이 목적이라 이 정규식은 허용한다
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();
  const cut = [...cleaned].slice(0, NAME_MAX).join("").trim();
  return cut || UNTITLED;
}

/** 같은 폴더 안에서 겹치지 않는 이름. 대소문자는 무시한다(macOS 기본 파일 시스템) */
function uniqueName(base: string, used: Set<string>): string {
  let name = base;
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} (${n})`;
  used.add(name.toLowerCase());
  return name;
}

/** 파일 `from`에서 `to`로 가는 상대 경로(글 링크·이미지 src). 조각마다 퍼센트 인코딩하고 괄호도 막는다 */
export function relativeHref(from: string, to: string): string {
  const fromDir = from.split("/").slice(0, -1);
  const target = to.split("/");
  let common = 0;
  while (
    common < fromDir.length &&
    common < target.length - 1 &&
    fromDir[common] === target[common]
  )
    common++;
  const up = Array<string>(fromDir.length - common).fill("..");
  return [...up, ...target.slice(common)].map(encodeSegment).join("/");
}

const encodeSegment = (s: string) =>
  encodeURIComponent(s).replace(/\(/g, "%28").replace(/\)/g, "%29");

/** 표 칸 · 링크 글자 이스케이프 */
const cell = (s: string) => s.replace(/[|\\]/g, "\\$&").replace(/\s*\n\s*/g, " ");
const linkText = (s: string) => s.replace(/[[\]\\]/g, "\\$&").replace(/\s*\n\s*/g, " ");

type Node = { page: Page; children: Node[]; md?: string; index?: string; dir?: string };

type Env = {
  pages: Map<string, Page>;
  /** 내보낸 페이지 id → 멘션이 가리킬 파일 (글 문서는 md, 컬렉션은 index.md) */
  targets: Map<string, string>;
  /** 본문이 쓰는 워크스페이스 이미지 경로(assets/…) */
  assets: Set<string>;
};

const ASSET_SRC = /^assets\/[^/]+\/[^/]+$/;

/** 자식 목록 순서: workspace.json의 order → 만든 시각 → id */
function sortSiblings(list: Page[], ordered: readonly string[] | undefined): Page[] {
  const rank = new Map((ordered ?? []).map((id, i) => [id, i]));
  const at = (p: Page) => rank.get(p.id) ?? Number.MAX_SAFE_INTEGER;
  return [...list].sort(
    (a, b) => at(a) - at(b) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/** 휴지통·템플릿 아래는 가지째 뺀다. 부모가 없으면 루트로 본다(트리 규칙과 같다) */
function collect(pages: readonly Page[], input: WorkspaceExportInput) {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const childrenOf = new Map<string, Page[]>();
  for (const p of pages) {
    const parent =
      p.parentId && p.parentId !== p.id && byId.has(p.parentId) ? p.parentId : ROOT_KEY;
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), p]);
  }
  const skipped = { trashed: 0, templates: 0 };
  const seen = new Set<string>();
  const size = (p: Page): number => {
    if (seen.has(p.id)) return 0;
    seen.add(p.id);
    return 1 + (childrenOf.get(p.id) ?? []).reduce((n, c) => n + size(c), 0);
  };
  const walk = (parentKey: string): Node[] =>
    sortSiblings(childrenOf.get(parentKey) ?? [], input.order[parentKey]).flatMap((p) => {
      if (p.trashedAt || p.template) {
        seen.clear();
        const n = size(p);
        if (p.trashedAt) skipped.trashed += n;
        else skipped.templates += n;
        return [];
      }
      return [{ page: p, children: walk(p.id) }];
    });
  return { tree: walk(ROOT_KEY), skipped, byId };
}

/** 경로 정하기: 이름 겹침을 풀고, 폴더·md·index.md 경로를 노드에 적는다 */
function assign(nodes: Node[], dir: readonly string[], reserved: readonly string[]) {
  const used = new Set(reserved);
  for (const n of nodes) {
    const base = uniqueName(sanitizeFileName(n.page.title.trim() || UNTITLED), used);
    if (n.page.kind === "folder") {
      n.dir = [...dir, base].join("/");
      assign(n.children, [...dir, base], []);
    } else if (n.page.kind === "collection") {
      n.dir = [...dir, base].join("/");
      n.index = [...dir, base, `${INDEX}.md`].join("/");
      assign(n.children, [...dir, base], [INDEX]);
    } else {
      n.md = [...dir, `${base}.md`].join("/");
      if (n.children.length) {
        n.dir = [...dir, base].join("/");
        assign(n.children, [...dir, base], []);
      }
    }
  }
}

function eachNode(nodes: Node[], fn: (n: Node) => void) {
  for (const n of nodes) {
    fn(n);
    eachNode(n.children, fn);
  }
}

/** 본문 변환: 멘션 → 링크(내보낸 대상) 또는 제목 글, 워크스페이스 이미지 → 상대 경로 */
function convert(node: MdNode, from: string, env: Env): MdNode[] {
  if (node.type === "pageMention") {
    const id = String(node.attrs?.id ?? "");
    const page = env.pages.get(id);
    const target = env.targets.get(id);
    const title = page
      ? page.title.trim() || UNTITLED
      : String(node.attrs?.label ?? "") || UNTITLED;
    const marks = node.marks ?? [];
    return [
      {
        type: "text",
        text: title,
        marks: target
          ? [...marks, { type: "link", attrs: { href: relativeHref(from, target) } }]
          : marks,
      },
    ];
  }
  if (node.type === "attachment") {
    // 파일 첨부(EDIT-31~33)는 이미지처럼 워크스페이스 assets에서 복사하고 상대 경로로 잇는다
    const path = String(node.attrs?.path ?? "");
    if (!ASSET_SRC.test(path))
      return [
        { type: "paragraph", content: [{ type: "text", text: String(node.attrs?.name ?? "") }] },
      ];
    env.assets.add(path);
    return [{ ...node, attrs: { ...node.attrs, path: relativeHref(from, path) } }];
  }
  if (node.type === "image") {
    const src = String(node.attrs?.src ?? "");
    if (ASSET_SRC.test(src)) {
      env.assets.add(src);
      return [{ ...node, attrs: { ...node.attrs, src: relativeHref(from, src) } }];
    }
    // 웹 주소(내려받는 중인 것 포함)는 그대로 둔다. 그 밖의 로컬 경로는 가져갈 수 없어 글만 남긴다
    if (src && !/^https?:\/\//i.test(src)) {
      const alt = (node.content ?? []).map((t) => t.text ?? "").join("");
      return alt ? [{ type: "paragraph", content: [{ type: "text", text: alt }] }] : [];
    }
    return [node];
  }
  if (node.content)
    return [{ ...node, content: node.content.flatMap((c) => convert(c, from, env)) }];
  return [node];
}

function renderDoc(page: Page, from: string, env: Env) {
  const content = (page.content as MdNode).content ?? [];
  const body = {
    ...(page.content as MdNode),
    content: content.flatMap((c) => convert(c, from, env)),
  };
  return pageToMarkdown({ ...page, content: body } as Page);
}

const localDate = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function fieldCell(def: FieldDef, page: Page): string {
  if (def.type === "created") return localDate(page.createdAt);
  if (def.type === "updated") return localDate(page.updatedAt);
  const v = page.props.values[def.id];
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

/** 컬렉션 index.md: 컬렉션 본문 + 레코드 표. 레코드 제목은 그 레코드 파일로 간다 */
function renderCollection(node: Node, env: Env): string {
  const { page } = node;
  const fields = page.collection?.fields ?? [];
  const head = renderDoc(page, node.index!, env).replace(/\n+$/, "");
  const columns = ["제목", "상태", "담당", "마감", "태그", ...fields.map((f) => f.name)];
  const rows = node.children
    .filter((c) => c.md)
    .map((c) => {
      const r = c.page;
      const title = `[${linkText(r.title.trim() || UNTITLED)}](${relativeHref(node.index!, c.md!)})`;
      return [
        title,
        r.props.status ?? "",
        r.props.assignee ?? "",
        r.props.due ?? "",
        r.props.tags.join(", "),
        ...fields.map((f) => fieldCell(f, r)),
      ];
    });
  const table = [
    `| ${columns.map(cell).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");
  return `${head}\n\n${table}\n`;
}

/** 워크스페이스 전체를 내보낼 목록으로 바꾼다. 순수 함수 — 파일을 쓰지 않는다 */
export function buildWorkspaceExport(input: WorkspaceExportInput): WorkspaceExport {
  const { tree, skipped, byId } = collect(input.pages, input);
  assign(tree, [], []);

  const env: Env = { pages: byId, targets: new Map(), assets: new Set() };
  eachNode(tree, (n) => {
    const target =
      n.page.kind === "collection" ? n.index : n.page.kind === "folder" ? undefined : n.md;
    if (target) env.targets.set(n.page.id, target);
  });

  const files: ExportFile[] = [];
  let documents = 0;
  eachNode(tree, (n) => {
    const p = n.page;
    if (p.kind === "collection") {
      files.push({ path: n.index!, text: renderCollection(n, env) });
      return;
    }
    if (p.kind === "folder") return;
    files.push({ path: n.md!, text: renderDoc(p, n.md!, env) });
    documents++;
  });
  // 자산은 경로순으로 한 번씩
  const assets = [...env.assets].sort();
  for (const src of assets) files.push({ path: src, asset: src });

  const root = `${sanitizeFileName(input.workspaceName || "CetusNote")} Markdown ${input.date}`;
  return {
    manifest: { rootName: root, files },
    documents,
    assets: assets.length,
    skipped,
  };
}
