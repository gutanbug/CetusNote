import {
  Extension,
  Node,
  mergeAttributes,
  nodePasteRule,
  type Editor,
  type Range,
} from "@tiptap/core";
import { NodeSelection, PluginKey } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { FileText, FileX } from "lucide-react";
import * as React from "react";
import { PageIcon } from "@/components/ui/page-icon";

/** 멘션할 수 있는 페이지 (제안 목록 · 칩) */
export type MentionTarget = { id: string; title: string; icon?: string | null };

/**
 * 멘션이 페이지를 찾고 여는 방법 — 위 계층이 준다(에디터는 저장을 모른다).
 * resolve가 null이면 깨진 링크(지워졌거나 휴지통)다.
 */
export type MentionSource = {
  search: (query: string) => MentionTarget[];
  resolve: (id: string) => MentionTarget | null;
  /** ⌘클릭이면 newTab (SHELL-11) */
  onOpen: (id: string, opts?: { newTab: boolean }) => void;
};

/** 페이지 링크 주소 (PAGE-05 링크 복사와 같다) */
export const PAGE_LINK_PREFIX = "cetusnote://page/";
const PAGE_LINK = /cetusnote:\/\/page\/([\w-]+)/g;

const MentionContext = React.createContext<MentionSource | null>(null);
/** NoteEditor가 EditorContent 바깥에 둔다 — 칩(노드 뷰)이 제목을 늘 새로 읽는다 */
export const MentionProvider = MentionContext.Provider;

// ── 칩 ───────────────────────────────────────────────

/**
 * ED-PageMention 칩 — 프로토타입 `.mention`. 대상의 지금 제목·아이콘을 보인다.
 * 대상이 없으면 저장해 둔 이름을 흐리게 줄을 그어 보이고 누를 수 없다.
 */
export function MentionChip({
  target,
  label,
  onOpen,
  selected,
}: {
  target: MentionTarget | null;
  /** 넣을 때의 제목 — 깨진 링크에서 보인다 */
  label: string;
  onOpen?: (opts: { newTab: boolean }) => void;
  selected?: boolean;
}) {
  const broken = !target;
  const title = target ? target.title || "제목 없음" : label || "제목 없음";
  return (
    <span
      role={broken ? undefined : "link"}
      data-broken={broken || undefined}
      data-selected={selected || undefined}
      title={broken ? "지워진 페이지예요" : `${title} 열기`}
      aria-label={broken ? `${title} (지워진 페이지)` : undefined}
      className="sn-mention"
      onClick={(e) => {
        if (broken) return;
        e.preventDefault();
        onOpen?.({ newTab: e.metaKey || e.ctrlKey });
      }}
    >
      {broken ? (
        <FileX strokeWidth={1.5} className="sn-mention-icon" aria-hidden />
      ) : target.icon ? (
        <PageIcon icon={target.icon} />
      ) : (
        <FileText strokeWidth={1.5} className="sn-mention-icon" aria-hidden />
      )}
      <span className="sn-mention-title">{title}</span>
    </span>
  );
}

function MentionView({ node, selected }: ReactNodeViewProps) {
  const source = React.useContext(MentionContext);
  const id = String(node.attrs.id ?? "");
  const target = source?.resolve(id) ?? null;
  return (
    <NodeViewWrapper as="span" data-page-mention={id}>
      <MentionChip
        target={target}
        label={String(node.attrs.label ?? "")}
        selected={selected}
        onOpen={(opts) => source?.onOpen(id, opts)}
      />
    </NodeViewWrapper>
  );
}

// ── 노드 ─────────────────────────────────────────────

/**
 * pageMention — 글 안의 한 덩어리(atom). 저장: `{ id, label }`. label은 넣을 때의 제목으로,
 * 대상이 지워졌을 때와 Markdown 내보내기에서 쓴다. HTML로는 `cetusnote://page/<id>` 링크다.
 */
