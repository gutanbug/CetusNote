import { mergeAttributes, Node } from "@tiptap/core";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { ChevronRight } from "lucide-react";
import { focusRing } from "@/components/ui/styles";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useMessages } from "@/lib/i18n";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    toggleHeading: {
      /** 문단을 접을 수 있는 제목(H1–H3)으로 감싼다. 이미 토글 제목 안이면 수준만 바꾼다 */
      setToggleHeading: (attrs: { level: 1 | 2 | 3; open?: boolean }) => ReturnType;
      /** 캐럿이 있는 토글 제목을 접거나 펼친다 (⌘⇧↵) */
      toggleToggleHeading: () => ReturnType;
    };
  }
}

type Found = { pos: number; node: PMNode };

/** 캐럿이 든 가장 안쪽 토글 제목 */
function findToggleHeading(state: EditorState): Found | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "toggleHeading") return { pos: $from.before(d), node };
  }
  return null;
}

/**
 * 토글 제목(문서 위치 pos)을 접거나 펼친다. 접을 때 캐럿이 아래 내용에 있으면 제목 끝으로 옮긴다
 * (숨겨진 내용에 캐럿이 남지 않게).
 */
export function applyToggleOpen(tr: Transaction, state: EditorState, pos: number, open: boolean) {
  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== "toggleHeading") return tr;
  tr.setNodeMarkup(pos, undefined, { ...node.attrs, open });
  const bodyStart = pos + 1 + node.firstChild!.nodeSize;
  const end = pos + node.nodeSize - 1;
  const { from, to } = state.selection;
  if (!open && from >= bodyStart && to <= end) {
    // 제목 글의 끝 (heading 노드 안쪽, 닫는 토큰 바로 앞)
    tr.setSelection(TextSelection.near(tr.doc.resolve(bodyStart - 1), -1));
  }
  return tr.scrollIntoView();
}

/** 접기·펼치기 트랜잭션을 새로 만든다 (노드 뷰 클릭처럼 명령 밖에서 쓸 때) */
export function toggleOpenTransaction(state: EditorState, pos: number, open: boolean) {
  return applyToggleOpen(state.tr, state, pos, open);
}

const collapsedKey = new PluginKey("toggleHeadingCollapsed");

/** 접힌 토글의 제목 뒤 내용은 `hidden`으로 감춘다 (노드 장식 — 문서 JSON에는 아무것도 더하지 않는다) */
function collapsedDecorations(state: EditorState) {
  const decos: Decoration[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name !== "toggleHeading") return true;
    if (node.attrs.open === false) {
      let offset = pos + 1 + node.firstChild!.nodeSize;
      for (let i = 1; i < node.childCount; i++) {
        const child = node.child(i);
        decos.push(
          Decoration.node(offset, offset + child.nodeSize, {
            hidden: "",
            "data-collapsed": "",
          }),
        );
        offset += child.nodeSize;
      }
    }
    return true;
  });
  return DecorationSet.create(state.doc, decos);
}

/**
 * 제목 수준별 행 맞춤. 제목의 위 여백(editor.css `.sn-prose h1·h2·h3`의 mt)은 행(wrapper)의 위 여백으로 옮기고,
 * 제목 글자 크기·줄 높이(text-h*)는 펼침 단추 칸에도 준다. 칸 높이를 `1lh`(= 제목 한 줄)로 두면 단추가
 * 제목 첫 줄 가운데에 놓이고, 제목이 여러 줄로 줄어도 첫 줄 기준이 유지된다.
 */
const HEADING_ROW: Record<number, { pad: string; text: string }> = {
  1: { pad: "pt-6", text: "text-h1" },
  2: { pad: "pt-4", text: "text-h2" },
  3: { pad: "pt-3", text: "text-h3" },
};

