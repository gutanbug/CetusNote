import type { createLowlight } from "lowlight";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

type Lowlight = ReturnType<typeof createLowlight>;

/** 코드 블록 하이라이트 플러그인의 키 이름(Tiptap이 쓰는 기본 lowlight 플러그인과 구분) */
const KEY = new PluginKey("codeHighlight");

type HastNode = {
  type?: string;
  value?: string;
  children?: HastNode[];
  properties?: { className?: unknown };
};

/** hast 트리를 글자 조각 + 클래스 목록으로 편다 (Tiptap lowlight 플러그인과 같은 규칙) */
function parseNodes(
  nodes: HastNode[],
  className: string[] = [],
): { text: string; classes: string[] }[] {
  return nodes.flatMap((node) => {
    const own = Array.isArray(node.properties?.className)
      ? (node.properties!.className as string[])
      : [];
    const classes = [...className, ...own];
    if (node.children) return parseNodes(node.children, classes);
    return [{ text: node.value ?? "", classes }];
  });
}

function highlightNodes(lowlight: Lowlight, language: string | null, text: string): HastNode[] {
  const languages = lowlight.listLanguages();
  const known = !!language && (languages.includes(language) || !!lowlight.registered?.(language));
  const result = (known ? lowlight.highlight(language!, text) : lowlight.highlightAuto(text)) as {
    value?: HastNode[];
    children?: HastNode[];
  };
  return result.value || result.children || [];
}

/** 한 코드 블록의 장식 (블록 안 글자마다 클래스를 붙인다) */
function blockDecorations(
  lowlight: Lowlight,
  defaultLanguage: string | null,
  node: PMNode,
  pos: number,
): Decoration[] {
  const out: Decoration[] = [];
  let from = pos + 1;
  const language = (node.attrs.language as string | null) || defaultLanguage;
  for (const part of parseNodes(highlightNodes(lowlight, language, node.textContent))) {
    const to = from + part.text.length;
    if (part.classes.length)
      out.push(Decoration.inline(from, to, { class: part.classes.join(" ") }));
    from = to;
  }
  return out;
}

/** 편집이 한 텍스트 블록 안의 글자만 바꾸는지 (각 단계의 범위가 같은 부모 블록 안이고, 넣는 것이 글자뿐) */
function onlyInlineEdits(tr: Transaction): boolean {
  return tr.steps.every((step, i) => {
    if (!(step instanceof ReplaceStep)) return false;
    const before = tr.docs[i]!;
    const $from = before.resolve(step.from);
    const $to = before.resolve(step.to);
    if (!$from.parent.isTextblock || !$from.sameParent($to)) return false;
    return step.slice.content.content.every((child) => child.isText);
  });
}

type Options = {
  /** 코드 블록 노드 이름 (CodeBlock) */
  name: string;
  lowlight: Lowlight;
  defaultLanguage: string | null;
};

/**
 * 코드 블록 하이라이트 (ED-CodeBlock). Tiptap의 기본 lowlight 플러그인은 글을 한 글자 칠 때마다
 * 문서의 모든 코드 블록을 다시 찾고(두 번의 전체 순회), 코드 블록이 많으면 입력이 수 초씩 멈춘다.
 * 이 플러그인은 바뀐 범위와 겹치는 코드 블록만 다시 칠한다. 나머지 장식은 그대로 옮긴다.
 * 결과는 기본 플러그인과 같다(바뀐 블록은 같은 규칙으로, 안 바뀐 블록은 이전 결과를 유지).
 */
export function incrementalLowlight({ name, lowlight, defaultLanguage }: Options): Plugin {
  /** 문서 전체의 장식 (처음 상태와 구조가 바뀐 편집의 기준) */
  const allDecorations = (doc: PMNode) => {
    const decorations: Decoration[] = [];
    doc.descendants((node, pos) => {
      if (node.type.name !== name) return true;
      decorations.push(...blockDecorations(lowlight, defaultLanguage, node, pos));
      return false;
    });
    return DecorationSet.create(doc, decorations);
  };
  return new Plugin({
    key: KEY,
    state: {
      init: (_, { doc }) => allDecorations(doc),
      apply: (tr, set) => {
        if (!tr.docChanged) return set;
        const doc = tr.doc;
        // 블록 구조가 바뀌는 편집(문단과 코드 블록을 잇거나 가르는 삭제, 블록 붙여넣기, 노드 속성 변경)은
        // 장식 위치를 옮겨 봐야 낡은 글자가 남으므로 전체를 다시 칠한다. 한 블록 안의 글자 편집만 증분으로 처리한다.
        if (!onlyInlineEdits(tr)) return allDecorations(doc);
        // 바뀐 범위(새 문서 좌표)를 모은다
        const ranges: [number, number][] = [];
        tr.mapping.maps.forEach((map, i) => {
          const rest = tr.mapping.slice(i + 1);
          map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
            ranges.push([rest.map(newStart, -1), rest.map(newEnd, 1)]);
          });
        });
        let next = set.map(tr.mapping, doc);
        // 바뀐 범위가 닿는 코드 블록을 찾는다 (경계에 닿은 블록도 다시 칠해 안전하게 둔다)
        const affected = new Map<number, PMNode>();
        for (const [from, to] of ranges) {
          next = next.remove(next.find(from, to));
          doc.nodesBetween(
            Math.max(0, from - 1),
            Math.min(doc.content.size, to + 1),
            (node, pos) => {
              if (node.type.name !== name) return true;
              affected.set(pos, node);
              return false;
            },
          );
        }
        for (const [pos, node] of affected) {
          next = next.remove(next.find(pos, pos + node.nodeSize));
          next = next.add(doc, blockDecorations(lowlight, defaultLanguage, node, pos));
        }
        return next;
      },
    },
    props: {
      decorations(state) {
        return KEY.getState(state);
      },
    },
  });
}
