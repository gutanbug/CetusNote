import { Extension, InputRule } from "@tiptap/core";
import { setBlockType, wrapIn } from "@tiptap/pm/commands";
import type { EditorState } from "@tiptap/pm/state";
import { wrapInList } from "@tiptap/pm/schema-list";

/** 커서가 체크리스트 항목(taskItem)의 첫 문단 안에 있는지 */
function atTaskItemHead(state: EditorState, pos: number): boolean {
  const $pos = state.doc.resolve(pos);
  const depth = $pos.depth;
  return (
    depth >= 2 &&
    $pos.parent.type.name === "paragraph" &&
    $pos.node(depth - 1).type.name === "taskItem" &&
    $pos.index(depth - 1) === 0
  );
}

/**
 * EDIT-02 — 체크리스트 항목 안에서 `- ` `1. ` `> ` `# ` 을 치면 그 항목을 목록 밖으로 빼고
 * 그 블록으로 바꾼다(일반 문단과 같은 결과).
 *
 * 중첩으로 감싸지 않는 이유: taskItem의 내용은 "문단 + 블록*"이라 첫 문단 앞에 목록·인용·제목을
 * 넣을 자리가 없다(Tiptap 기본 입력 규칙이 아무 일도 하지 않는 원인). 그래서 항목을 빼낸다.
 * `[] ` 은 이미 체크리스트라 그대로 둔다. 항목 밖의 문단에서는 null을 돌려 기본 규칙에 넘긴다.
 */
export const TaskItemShortcuts = Extension.create({
  name: "taskItemShortcuts",
  // StarterKit·TaskList의 기본 규칙보다 먼저 본다 (그쪽은 항목 안에서 아무 일도 하지 않는다)
  priority: 1000,
  addInputRules() {
    const noop = () => {};
    /** 항목을 뺀 뒤 그 문단을 바꾼다. 입력 규칙 안에서는 tr을 직접 다룬다(체인 상태는 중간 위치를 놓친다) */
    const wrap = (find: RegExp, make: (m: RegExpMatchArray, s: EditorState) => boolean) =>
      new InputRule({
        find,
        handler: ({ state, range, match, commands, can }) => {
          if (!atTaskItemHead(state, range.from) || !can().liftListItem("taskItem")) return null;
          commands.deleteRange(range);
          commands.liftListItem("taskItem");
          // 체인 상태의 selection·doc은 state.tr을 읽을 때 새로 맞춰진다
          void state.tr;
          make(match, state as unknown as EditorState);
        },
      });

    return [
      wrap(/^\s*([-+*])\s$/, (_m, s) => wrapInList(s.schema.nodes.bulletList)(s, noop)),
      wrap(/^(\d+)\.\s$/, (m, s) =>
        wrapInList(s.schema.nodes.orderedList, { start: Number(m[1]) })(s, noop),
      ),
      wrap(/^>\s$/, (_m, s) => wrapIn(s.schema.nodes.blockquote)(s, noop)),
      wrap(/^(#{1,3})\s$/, (m, s) =>
        setBlockType(s.schema.nodes.heading, { level: m[1].length })(s, noop),
      ),
    ];
  },
});