function ToggleHeadingView({ node, editor, getPos }: ReactNodeViewProps) {
  const m = useMessages();
  const open = node.attrs.open !== false;
  // 이름은 고정(「토글」), 상태는 aria-expanded가 전한다. 툴팁 문구만 동작을 말한다
  const row = HEADING_ROW[Number(node.firstChild?.attrs.level)] ?? HEADING_ROW[1];
  const onToggle = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.view.dispatch(toggleOpenTransaction(editor.state, pos, !open));
  };
  return (
    <NodeViewWrapper
      data-type="toggleHeading"
      data-open={String(open)}
      className={cn("flex items-start", row.pad)}
    >
      <div
        contentEditable={false}
        // 높이 1lh = 제목 한 줄. 제목 줄의 위 패딩(py-0.75)만큼 내린다
        className={cn("mt-0.75 flex h-[1lh] shrink-0 items-center", row.text)}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={!editor.isEditable}
              aria-expanded={open}
              aria-label={m.editor.toggle.toggleAria}
              onClick={onToggle}
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-md text-secondary transition-colors hover:bg-hover force-hover:bg-hover",
                focusRing,
              )}
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform duration-(--dur-fast) ease-(--ease) motion-reduce:transition-none",
                  open && "rotate-90",
                )}
                strokeWidth={1.5}
                aria-hidden
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {open ? m.editor.toggle.collapse : m.editor.toggle.expand}
          </TooltipContent>
        </Tooltip>
      </div>
      {/* 제목의 위 여백은 행(wrapper)이 가져가므로 제목 자신의 mt는 지운다 */}
      <NodeViewContent className="min-w-0 flex-1 [&>*>:first-child]:!mt-0" />
    </NodeViewWrapper>
  );
}

/**
 * ED-ToggleHeading — 접히는 제목(H1–H3). 노드 구조는 `toggleHeading > heading + 블록*`이다.
 * 제목은 진짜 `heading` 노드라서 목차(getHeadings)·검색·제목 스타일을 그대로 쓴다.
 * 열림 상태는 `open` 속성(data-open)으로 문서에 저장한다. 접힌 동안 아래 내용은 `hidden` 장식으로 숨긴다.
 *
 * 키보드: ⌘⇧↵ 또는 펼침 단추(Enter·Space)로 접고 펼친다. 접힌 제목 끝에서 Enter를 치면 아래 문단이 생기고
 * 토글이 펼쳐진다(선택이 숨은 내용 안으로 들어가는 것을 appendTransaction이 막는다).
 * 슬래시 「토글 제목 1·2·3」 연결은 phase 2 (`setToggleHeading`).
 */
export const ToggleHeading = Node.create({
  name: "toggleHeading",
  group: "block",
  content: "heading block*",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (el) => el.getAttribute("data-open") !== "false",
        renderHTML: (a) => ({ "data-open": String(a.open !== false) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggleHeading"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "toggleHeading" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleHeadingView);
  },

  addCommands() {
    return {
      setToggleHeading:
        (attrs) =>
        ({ state, chain }) => {
          const { $from } = state.selection;
          const level = attrs.level;
          // 이미 토글 제목의 제목 줄이면 수준만 바꾼다
          const inside =
            $from.parent.type.name === "heading" &&
            $from.depth > 1 &&
            $from.node($from.depth - 1).type.name === "toggleHeading";
          if (inside) return chain().setNode("heading", { level }).run();
          return chain()
            .setNode("heading", { level })
            .wrapIn(this.name, { open: attrs.open ?? true })
            .run();
        },
      toggleToggleHeading:
        () =>
        ({ state, tr }) => {
          const found = findToggleHeading(state);
          if (!found) return false;
          applyToggleOpen(tr, state, found.pos, found.node.attrs.open === false);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-Enter": () => this.editor.commands.toggleToggleHeading(),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: collapsedKey,
        props: {
          decorations: (state) => collapsedDecorations(state),
        },
        // 접힌 토글 안에 캐럿이 들어오면(Enter로 새 문단이 생긴 경우) 토글을 펼친다
        appendTransaction(trs, _old, state) {
          if (!trs.some((t) => t.docChanged)) return null;
          const found = findToggleHeading(state);
          if (!found || found.node.attrs.open !== false) return null;
          const bodyStart = found.pos + 1 + found.node.firstChild!.nodeSize;
          if (state.selection.from < bodyStart) return null;
          return applyToggleOpen(state.tr, state, found.pos, true);
        },
      }),
    ];
  },
});