export const PageMention = Node.create<{
  resolve?: (id: string) => MentionTarget | null;
  open?: (id: string) => void;
}>({
  name: "pageMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { resolve: undefined, open: undefined };
  },

  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute("data-page-mention") },
      label: { default: "", parseHTML: (el) => el.textContent?.trim() ?? "" },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-page-mention]" }, { tag: "span[data-page-mention]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-page-mention": node.attrs.id,
        href: `${PAGE_LINK_PREFIX}${node.attrs.id}`,
        class: "sn-mention",
      }),
      String(node.attrs.label || "제목 없음"),
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.label || "제목 없음"}`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionView, { as: "span" });
  },

  addKeyboardShortcuts() {
    return {
      // 칩을 골라(방향키로 칩에 오면 선택된다) Enter → 그 페이지로
      Enter: ({ editor }) => {
        const sel = editor.state.selection;
        if (!(sel instanceof NodeSelection) || sel.node.type.name !== this.name) return false;
        this.options.open?.(String(sel.node.attrs.id));
        return true;
      },
    };
  },

  // 페이지 링크(링크 복사로 얻은 주소)를 붙여 넣으면 멘션이 된다
  addPasteRules() {
    const resolve = this.options.resolve;
    if (!resolve) return [];
    return [
      nodePasteRule({
        find: PAGE_LINK,
        type: this.type,
        getAttributes: (match) => {
          const target = resolve(match[1]!);
          return target ? { id: target.id, label: target.title } : false;
        },
      }),
    ];
  },
});

// ── `@` 제안 ─────────────────────────────────────────

export type MentionState = {
  query: string;
  items: MentionTarget[];
  range: Range;
  clientRect: () => DOMRect | null;
};

export type MentionCallbacks = {
  onChange: (state: MentionState | null) => void;
  onKeyDown: (event: KeyboardEvent) => boolean;
};

export const mentionPluginKey = new PluginKey("pageMentionSuggest");

/** 멘션 넣기 — `@검색어`를 칩 + 공백으로 바꾼다 */
export function insertMention(editor: Editor, range: Range, target: MentionTarget) {
  editor
    .chain()
    .focus()
    .insertContentAt(range, [
      { type: "pageMention", attrs: { id: target.id, label: target.title } },
      { type: "text", text: " " },
    ])
    .run();
}

/** `@`를 입력하면 페이지 제안을 연다(@tiptap/suggestion). 그리는 일은 NoteEditor가 한다 */
export function mentionSuggestion(
  callbacks: MentionCallbacks,
  search: (query: string) => MentionTarget[],
) {
  return Extension.create({
    name: "pageMentionSuggest",
    // 목록·체크리스트의 Enter·Tab 단축키보다 먼저 키를 받아야 메뉴에서 고를 수 있다
    priority: 1000,
    addProseMirrorPlugins() {
      return [
        Suggestion<MentionTarget, MentionTarget>({
          editor: this.editor as Editor,
          pluginKey: mentionPluginKey,
          char: "@",
          // 한국어 제목은 띄어 쓴다 ("@주간 회의")
          allowSpaces: true,
          allowedPrefixes: [" ", "("],
          allow: ({ state, range }) => {
            const $from = state.doc.resolve(range.from);
            return !$from.parent.type.spec.code;
          },
          items: ({ query }) => search(query),
          command: () => {},
          render: () => {
            const push = (p: {
              query: string;
              items: MentionTarget[];
              range: Range;
              clientRect?: (() => DOMRect | null) | null;
            }) =>
              callbacks.onChange({
                query: p.query,
                items: p.items,
                range: p.range,
                clientRect: p.clientRect ?? (() => null),
              });
            return {
              onStart: push,
              onUpdate: push,
              onKeyDown: ({ event }) => callbacks.onKeyDown(event),
              onExit: () => callbacks.onChange(null),
            };
          },
        }),
      ];
    },
  });
}
