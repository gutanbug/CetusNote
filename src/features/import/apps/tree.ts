/**
 * 다른 앱에서 가져오기(DATA-11) 공통 도구: 경로 검사 · 이름 정리 · 계층 배치 · 링크 찾기.
 * 순수 함수만 둔다(파일 I/O 없음). 파일 목록은 Rust가 읽어서 넘겨 준다.
 */

/** 가져올 텍스트 파일 한 개. path는 고른 폴더(또는 zip 안) 기준 상대 경로, `/`로 나눈다 */
export type SourceFile = { path: string; text: string };

/** 가져올 항목 한 개: 문서 또는 묶음 폴더. key는 같은 가져오기 안에서만 유일하다 */
export type ImportNode = {
  key: string;
  parentKey: string | null;
  kind: "page" | "folder";
  title: string;
  tags: string[];
  /** 문서 본문(Markdown + 이 앱의 HTML 조각). 폴더는 빈 문자열 */
  markdown: string;
  /** 본문이 가리키는 원본 그림 경로(가져오는 쪽이 assets로 옮긴다) */
  assetPaths: string[];
  /** markdown이면 Markdown 글, html이면 HTML 글 그대로(가져오는 쪽이 htmlToDoc으로 바꾼다). 기본 markdown */
  format?: "markdown" | "html";
};

/** 목록의 경로가 안전한지 검사한다(zip-slip·절대 경로·역슬래시·`..`). 안전하면 조각 목록, 아니면 null */
export function safeSegments(path: string): string[] | null {
  if (!path || path.startsWith("/") || path.includes("\\") || /^[A-Za-z]:/.test(path)) return null;
  const parts = path.split("/").filter((p) => p !== "" && p !== ".");
  if (!parts.length || parts.some((p) => p === "..")) return null;
  return parts;
}

/** 퍼센트 인코딩을 풀되, 잘못된 인코딩이면 원래 문자열을 쓴다 */
export function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const NOTION_ID =
  /\s+(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Notion 내보내기 이름의 ` <32자리 id>` 꼬리를 뺀다. 빈 이름이면 원래 이름 */
export function stripNotionId(name: string): string {
  const cleaned = name.replace(NOTION_ID, "").trim();
  return cleaned || name.trim();
}

/** 확장자(대소문자 무관)를 뺀 경로. 해당 확장자가 아니면 null */
export function stemOf(path: string, exts: readonly string[]): string | null {
  const m = /\.([A-Za-z0-9]+)$/.exec(path);
  if (!m || !exts.includes(m[1]!.toLowerCase())) return null;
  return path.slice(0, -m[0].length);
}

/**
 * 문서 경로(확장자 뺀 것)들로 계층을 만든다.
 * - `a/b/x`의 부모는 `a/b`. 같은 이름의 문서(`a/b`)가 있으면 그 문서가 부모다 (Notion 「X.md + X/」, Obsidian 폴더 노트).
 * - 문서가 없는 폴더는 묶음 폴더 노드로 만든다.
 * clean은 폴더·문서 이름을 정리한다(예: stripNotionId).
 */
export function placeNodes(
  stems: string[],
  clean: (name: string) => string = (n) => n,
): { key: string; parentKey: string | null; kind: "page" | "folder"; title: string }[] {
  const pageSet = new Set(stems);
  const out = new Map<
    string,
    { key: string; parentKey: string | null; kind: "page" | "folder"; title: string }
  >();
  const pageKey = (stem: string) => `p:${stem}`;
  const folderKey = (dir: string) => `d:${dir}`;

  /** 디렉터리 경로 → 그 노드의 key (문서 또는 폴더). 최상위면 null */
  const dirNode = (dir: string): string | null => {
    if (!dir) return null;
    if (pageSet.has(dir)) return pageKey(dir);
    const key = folderKey(dir);
    if (!out.has(key)) {
      const cut = dir.lastIndexOf("/");
      const name = dir.slice(cut + 1);
      const parent = dirNode(cut < 0 ? "" : dir.slice(0, cut));
      out.set(key, { key, parentKey: parent, kind: "folder", title: clean(name) });
    }
    return key;
  };

  for (const stem of stems) {
    const cut = stem.lastIndexOf("/");
    const dir = cut < 0 ? "" : stem.slice(0, cut);
    const name = stem.slice(cut + 1);
    out.set(pageKey(stem), {
      key: pageKey(stem),
      parentKey: dirNode(dir),
      kind: "page",
      title: clean(name),
    });
  }
  return [...out.values()];
}

/**
 * 링크 대상을 문서 경로(확장자 뺀 것)로 찾는다.
 * 1) from(링크가 있는 문서의 폴더) 기준 정확한 경로  2) 대소문자 무관 정확한 경로
 * 3) 끝이 맞는 경로(`x` → `a/x`, `a/x`는 `b/a/x`에도) 중 가장 짧은 것, 같으면 사전순.
 * 못 찾으면 null.
 */
export function resolveStem(
  target: string,
  stems: readonly string[],
  fromDir = "",
  clean: (name: string) => string = (n) => n,
): string | null {
  const t = target.replace(/^\.\//, "").trim();
  if (!t) return null;
  const set = new Set(stems);
  const joined = fromDir ? `${fromDir}/${t}` : t;
  if (set.has(joined)) return joined;
  // 정리한 이름(Notion id 제거)으로 비교한다: 링크는 이름만 쓰기도 한다
  const lower = t.toLowerCase();
  const byClean = (s: string) => s.toLowerCase();
  const matches = stems.filter((s) => {
    const full = byClean(s);
    if (full === lower) return true;
    if (full.endsWith(`/${lower}`)) return true;
    const segs = s.split("/").map((seg) => byClean(clean(seg)));
    const want = lower.split("/").map((seg) => byClean(clean(seg)));
    if (want.length > segs.length) return false;
    return want.every((w, i) => segs[segs.length - want.length + i] === w);
  });
  if (!matches.length) return null;
  matches.sort((a, b) => a.split("/").length - b.split("/").length || (a < b ? -1 : a > b ? 1 : 0));
  return matches[0]!;
}

/** 본문 밖(코드 펜스·인라인 코드 밖) 조각에만 변환을 건다. 코드 안은 그대로 둔다 */
export function mapOutsideCode(line: string, fn: (s: string) => string): string {
  return line
    .split(/(`[^`\n]*`)/)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");
}

/** HTML 조각에 넣을 글자를 이스케이프 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
