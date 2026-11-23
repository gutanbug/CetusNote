import type { PageNode } from "@/components/shell/page-tree";
import { buildPageTree } from "@/features/pages/tree";
import type { Page } from "@/lib/storage";

/**
 * Markdown 가져오기(DATA-08)의 「어디에 넣을까요?」 목록.
 * 맨 위(null)가 먼저, 그다음 트리 순서의 폴더·문서 id.
 * - 휴지통·템플릿과 그 하위는 트리에 없어서 빠진다 (buildPageTree)
 * - 컬렉션과 그 레코드는 뺀다 — 레코드가 되면 컬렉션 속성이 맞지 않는 문서가 생긴다
 */
export function importDestinations(
  pages: Iterable<Page>,
  order: Record<string, string[]> = {},
): (string | null)[] {
  const all = [...pages];
  const byId = new Map(all.map((p) => [p.id, p]));
  const out: (string | null)[] = [null];
  const walk = (nodes: PageNode[]) => {
    for (const node of nodes) {
      const page = byId.get(node.id);
      // 컬렉션을 건너뛰면 그 레코드(하위)도 함께 빠진다
      if (!page || page.kind === "collection") continue;
      out.push(node.id);
      if (node.children) walk(node.children);
    }
  };
  walk(buildPageTree(all, order));
  return out;
}
