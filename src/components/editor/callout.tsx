import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { focusRing } from "@/components/ui/styles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COLOR_NAMES } from "@/components/ui/color-popover";
import { SOFT_COLORS, softColor, type SoftColor } from "@/components/ui/tag-chip";
import { cn } from "@/lib/utils";

/** 콜아웃에 바로 고를 수 있는 이모지. 전체 이모지 선택은 OV-EmojiPicker가 생기면 붙인다. */
const CALLOUT_EMOJIS = ["💡", "📌", "✅", "⚠️", "❗", "ℹ️", "🔥", "📝", "💬", "🎯", "🚧", "⭐"];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** 선택한 블록을 콜아웃으로 감싼다 */
      setCallout: (attrs?: { emoji?: string; color?: SoftColor }) => ReturnType;
      toggleCallout: (attrs?: { emoji?: string; color?: SoftColor }) => ReturnType;
    };
  }
}

function CalloutView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const color = (node.attrs.color ?? "blue") as SoftColor;
  const emoji = node.attrs.emoji as string;
  return (
    <NodeViewWrapper
      data-type="callout"
      data-color={color}
      className={cn("sn-callout", softColor({ color }))}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            contentEditable={false}
            disabled={!editor.isEditable}
            aria-label="콜아웃 아이콘과 색 바꾸기"
            className={cn("sn-callout-emoji", focusRing)}
          >
            {emoji}
          </button>
        </PopoverTrigger>
        <PopoverContent aria-label="콜아웃 꾸미기" className="grid w-auto min-w-0 gap-2 p-2">
          <div role="group" aria-label="아이콘" className="grid grid-cols-6 gap-1">
            {CALLOUT_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={e === emoji}
                aria-label={`아이콘 ${e}`}
                onClick={() => updateAttributes({ emoji: e })}
                className={cn(
                  "grid size-8 place-items-center rounded-pill text-body hover:bg-hover aria-pressed:bg-active force-hover:bg-hover",
                  focusRing,
                )}
              >
                {e}
              </button>
            ))}
          </div>
          <div role="group" aria-label="배경색" className="grid grid-cols-9 gap-1">
            {SOFT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={c === color}
                aria-label={`배경색 ${COLOR_NAMES[c]}`}
                title={COLOR_NAMES[c]}
                onClick={() => updateAttributes({ color: c })}
                className={cn(
                  "size-6 rounded-pill border border-line aria-pressed:ring-2 aria-pressed:ring-accent",
                  softColor({ color: c }),
                  focusRing,
                )}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <NodeViewContent className="sn-callout-body" />
    </NodeViewWrapper>
  );
}

/** ED-Callout — 이모지 + 소프트 컬러 배경. `:::` + 스페이스로 만든다. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: "💡",
        parseHTML: (el) => el.getAttribute("data-emoji") ?? "💡",
        renderHTML: (a) => ({ "data-emoji": a.emoji }),
      },
      color: {
        default: "blue",
        parseHTML: (el) => el.getAttribute("data-color") ?? "blue",
        renderHTML: (a) => ({ "data-color": a.color }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout" }), 0];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
      toggleCallout:
        (attrs) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attrs),
    };
  },

  addInputRules() {
    return [wrappingInputRule({ find: /^:::\s$/, type: this.type })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});
