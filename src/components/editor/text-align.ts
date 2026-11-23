import type { Editor } from "@tiptap/core";
import TextAlign from "@tiptap/extension-text-align";

/** 최상위 문단·제목에 정렬이 있으면 줄을 나누고 새 블록의 정렬을 지운다. 해당 없으면 false(기본 Enter) */
export function splitAlignedBlock(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  if ($from.depth !== 1 || !$from.parent.attrs.textAlign) return false;
  return editor.chain().splitBlock().unsetTextAlign().run();
}

/**
 * 정렬 단축키(EDIT-20). ⌘⇧L은 정렬을 지운다(왼쪽은 기본값이라 속성을 저장하지 않는다).
 * Enter는 최상위 블록에서만 정렬을 잇지 않는다. 목록·인용 안은 기본 Enter 그대로 둔다.
 */
export function alignmentShortcuts(editor: Editor) {
  return {
    "Mod-Shift-l": () => editor.commands.unsetTextAlign(),
    "Mod-Shift-e": () => editor.commands.setTextAlign("center"),
    "Mod-Shift-r": () => editor.commands.setTextAlign("right"),
    "Mod-Shift-j": () => editor.commands.setTextAlign("justify"),
    Enter: () => splitAlignedBlock(editor),
  };
}

/** 문단·제목 정렬(TextAlign)의 단축키를 위 규칙으로 바꾼 확장. 기본 Enter보다 먼저 본다 */
export const TextAlignment = TextAlign.extend({
  priority: 1000,
  addKeyboardShortcuts() {
    return alignmentShortcuts(this.editor);
  },
});
