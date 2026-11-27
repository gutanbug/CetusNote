import {
  InputRule,
  Node,
  PasteRule,
  combineTransactionSteps,
  findChildrenInRange,
  getChangedRanges,
  isFirefox,
  mergeAttributes,
} from "@tiptap/core";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { NodeView } from "@tiptap/pm/view";
import { Suggestion } from "@tiptap/suggestion";
import {
  findEmoji,
  getEmojiTable,
  isEmojiSupported,
  onEmojiTableLoad,
  prefetchEmojiTable,
  removeVariationSelector,
} from "@/lib/emoji/table";

/**
 * 이모지 노드 (SYS-11). Tiptap `@tiptap/extension-emoji`의 노드와 같은 스키마·JSON·DOM을 쓴다
 * (`{type:"emoji", attrs:{name}}`, `span[data-type="emoji"]`). 차이는 전체 목록을 시작 번들에서
 * 빼고, 처음 필요할 때 `lib/emoji/table`로 가져온다는 점이다. 가져오기 전에는 짧은 목록으로 그린다.
 */

/** `:` 단축 코드 제안의 플러그인 키 (emoji-shortcode.ts가 쓴다) */
export const EmojiSuggestionPluginKey = new PluginKey("emojiSuggestion");

const INPUT_RE = /:([a-zA-Z0-9_+-]+):$/;
const PASTE_RE = /(^|\s):([a-zA-Z0-9_+-]+):/g;
/** 표가 막 준비됐을 때 문서 전체를 다시 훑는 표시 (입력된 이모지 글자를 노드로 바꾼다) */
const RESCAN_META = "emojiTableRescan";
/** 이모지 글자가 있을 수 있는 글자 (표를 가져올지 정하는 가벼운 검사) */
const EMOJI_HINT_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}⃣]/u;

type EmojiDisplay = { text: string } | { src: string; alt: string };

/** 화면에 그릴 내용. Tiptap renderHTML과 같은 순서로 판단한다 */
function emojiDisplay(name: string): EmojiDisplay {
  const entry = findEmoji(name, "editor");
  if (!entry) return { text: `:${name}:` };
  const hasEmoji = !!entry.emoji;
  const hasFallbackImage = !!entry.fallbackImage;
  if ((!isEmojiSupported(entry) || !hasEmoji) && hasFallbackImage) {
    return { src: entry.fallbackImage!, alt: `${entry.name} emoji` };
  }
  return { text: entry.emoji || `:${entry.shortcodes[0]}:` };
}

/** 이름 → 저장할 이름. 표가 없으면 짧은 목록에서만 찾고, 못 찾으면 표를 가져온다 */
function resolveName(name: string): boolean {
  if (findEmoji(name, "editor")) return true;
  if (!getEmojiTable()) prefetchEmojiTable();
  return false;
}

/** 노드 보기: 가져오기 전에 그리고 가져온 뒤에 다시 그린다 */
class EmojiNodeView implements NodeView {
  dom: HTMLElement;
  private node: ProseMirrorNode;
  private off: () => void;

  constructor(node: ProseMirrorNode) {
    this.node = node;
    this.dom = document.createElement("span");
    this.dom.setAttribute("data-type", "emoji");
    this.paint();
    this.off = onEmojiTableLoad(() => this.paint());
    prefetchEmojiTable();
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.paint();
    return true;
  }

  // 글자 내용은 우리가 바꾼다. 브라우저의 DOM 변경을 편집으로 읽지 않는다
  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.off();
  }

  private paint(): void {
    const name = this.node.attrs.name;
    if (name == null) this.dom.removeAttribute("data-name");
    else this.dom.setAttribute("data-name", String(name));
    const display = emojiDisplay(String(name));
    if ("src" in display) {
      const img = document.createElement("img");
      img.src = display.src;
      img.draggable = false;
      img.loading = "lazy";
      img.setAttribute("align", "absmiddle");
      img.alt = display.alt;
      this.dom.replaceChildren(img);
    } else {
      this.dom.textContent = display.text;
    }
  }
}

