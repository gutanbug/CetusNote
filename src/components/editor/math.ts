import { InputRule } from "@tiptap/core";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

export type MathClick = (kind: "inline" | "block", node: PMNode, pos: number) => void;

// 잘못된 식은 원문 LaTeX를 빨간색으로 보인다(editor.css의 *-math-error)
const katexOptions = { throwOnError: true };

/**
 * ED-Math — KaTeX 수식.
 * - 인라인: `$x^2$` (Tiptap 기본 `$$x$$`도 동작). `$5`처럼 숫자로 시작하면 바꾸지 않는다.
 * - 블록: 빈 줄에 `$$$` + 스페이스(편집 팝오버가 열린다) 또는 `$$$식$$$`
 * - 편집: 누르거나, 방향키로 고른 뒤 Enter
 */
export function mathExtensions(onClick: MathClick) {
  // 방향키로 수식을 고른 뒤(노드 선택) Enter를 누르면 누를 때와 같이 편집 팝오버를 연다
  const enterToEdit = (kind: "inline" | "block", name: string) => ({
    Enter: ({ editor }: { editor: { state: { selection: unknown } } }) => {
      const sel = editor.state.selection;
      if (!(sel instanceof NodeSelection) || sel.node.type.name !== name) return false;
      onClick(kind, sel.node, sel.from);
      return true;
    },
  });

  const Inline = InlineMath.extend({
    addKeyboardShortcuts() {
      return enterToEdit("inline", this.name);
    },
    addInputRules() {
      return [
        ...(this.parent?.() ?? []),
        new InputRule({
          find: /(?:^|[^$\w])\$([^$\s\d](?:[^$\n]*[^$\s])?)\$$/,
          handler: ({ state, range, match }) => {
            const latex = match[1];
            const start = range.to - latex.length - 2;
            state.tr.replaceWith(start, range.to, this.type.create({ latex }));
          },
        }),
      ];
    },
  }).configure({ katexOptions, onClick: (node, pos) => onClick("inline", node, pos) });

  const Block = BlockMath.extend({
    addKeyboardShortcuts() {
      return enterToEdit("block", this.name);
    },
    addInputRules() {
      return [
        ...(this.parent?.() ?? []),
        // 빈 문단에 `$$$ ` — 슬래시 메뉴 "수식 블록"과 같다: 빈 수식을 넣고 편집 팝오버를 연다
        new InputRule({
          find: /^\$\$\$\s$/,
          handler: ({ state, range }) => {
            const $from = state.doc.resolve(range.from);
            const para = $from.parent;
            if (para.type.name !== "paragraph" || para.content.size !== range.to - range.from)
              return null;
            const at = $from.before();
            const node = this.type.create({ latex: "" });
            state.tr.replaceWith(at, $from.after(), node);
            // 문서에 들어간 뒤에 연다(팝오버가 노드 위치를 잰다)
            setTimeout(() => onClick("block", node, at));
          },
        }),
      ];
    },
  }).configure({
    katexOptions: { ...katexOptions, displayMode: true },
    onClick: (node, pos) => onClick("block", node, pos),
  });

  return [Inline, Block];
}
