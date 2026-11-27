import { msg } from "@/lib/i18n";
import type { PageNode } from "./page-tree";

/**
 * SH-PageTree 가상화의 순수 계산 (React 없음). 행은 모두 같은 높이다 — parts.ts의 행은
 * `min-h-7.5`(= 30px)이고 말줄임 한 줄이라 높이가 바뀌지 않는다. 그래서 고정 높이 윈도잉으로 충분하다(ADR-021).
 */

/** 행 한 줄의 높이(px). 트리 행의 `min-h-7.5`와 같아야 한다 */
export const ROW_HEIGHT = 30;

export type FlatRow = {
  node: PageNode;
  /** 1부터. 루트 행은 1 (aria-level) */
  level: number;
  parentId?: string;
  /** 같은 묶음의 형제 수 (aria-setsize) */
  setSize: number;
  /** 같은 묶음 안의 1부터 세는 순서 (aria-posinset) */
  posInSet: number;
  hasKids: boolean;
  isOpen: boolean;
};

/**
 * 펼쳐진 트리를 보이는 행 목록으로 편다. 접힌 페이지의 하위는 목록에 없다.
 * 깊이 우선 순서 — 펼친 행 바로 다음이 첫 하위다.
 */
export function flattenRows(nodes: PageNode[], expanded: ReadonlySet<string>): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (list: PageNode[], level: number, parentId?: string) => {
    for (let i = 0; i < list.length; i++) {
      const node = list[i]!;
      const hasKids = !!node.children?.length;
      const isOpen = hasKids && expanded.has(node.id);
      out.push({ node, level, parentId, setSize: list.length, posInSet: i + 1, hasKids, isOpen });
      if (isOpen) walk(node.children!, level + 1, node.id);
    }
  };
  walk(nodes, 1);
  return out;
}

/**
 * 보이는 구간에 걸치는 행 인덱스 범위 [first, last)를 구한다. 위아래로 overscan행을 더 둔다.
 * viewportHeight가 0(아직 잴 수 없음)이면 처음 `fallbackRows`개를 그린다.
 */
export function windowRange(
  scrollTop: number,
  viewportHeight: number,
  count: number,
  { overscan = 8, fallbackRows = 40, rowHeight = ROW_HEIGHT } = {},
): { first: number; last: number } {
  if (count <= 0) return { first: 0, last: 0 };
  if (viewportHeight <= 0) return { first: 0, last: Math.min(count, fallbackRows) };
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const last = Math.min(count, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { first: Math.min(first, count), last };
}

/** 제목이 비었을 때 행이 보여 주는 이름. 종류마다 다르다 (페이지·폴더·컬렉션) */
export function untitledRowName(node: PageNode): string {
  if (node.title) return node.title;
  if (node.kind === "folder") return msg().shell.untitled.folder;
  if (node.kind === "collection") return msg().shell.untitled.collection;
  return msg().shell.untitled.page;
}
