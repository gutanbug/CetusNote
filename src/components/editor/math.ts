import { InputRule, mergeAttributes, Node } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

export type MathClick = (kind: "inline" | "block", node: PMNode, pos: number) => void;

type Katex = typeof import("katex").default;

// KaTeX(JS·CSS)는 수식이 실제로 그려질 때 한 번만 받는다. 스키마(노드 모양)에는 필요 없다.
let katexLoad: Promise<Katex> | null = null;
let katexReady: Katex | null = null;

/** KaTeX를 한 번만 불러온다. 실패하면 다음 호출에서 다시 시도한다 */
function loadKatex(): Promise<Katex> {
  katexLoad ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(
    ([mod]) => {
      katexReady = mod.default;
      return mod.default;
    },
    (error: unknown) => {
      katexLoad = null;
      throw error;
    },
  );
  return katexLoad;
}

// 잘못된 식은 원문 LaTeX를 빨간색으로 보인다(editor.css의 *-math-error)
const katexOptions = { throwOnError: true };
const blockKatexOptions = { ...katexOptions, displayMode: true };

type MathKind = "inline" | "block";

/**
 * 수식 노드 뷰. KaTeX가 아직 없으면 원문 LaTeX를 흐리게 보이고, 불러오면 다시 그린다.
 * 원래 @tiptap/extension-mathematics의 노드 뷰와 같은 DOM 구조다.
 */
function mathView(
  kind: MathKind,
  node: PMNode,
  getPos: () => number | undefined,
  editable: boolean,
  onClick: ((node: PMNode, pos: number) => void) | undefined,
) {
  const inline = kind === "inline";
  const latex: string = node.attrs.latex ?? "";
  const wrapper = document.createElement(inline ? "span" : "div");
  const inner = document.createElement("div");
  inner.className = "block-math-inner";
  wrapper.className = "tiptap-mathematics-render";
  if (editable) wrapper.classList.add("tiptap-mathematics-render--editable");
  wrapper.dataset.type = inline ? "inline-math" : "block-math";
  wrapper.setAttribute("data-latex", latex);

  const errorClass = inline ? "inline-math-error" : "block-math-error";
  let alive = true;

  const showError = () => {
    wrapper.classList.remove("math-pending");
    wrapper.textContent = latex;
    wrapper.classList.add(errorClass);
  };

  const paint = (katex: Katex) => {
    if (!alive) return;
    try {
      if (inline) {
        katex.render(latex, wrapper, katexOptions);
      } else {
        wrapper.replaceChildren(inner);
        katex.render(latex, inner, blockKatexOptions);
      }
      wrapper.classList.remove("math-pending", errorClass);
    } catch {
      showError();
    }
  };

  if (katexReady) {
    paint(katexReady);
  } else {
    // 대기 중: 원문을 흐리게 보인다
    wrapper.classList.add("math-pending");
    wrapper.textContent = latex;
    loadKatex().then(
      (katex) => paint(katex),
      () => {
        if (alive) showError();
      },
    );
  }

  const handleClick = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    const pos = getPos();
    if (pos == null) return;
    onClick?.(node, pos);
  };
  if (onClick) wrapper.addEventListener("click", handleClick);

  return {
    dom: wrapper,
    destroy() {
      alive = false;
      wrapper.removeEventListener("click", handleClick);
    },
  };
}

// 원래 Tiptap 수식 확장과 같은 `$$x$$` 인라인 찾기 (코드 안의 `$`는 건너뛴다)
const findInlineMath = (text: string) => {
  const pattern = /\$\$([^$\n]+?)\$\$(?!\$)/g;
  let match = pattern.exec(text);
  while (match !== null) {
    if (match.index === 0 || text[match.index - 1] !== "$")
      return { index: match.index, text: match[0], data: { latex: match[1] } };
    pattern.lastIndex = match.index + 1;
    match = pattern.exec(text);
  }
  return null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineMath: {
      insertInlineMath: (options: { latex: string; pos?: number }) => ReturnType;
      deleteInlineMath: (options?: { pos?: number }) => ReturnType;
      updateInlineMath: (options?: { latex?: string; pos?: number }) => ReturnType;
    };
    blockMath: {
      insertBlockMath: (options: { latex: string; pos?: number }) => ReturnType;
      deleteBlockMath: (options?: { pos?: number }) => ReturnType;
      updateBlockMath: (options?: { latex?: string; pos?: number }) => ReturnType;
    };
  }
}

/**
 * ED-Math — KaTeX 수식.
 * - 인라인: `$x^2$` (Tiptap 기본 `$$x$$`도 동작). `$5`처럼 숫자로 시작하면 바꾸지 않는다.
 * - 블록: 빈 줄에 `$$$` + 스페이스(편집 팝오버가 열린다) 또는 `$$$식$$$`
 * - 편집: 누르거나, 방향키로 고른 뒤 Enter
 */
