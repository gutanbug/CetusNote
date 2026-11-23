import { Extension, type CommandProps } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

/**
 * 캐럿이 있는 최상위 블록을 위(-1)나 아래(1)로 한 칸 옮긴다.
 * ED-BlockHandle의 ⋮⋮ 끌기를 키보드로 하는 방법이다(⌘⇧↑ / ⌘⇧↓).
 */
export function moveBlock(dir: -1 | 1) {
  return ({ state, dispatch }: Pick<CommandProps, "state" | "dispatch">) => {
    const { selection, doc } = state;
    const index = selection.$from.index(0);
    // 여러 블록에 걸친 선택은 옮기지 않는다
    if (selection.$to.index(0) !== index && !(selection instanceof NodeSelection)) return false;
    const target = index + dir;
    if (target < 0 || target >= doc.childCount) return false;

    const node = doc.child(index);
    const other = doc.child(target);
    let from = 0;
    for (let i = 0; i < Math.min(index, target); i++) from += doc.child(i).nodeSize;
    const to = from + node.nodeSize + other.nodeSize;
    const delta = dir * other.nodeSize;
    if (!dispatch) return true;

    const tr = state.tr.replaceWith(from, to, dir === 1 ? [other, node] : [node, other]);
    const sel =
      selection instanceof NodeSelection
        ? NodeSelection.create(tr.doc, selection.from + delta)
        : selection instanceof TextSelection
          ? TextSelection.create(tr.doc, selection.anchor + delta, selection.head + delta)
          : TextSelection.near(tr.doc.resolve(selection.from + delta));
    dispatch(tr.setSelection(sel).scrollIntoView());
    return true;
  };
}

/** ⌘/ 를 누르면 editor.view.dom에서 이 이벤트가 올라간다(bubbles). ED-BlockHandle이 자기 에디터 것만 받아 연다 */
export const BLOCK_MENU_EVENT = "cetusnote:block-menu";

export const BlockKeys = Extension.create({
  name: "blockKeys",
  addKeyboardShortcuts() {
    const run = (dir: -1 | 1) => () => {
      const { view } = this.editor;
      return moveBlock(dir)({ state: view.state, dispatch: (tr) => view.dispatch(tr) });
    };
    return {
      "Mod-Shift-ArrowUp": run(-1),
      "Mod-Shift-ArrowDown": run(1),
      "Mod-/": () => {
        this.editor.view.dom.dispatchEvent(new CustomEvent(BLOCK_MENU_EVENT, { bubbles: true }));
        return true;
      },
    };
  },
});
