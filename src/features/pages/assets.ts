import { iconAssetPath, imageValue } from "@/lib/page-icon";
import type { Page } from "@/lib/storage";

/**
 * 페이지가 쓰는 이미지 경로(EDIT-14 본문 이미지, PAGE-03 커버, PAGE-10 아이콘 이미지).
 * 경로는 `assets/<페이지 id>/<파일>` — 다른 페이지의 폴더를 가리킬 수도 있다(복제, 페이지 사이 복사).
 */

type Node = { type?: string; attrs?: Record<string, unknown>; content?: Node[] };

/** 이미지 파일인지 (저장 이름이 `img-`로 시작한다. 첨부는 `<첨부 id>-<이름>`) */
export function isImageAssetPath(path: string): boolean {
  return (path.split("/").pop() ?? "").startsWith("img-");
}

/** 첨부 파일의 저장 이름에서 첨부 id를 뗀 이름 (복사할 때 쓴다) */
export function attachmentFileName(path: string): string {
  const base = path.split("/").pop() ?? "";
  const dash = base.indexOf("-");
  return dash >= 0 ? base.slice(dash + 1) : base;
}

/** `assets/<id>/…`의 id. 형식이 아니면 null */
export function assetOwner(src: string): string | null {
  return /^assets\/([^/]+)\/[^/]+$/.exec(src)?.[1] ?? null;
}

/**
 * 페이지가 쓰는 이미지 경로 전부 (커버 + 아이콘 + 본문 이미지).
 * attachments: true면 파일 첨부 블록(EDIT-31~33)의 경로도 넣는다 — 폴더 주인이 지워질 때 옮기는 데 쓴다.
 */
export function assetRefs(
  page: Pick<Page, "cover" | "content" | "icon">,
  options: { attachments?: boolean } = {},
): string[] {
  const out = new Set<string>();
  if (page.cover) out.add(page.cover);
  const icon = iconAssetPath(page.icon);
  if (icon) out.add(icon);
  const walk = (n: Node) => {
    if (n.type === "image" && typeof n.attrs?.src === "string") out.add(n.attrs.src);
    if (options.attachments && n.type === "attachment" && typeof n.attrs?.path === "string")
      out.add(n.attrs.path);
    n.content?.forEach(walk);
  };
  walk(page.content as Node);
  return [...out];
}

/** 이미지 경로를 바꾼 커버·아이콘·본문 */
export function replaceAssetRefs<P extends Pick<Page, "cover" | "content" | "icon">>(
  page: P,
  map: ReadonlyMap<string, string>,
): Pick<Page, "cover" | "content" | "icon"> {
  const walk = (n: Node): Node => {
    // 이미지는 src, 파일 첨부는 path에 경로를 든다
    const key = n.type === "image" ? "src" : n.type === "attachment" ? "path" : null;
    const src = key ? n.attrs?.[key] : undefined;
    const next =
      key && typeof src === "string" && map.has(src)
        ? { ...n, attrs: { ...n.attrs, [key]: map.get(src) } }
        : n;
    if (!n.content) return next;
    const content = n.content.map(walk);
    return content.some((c, i) => c !== n.content![i]) ? { ...next, content } : next;
  };
  const icon = iconAssetPath(page.icon);
  return {
    cover: page.cover && (map.get(page.cover) ?? page.cover),
    icon: icon && map.has(icon) ? imageValue(map.get(icon)!) : page.icon,
    content: walk(page.content as Node) as Page["content"],
  };
}
