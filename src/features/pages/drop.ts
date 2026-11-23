import type { DropPosition } from "@/components/shell/drop-indicator";
import type { PageNode } from "@/components/shell/page-tree";
import { canContain, type Page } from "@/lib/storage";

/** 놓으면 바뀌는 것: 새 부모와 그 부모 아래 순서 */
export type DropPlan = { parentId: string | null; ids: string[] };

/**
 * 트리 끌어다 놓기 (SHELL-06). 놓을 수 없으면 null — 자기 자신·하위로, 컬렉션 아래 폴더·컬렉션, 제자리.
 * tree는 화면에 그린 트리(buildPageTree)다. 순서는 그 트리의 형제 순서를 바탕으로 만든다.
 */
export function planDrop(
  pages: Record<string, Page>,
  tree: PageNode[],
  id: string,
  targetId: string,
  position: DropPosition,
): DropPlan | null {
  const page = pages[id];
  const target = pages[targetId];
  if (!page || !target || id === targetId) return null;

  const parentOf = new Map<string, string | null>();
  const kidsOf = new Map<string | null, string[]>();
  const walk = (nodes: PageNode[], parent: string | null) => {
    kidsOf.set(
      parent,
      nodes.map((n) => n.id),
    );
    for (const n of nodes) {
      parentOf.set(n.id, parent);
      walk(n.children ?? [], n.id);
    }
  };
  walk(tree, null);
  if (!parentOf.has(id) || !parentOf.has(targetId)) return null;
  // 대상이 끄는 페이지의 하위면 안 된다(고리)
  for (let p: string | null | undefined = targetId; p; p = parentOf.get(p))
    if (p === id) return null;

  let plan: DropPlan;
  if (position === "inside") {
    if (!canContain(target, page.kind)) return null;
    plan = {
      parentId: targetId,
      ids: [...(kidsOf.get(targetId) ?? []).filter((x) => x !== id), id],
    };
  } else {
    const parentId = parentOf.get(targetId) ?? null;
    const parent = parentId ? pages[parentId] : undefined;
    if (parent && !canContain(parent, page.kind)) return null;
    const ids = (kidsOf.get(parentId) ?? []).filter((x) => x !== id);
    ids.splice(ids.indexOf(targetId) + (position === "after" ? 1 : 0), 0, id);
    plan = { parentId, ids };
  }
  const same =
    plan.parentId === (parentOf.get(id) ?? null) &&
    plan.ids.join() === (kidsOf.get(plan.parentId) ?? []).join();
  return same ? null : plan;
}