export function mathExtensions(onClick: MathClick) {
  // 방향키로 수식을 고른 뒤(노드 선택) Enter를 누르면 누를 때와 같이 편집 팝오버를 연다
  const enterToEdit = (kind: MathKind, name: string) => ({
    Enter: ({ editor }: { editor: { state: { selection: unknown } } }) => {
      const sel = editor.state.selection;
      if (!(sel instanceof NodeSelection) || sel.node.type.name !== name) return false;
      onClick(kind, sel.node, sel.from);
      return true;
    },
  });

  const Inline = Node.create<{ onClick?: (node: PMNode, pos: number) => void }>({
    name: "inlineMath",
    group: "inline",
    inline: true,
    atom: true,
    addOptions() {
      return { onClick: undefined };
    },
    addAttributes() {
      return {
        latex: {
          default: "",
          parseHTML: (element) => element.getAttribute("data-latex"),
          renderHTML: (attributes) => ({ "data-latex": attributes.latex }),
        },
      };
    },
    addCommands() {
      return {
        insertInlineMath:
          ({ latex, pos }) =>
          ({ editor, tr }) => {
            const from = pos ?? editor.state.selection.from;
            if (!latex) return false;
            tr.replaceWith(from, from, this.type.create({ latex }));
            return true;
          },
        deleteInlineMath:
          (options) =>
          ({ editor, tr }) => {
            const pos = options?.pos ?? editor.state.selection.from;
            const node = editor.state.doc.nodeAt(pos);
            if (!node || node.type.name !== this.name) return false;
            tr.delete(pos, pos + node.nodeSize);
            return true;
          },
        updateInlineMath:
          (options) =>
          ({ editor, tr }) => {
            const pos = options?.pos ?? editor.state.selection.$from.pos;
            const node = editor.state.doc.nodeAt(pos);
            if (!node || node.type.name !== this.name) return false;
            tr.setNodeMarkup(pos, this.type, {
              ...node.attrs,
              latex: options?.latex ?? node.attrs.latex,
            });
            return true;
          },
      };
    },
    parseHTML() {
      return [{ tag: 'span[data-type="inline-math"]' }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["span", mergeAttributes(HTMLAttributes, { "data-type": "inline-math" })];
    },
    parseMarkdown: (token) => ({ type: "inlineMath", attrs: { latex: token.latex } }),
    renderMarkdown: (node) => `$${node.attrs?.latex || ""}$`,
    markdownTokenizer: {
      name: "inlineMath",
      level: "inline",
      start: (src: string) => src.indexOf("$"),
      tokenize: (src: string) => {
        const match = src.match(/^\$([^$]+)\$(?!\$)/);
        if (!match) return;
        return { type: "inlineMath", raw: match[0], latex: match[1].trim() };
      },
    },
    addKeyboardShortcuts() {
      return enterToEdit("inline", this.name);
    },
    addInputRules() {
      return [
        new InputRule({
          find: findInlineMath,
          handler: ({ state, range, match }) => {
            const latex = (match.data as { latex?: unknown } | undefined)?.latex;
            if (typeof latex !== "string") return null;
            state.tr.replaceWith(range.from, range.to, this.type.create({ latex }));
          },
        }),
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
    addNodeView() {
      return ({ node, getPos, editor }) =>
        mathView("inline", node, getPos, editor.isEditable, this.options.onClick);
    },
  }).configure({ onClick: (node, pos) => onClick("inline", node, pos) });

  const Block = Node.create<{ onClick?: (node: PMNode, pos: number) => void }>({
    name: "blockMath",
    group: "block",
    atom: true,
    addOptions() {
      return { onClick: undefined };
    },
    addAttributes() {
      return {
        latex: {
          default: "",
          parseHTML: (element) => element.getAttribute("data-latex"),
          renderHTML: (attributes) => ({ "data-latex": attributes.latex }),
        },
      };
    },
    addCommands() {
      return {
        insertBlockMath:
          ({ latex, pos }) =>
          ({ commands, editor }) => {
            if (!latex) return false;
            return commands.insertContentAt(pos ?? editor.state.selection.from, {
              type: this.name,
              attrs: { latex },
            });
          },
        deleteBlockMath:
          (options) =>
          ({ editor, tr }) => {
            const pos = options?.pos ?? editor.state.selection.from;
            const node = editor.state.doc.nodeAt(pos);
            if (!node || node.type.name !== this.name) return false;
            tr.delete(pos, pos + node.nodeSize);
            return true;
          },
        updateBlockMath:
          (options) =>
          ({ editor, tr }) => {
            const pos = options?.pos ?? editor.state.selection.$from.pos;
            const node = editor.state.doc.nodeAt(pos);
            if (!node || node.type.name !== this.name) return false;
            tr.setNodeMarkup(pos, this.type, {
              ...node.attrs,
              latex: options?.latex ?? node.attrs.latex,
            });
            return true;
          },
      };
    },
    parseHTML() {
      return [{ tag: 'div[data-type="block-math"]' }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["div", mergeAttributes(HTMLAttributes, { "data-type": "block-math" })];
    },
    parseMarkdown: (token) => ({ type: "blockMath", attrs: { latex: token.latex } }),
    renderMarkdown: (node) => ["$$", node.attrs?.latex || "", "$$"].join("\n"),
    markdownTokenizer: {
      name: "blockMath",
      level: "block",
      start: (src: string) => src.indexOf("$$"),
      tokenize: (src: string) => {
        const match = src.match(/^\$\$([^$]+)\$\$/);
        if (!match) return;
        return { type: "blockMath", raw: match[0], latex: match[1].trim() };
      },
    },
    addKeyboardShortcuts() {
      return enterToEdit("block", this.name);
    },
    addInputRules() {
      return [
        new InputRule({
          find: /^\$\$\$([^$]+)\$\$\$$/,
          handler: ({ state, range, match }) => {
            const $from = state.doc.resolve(range.from);
            const node = this.type.create({ latex: match[1] });
            const whole =
              $from.depth > 0 &&
              $from.parent.isTextblock &&
              range.from === $from.start() &&
              range.to === $from.end();
            const replace = whole ? { from: $from.before(), to: $from.after() } : range;
            state.tr.replaceWith(replace.from, replace.to, node);
          },
        }),
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
    addNodeView() {
      return ({ node, getPos, editor }) =>
        mathView("block", node, getPos, editor.isEditable, this.options.onClick);
    },
  }).configure({ onClick: (node, pos) => onClick("block", node, pos) });

  return [Inline, Block];
}
