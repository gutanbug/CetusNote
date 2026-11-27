import { msg } from "@/lib/i18n";
/**
 * 목차(ED-TableOfContents)와 마크다운 내보내기가 같이 쓰는 제목 계산. Tiptap JSON만 읽는 순수 함수다.
 * 규칙은 `components/editor/outline.ts`의 getHeadings와 같다: H1–H3, 글자도 덩어리도 없는 제목 제외, 글자 블록 안은 들어가지 않는다.
 */

export type TocNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  content?: TocNode[];
};

export type TocEntry = {
  /** 1–3 */
  level: number;
  /** 다듬은 제목 글자 */
  text: string;
  /** 들여쓰기 단계(0부터). 건너뛴 수준(H1 → H3)도 바로 아래 단계로 붙인다 */
  depth: number;
  /** GitHub 방식 앵커 (`#slug`). 같은 이름이면 `-1`, `-2`를 붙인다 */
  slug: string;
  /** 제목 노드 자체 (링크 글자를 마크다운으로 옮길 때 쓴다) */
  node: TocNode;
};

const MAX_LEVEL = 3;
/** 글자가 들어 있어 제목을 찾으면 안 되는 블록 */
const TEXT_BLOCKS = new Set(["paragraph", "heading", "codeBlock"]);

/**
 * 노드 안의 글자를 이어 붙인다. 인라인 덩어리(페이지 멘션 등, 글자가 없는 노드)는 label 속성을 쓴다.
 * 본문 목차(outline.ts의 headingText)와 같은 규칙이다.
 */
export function plainText(node: TocNode): string {
  if (node.text !== undefined) return node.text;
  if (node.content?.length) return node.content.map(plainText).join("");
  return typeof node.attrs?.label === "string" ? node.attrs.label : "";
}

/** 제목 수준 목록 → 들여쓰기 단계. 위로 올라가면 같거나 더 깊은 단계를 닫는다 */
export function tocDepths(levels: number[]): number[] {
  const stack: number[] = [];
  return levels.map((level) => {
    while (stack.length && stack[stack.length - 1]! >= level) stack.pop();
    const depth = stack.length;
    stack.push(level);
    return depth;
  });
}

/** GitHub 방식 앵커 글자: 소문자, 기호 빼기, 공백은 `-`. 같은 앵커는 `-1`, `-2`로 구분한다 */
export function slugOf(text: string, used: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || "heading";
  const seen = used.get(base) ?? 0;
  used.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen}`;
}

/** 문서(또는 조각) 안의 H1–H3를 문서 순서대로. 빈 제목은 뺀다 */
export function collectHeadings(root: TocNode | undefined): TocEntry[] {
  const found: { level: number; text: string; node: TocNode }[] = [];
  const walk = (node: TocNode) => {
    if (node.type === "heading") {
      const level = Number(node.attrs?.level ?? 1) || 1;
      const label = plainText(node).trim();
      // 글자 없이 멘션만 있는 제목도 넣는다. 글자도 덩어리도 없는 제목만 뺀다
      const hasInline = (node.content ?? []).some((child) => child.text === undefined);
      if (level <= MAX_LEVEL && (label || hasInline))
        found.push({ level, text: label || msg().features.untitled, node });
      return;
    }
    if (node.type && TEXT_BLOCKS.has(node.type)) return;
    node.content?.forEach(walk);
  };
  if (root) walk(root);

  const depths = tocDepths(found.map((h) => h.level));
  const used = new Map<string, number>();
  return found.map((h, i) => ({
    level: h.level,
    text: h.text,
    depth: depths[i]!,
    slug: slugOf(h.text, used),
    node: h.node,
  }));
}
