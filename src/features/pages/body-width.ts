import type { BodyWidth, Page } from "@/lib/storage";

/** 본문 폭을 정하는 데 필요한 최소 모양 (PageMeta가 그대로 맞는다) */
export type WidthNode = {
  parentId: string | null;
  kind: Page["kind"];
  layout: { width?: BodyWidth };
};

/** 실제로 쓰이는 폭과 그 출처. 메뉴가 "폴더 설정 따르기" 같은 안내에 쓴다 */
export type ResolvedWidth = { width: BodyWidth; from: "page" | "folder" | "global" };

/**
 * 상위에서 상속되는 폭: 가까운 폴더부터 올라가며 처음 정해 둔 값. 컬렉션은 폭을 갖지 않으니 건너뛴다.
 * 없으면 전체 설정(defaultWide)을 따른다.
 */
export function inheritedBodyWidth(
  id: string,
  all: Record<string, WidthNode>,
  defaultWide: boolean,
): ResolvedWidth {
  const seen = new Set([id]);
  for (let p = all[id]?.parentId ?? null; p && all[p] && !seen.has(p); p = all[p]!.parentId) {
    seen.add(p);
    const folder = all[p]!;
    if (folder.kind === "folder" && folder.layout.width)
      return { width: folder.layout.width, from: "folder" };
  }
  return { width: defaultWide ? "wide" : "default", from: "global" };
}

/** 페이지가 실제로 쓰는 본문 폭: 페이지 자신 → 상위 폴더 → 전체 설정 */
export function resolveBodyWidth(
  id: string,
  all: Record<string, WidthNode>,
  defaultWide: boolean,
): ResolvedWidth {
  const own = all[id]?.layout.width;
  if (own) return { width: own, from: "page" };
  return inheritedBodyWidth(id, all, defaultWide);
}

/** 저장할 레이아웃: 폭을 정하면 넣고, undefined면 상속으로 되돌린다(키를 없앤다) */
export function layoutWithWidth(
  layout: Page["layout"],
  width: BodyWidth | undefined,
): Page["layout"] {
  return width ? { ...layout, width } : { font: layout.font };
}
