/**
 * 페이지 아이콘 값 (PAGE-10) — `page.icon` 문자열 하나에 세 종류를 담는다.
 *
 * | 종류   | 값                                       |
 * | ------ | ---------------------------------------- |
 * | 이모지 | 이모지 그대로 (예 `📝`)                  |
 * | 아이콘 | `lucide:<이름>` 또는 `lucide:<이름>:<색>` |
 * | 이미지 | `image:assets/<페이지 id>/<파일>`        |
 */

export type PageIconValue =
  | { kind: "emoji"; emoji: string }
  | { kind: "icon"; name: string; color: string | null }
  | { kind: "image"; path: string };

const ICON = /^lucide:([a-z0-9]+(?:-[a-z0-9]+)*)(?::([a-z]+))?$/;
const IMAGE = /^image:(assets\/[^/]+\/[^/]+)$/;

/** 저장된 값 → 종류. 빈 값은 null */
export function parsePageIcon(value: string | null | undefined): PageIconValue | null {
  if (!value) return null;
  const icon = ICON.exec(value);
  if (icon) return { kind: "icon", name: icon[1]!, color: icon[2] ?? null };
  const image = IMAGE.exec(value);
  if (image) return { kind: "image", path: image[1]! };
  return { kind: "emoji", emoji: value };
}

/** lucide 아이콘 값 (색이 없거나 기본색이면 이름만) */
export function iconValue(name: string, color?: string | null): string {
  return color && color !== "default" ? `lucide:${name}:${color}` : `lucide:${name}`;
}

/** 올린 이미지 값 */
export function imageValue(path: string): string {
  return `image:${path}`;
}

/** 이모지일 때만 그 글자 (Markdown 제목·글로만 보이는 곳) */
export function emojiOf(value: string | null | undefined): string | null {
  const v = parsePageIcon(value);
  return v?.kind === "emoji" ? v.emoji : null;
}

/** 이미지 아이콘이면 그 저장 경로 */
export function iconAssetPath(value: string | null | undefined): string | null {
  const v = parsePageIcon(value);
  return v?.kind === "image" ? v.path : null;
}
