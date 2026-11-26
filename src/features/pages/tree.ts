import type { PageNode } from "@/components/shell/page-tree";
import { canContain } from "@/lib/storage";
import type { PageMeta } from "./store";

/**
 * 페이지 → SH-PageTree 트리 (SHELL-05, SHELL-14).
 * - 휴지통 페이지와 그 하위는 뺀다.
 * - 부모가 없거나, 컬렉션 아래 폴더처럼 규칙에 어긋나거나, 고리를 이루면 루트에 둔다(파일을 직접 고친 경우).
 * - 컬렉션의 레코드(자식 문서)는 트리에 그리지 않는다 — 컬렉션 화면에서 본다 (COLL-01).
 * - 순서: workspace.json의 order[부모 id | "root"]에 적힌 순서 → 나머지는 폴더 먼저, 만든 순.
 */
export function buildPageTree(
  pages: Iterable<PageMeta>,
  order: Record<string, string[]> = {},
): PageNode[] {
  const byId = new Map<string, PageMeta>();
  for (const p of pages) byId.set(p.id, p);

  /** 실제로 붙일 부모 id. 루트면 null, 휴지통 쪽이면 undefined(숨김) */
  const parentOf = new Map<string, string | null | undefined>();
  const resolve = (page: PageMeta): string | null | undefined => {
    if (parentOf.has(page.id)) return parentOf.get(page.id);
    parentOf.set(page.id, null); // 고리 방지: 계산 중에는 루트로 본다
    let result: string | null | undefined;
    // 휴지통·템플릿(PAGE-14)은 트리에 없다
    if (page.trashedAt || page.template) result = undefined;
    else {
      const parent = page.parentId ? byId.get(page.parentId) : undefined;
      if (!parent || !canContain(parent, page.kind)) result = null;
      else if (resolve(parent) === undefined) result = undefined;
      else result = isAncestor(page.id, parent) ? null : parent.id;
    }
    parentOf.set(page.id, result);
    return result;
  };
  const isAncestor = (id: string, from: PageMeta): boolean => {
    const seen = new Set<string>();
    for (let cur: PageMeta | undefined = from; cur && !seen.has(cur.id);) {
      if (cur.id === id) return true;
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return false;
  };

  const groups = new Map<string, PageMeta[]>();
  for (const page of byId.values()) {
    const parent = resolve(page);
    if (parent === undefined) continue;
    const key = parent ?? "root";
    const list = groups.get(key);
    if (list) list.push(page);
    else groups.set(key, [page]);
  }

  // Intl.Collator는 localeCompare와 같은 정렬이면서 정렬 중 매번 로케일을 찾지 않는다 (SYS-10)
  const collate = new Intl.Collator().compare;
  const sortGroup = (key: string, list: PageMeta[]) => {
    const rank = new Map((order[key] ?? []).map((id, i) => [id, i]));
    return list.slice().sort((a, b) => {
      const ra = rank.get(a.id) ?? Infinity;
      const rb = rank.get(b.id) ?? Infinity;
      if (ra !== rb) return ra - rb;
      if ((a.kind === "folder") !== (b.kind === "folder")) return a.kind === "folder" ? -1 : 1;
      return collate(a.createdAt, b.createdAt);
    });
  };
  const build = (key: string): PageNode[] =>
    sortGroup(key, groups.get(key) ?? []).map((p) => {
      const children = p.kind === "collection" ? [] : build(p.id);
      return {
        id: p.id,
        title: p.title,
        kind: p.kind,
        ...(p.kind !== "folder" && p.icon ? { emoji: p.icon } : {}),
        ...(children.length ? { children } : {}),
      };
    });
  return build("root");
}
