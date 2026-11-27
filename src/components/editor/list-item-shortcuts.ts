import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { liftListItem } from "@tiptap/pm/schema-list";

/**
 * 블록을 여는 입력 — 공백을 치는 순간 입력 규칙이 이것을 블록으로 바꾼다.
 * 체크리스트 칸 `[] ` `[x] `는 제외한다(항목 안에서는 그대로 둔다).
 */
const BLOCK_START = /^(?:#{1,3}|[-+*]|\d+\.|>>?|:::|`{3}[\w+#.-]*|\$\$\$|\[[ xX]?\])$/;
const CHECKBOX = /^\[[ xX]?\]$/;
const HORIZONTAL_RULE = /^(?:---|—-)$/;
const ITEM_NAMES = new Set(["listItem", "taskItem"]);

/**
 * EDIT-02·EDIT-10 — 목록 항목(`listItem`·`taskItem`)의 첫 문단 맨 앞에서 블록 문법
 * (`# ` `- ` `1. ` `> ` `>> ` `::: ` ``` ` `--- ` `$$$ `)을 치면, 그 항목을 목록 밖으로 빼고
 * 입력을 일반 문단에서 다시 처리한다. 그래야 결과가 일반 문단에서 치는 것과 같다.
 *
 * 항목 안에서 바로 바꾸지 않는 이유: 항목의 첫 자식은 문단이라 제목·코드 블록 등으로 바꿀 수 없어
 * Tiptap 입력 규칙이 아무 일도 하지 않는다(`canReplaceWith` 실패). 항목 안에서 `>>`·`:::`·수식은
 * 빈 문단과 블록을 나란히 만들어 구조가 깨졌다.
 *
 * 입력 규칙보다 먼저 보도록 handleTextInput을 쓴다. 블록 문법이 아니면 false를 돌려 기본 동작을 따른다.
 */
export const ListItemShortcuts = Extension.create({
  name: "listItemShortcuts",
  // StarterKit·TaskList·Toggle 등의 입력 규칙보다 먼저 본다
  priority: 1000,
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("listItemShortcuts"),
        props: {
          handleTextInput(view, from, to, text) {
            if (from !== to) return false;
            const { state } = view;
            const $from = state.doc.resolve(from);
            const depth = $from.depth;
            if (depth < 2 || $from.parent.type.name !== "paragraph") return false;
            if ($from.index(depth - 1) !== 0) return false;
            const item = $from.node(depth - 1);
            if (!ITEM_NAMES.has(item.type.name)) return false;
            const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
            // 구분선은 공백 없이 세 번째 `-`에서 바뀐다(`--`는 Typography가 `—`로 바꿔 둔다)
            const rule =
              HORIZONTAL_RULE.test(before + text) ||
              (text === " " && /^(?:_{3}|\*{3})$/.test(before));
            const opens = rule || (text === " " && BLOCK_START.test(before));
            if (!opens) return false;
            if (item.type.name === "taskItem" && CHECKBOX.test(before)) return false;

            let tr: typeof state.tr | null = null;
            if (!liftListItem(item.type)(state, (t) => (tr = t))) return false;
            view.dispatch(tr!);

            // 목록 밖의 문단에서 같은 입력을 다시 처리한다 (입력 규칙이 공백을 받는다)
            const at = view.state.selection.from;
            const handled = view.someProp("handleTextInput", (f) =>
              f(view, at, at, text, () => view.state.tr.insertText(text, at, at)),
            );
            if (!handled) view.dispatch(view.state.tr.insertText(text, at, at));
            return true;
          },
        },
      }),
    ];
  },
});