export const Emoji = Node.create<{
  HTMLAttributes: Record<string, unknown>;
  // 항목 타입은 호출하는 쪽(emoji-shortcode.ts)이 정한다
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  suggestion: Partial<Omit<SuggestionOptions<any, any>, "editor">>;
}>({
  name: "emoji",

  inline: true,

  group: "inline",

  selectable: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {},
    };
  },

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => element.dataset.name,
        renderHTML: (attributes) => ({ "data-name": attributes.name }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[data-type="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const attributes = mergeAttributes(HTMLAttributes, this.options.HTMLAttributes, {
      "data-type": this.name,
    });
    const display = emojiDisplay(String(node.attrs.name));
    if ("src" in display) {
      return [
        "span",
        attributes,
        [
          "img",
          {
            src: display.src,
            draggable: "false",
            loading: "lazy",
            align: "absmiddle",
            alt: display.alt,
          },
        ],
      ];
    }
    return ["span", attributes, display.text];
  },

  renderText({ node }) {
    const entry = findEmoji(String(node.attrs.name), "editor");
    return entry?.emoji || `:${node.attrs.name}:`;
  },

  renderMarkdown: (node) => {
    if (!node.attrs?.name) return "";
    return `:${node.attrs.name}:`;
  },

  addNodeView() {
    return ({ node }) => new EmojiNodeView(node);
  },

  addCommands() {
    return {
      setEmoji:
        (shortcode: string) =>
        ({ chain }) => {
          const entry = findEmoji(shortcode, "editor");
          if (!entry) {
            prefetchEmojiTable();
            return false;
          }
          chain()
            .insertContent({ type: this.name, attrs: { name: entry.name } })
            .command(({ tr, state }) => {
              tr.setStoredMarks(state.doc.resolve(state.selection.to - 1).marks());
              return true;
            })
            .run();
          return true;
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: INPUT_RE,
        handler: ({ range, match, chain }) => {
          const name = match[1];
          if (!resolveName(name)) return;
          chain()
            .insertContentAt(range, { type: this.name, attrs: { name } })
            .command(({ tr, state }) => {
              tr.setStoredMarks(state.doc.resolve(state.selection.to - 1).marks());
              return true;
            })
            .run();
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: PASTE_RE,
        handler: ({ range, match, chain }) => {
          const prefix = match[1] || "";
          const name = match[2];
          if (!resolveName(name)) return;
          const shortcodeFrom = range.from + prefix.length;
          chain()
            .insertContentAt(
              { from: shortcodeFrom, to: range.to },
              { type: this.name, attrs: { name } },
              { updateSelection: false },
            )
            .command(({ tr, state }) => {
              tr.setStoredMarks(state.doc.resolve(state.selection.to - 1).marks());
              return true;
            })
            .run();
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const type = this.type;
    return [
      Suggestion({
        editor: this.editor,
        char: ":",
        pluginKey: EmojiSuggestionPluginKey,
        ...this.options.suggestion,
      }),
      new Plugin({
        key: new PluginKey("emoji"),
        view: (view) => {
          // 표가 준비되면 문서 전체에서 이모지 글자를 노드로 바꾼다 (표가 없을 때 입력된 글자 포함)
          const off = onEmojiTableLoad(() => {
            // 되돌리기 기록에 넣지 않는다 — 사용자가 한 입력의 undo 단위를 바꾸지 않게
            if (!view.isDestroyed)
              view.dispatch(
                view.state.tr.setMeta(RESCAN_META, true).setMeta("addToHistory", false),
              );
          });
          return { destroy: off };
        },
        props: {
          handleKeyDown: (view, event) => {
            if (!isFirefox()) return false;
            const isLeft = event.key === "ArrowLeft";
            const isRight = event.key === "ArrowRight";
            if (!isLeft && !isRight) return false;
            if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return false;
            const { state } = view;
            const { selection } = state;
            if (!selection.empty || !(selection instanceof TextSelection)) return false;
            const $pos = selection.$from;
            if (isLeft) {
              const nodeBefore = $pos.nodeBefore;
              if (!nodeBefore || nodeBefore.type !== type) return false;
              const newPos = $pos.pos - nodeBefore.nodeSize;
              if (newPos >= $pos.start()) {
                view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, newPos)));
                return true;
              }
            } else {
              const nodeAfter = $pos.nodeAfter;
              if (!nodeAfter || nodeAfter.type !== type) return false;
              const newPos = $pos.pos + nodeAfter.nodeSize;
              if (newPos <= $pos.end()) {
                view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, newPos)));
                return true;
              }
            }
            return false;
          },
          handleDoubleClickOn: (_view, pos, node) => {
            if (node.type !== type) return false;
            this.editor.commands.setTextSelection({ from: pos, to: pos + node.nodeSize });
            return true;
          },
        },
        appendTransaction: (transactions, oldState, newState) => {
          if (this.editor.view.composing) return;
          const rescan = transactions.some((t) => t.getMeta(RESCAN_META));
          if (
            !rescan &&
            !(transactions.some((t) => t.docChanged) && !oldState.doc.eq(newState.doc))
          )
            return;
          const ranges = rescan
            ? [{ from: 0, to: newState.doc.content.size }]
            : getChangedRanges(combineTransactionSteps(oldState.doc, [...transactions])).map(
                (r) => r.newRange,
              );
          const texts: { node: ProseMirrorNode; pos: number }[] = [];
          ranges.forEach((range) => {
            if (newState.doc.resolve(range.from).parent.type.spec.code) return;
            texts.push(...findChildrenInRange(newState.doc, range, (node) => node.type.isText));
          });
          const table = getEmojiTable();
          if (!table) {
            // 표가 없을 때는 이모지 글자가 보이면 가져온다. 가져온 뒤 문서 전체를 다시 훑는다
            if (texts.some(({ node }) => !!node.text && EMOJI_HINT_RE.test(node.text)))
              prefetchEmojiTable();
            return;
          }
          const { tr } = newState;
          texts.forEach(({ node, pos }) => {
            if (!node.text) return;
            [...node.text.matchAll(table.emojiRegex())].forEach((match) => {
              if (match.index === undefined) return;
              const emoji = match[0];
              const name = table.editor.byChar.get(removeVariationSelector(emoji));
              if (!name) return;
              const from = tr.mapping.map(pos + match.index);
              if (newState.doc.resolve(from).parent.type.spec.code) return;
              tr.replaceRangeWith(from, from + emoji.length, type.create({ name }));
              tr.setStoredMarks(newState.doc.resolve(from).marks());
            });
          });
          if (!tr.steps.length) return;
          if (rescan) tr.setMeta("addToHistory", false);
          return tr;
        },
      }),
    ];
  },
});
