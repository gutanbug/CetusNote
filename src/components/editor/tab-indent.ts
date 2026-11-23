import { Extension, type Editor } from "@tiptap/core";
import { toast } from "@/components/ui/toast";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";

const TAB = "\t";

/** 처음 Tab으로 들여쓸 때 한 번 — Tab이 더는 포커스를 옮기지 않으니 나가는 방법을 알린다(WCAG 2.1.2) */
let hinted = false;
/** 스토리 전용: 안내를 다시 보이게 */
export function resetTabIndentHint() {
  hinted = false;
}
function hintOnce() {
  if (hinted) return;
  hinted = true;
  toast("Tab으로 들여썼어요", {
    id: "tab-indent-hint",
    description: "본문에서 나가려면 Esc를 누른 다음 Tab을 누르세요.",
    duration: 6000,
  });
}
const key = new PluginKey<{ escaped: boolean }>("tabIndent");

/** 선택이 걸친 글 블록들(코드 블록 제외)의 시작 위치 */
function textblockStarts(state: EditorState) {
  const { from, to } = state.selection;
  const starts: number[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      if (!node.type.spec.code) starts.push(pos + 1);
      return false;
    }
    return true;
  });
  return starts;
}

const LIST_ITEM_TYPES = new Set(["listItem", "taskItem"]);

/** 커서나 선택 끝이 목록 항목(listItem·taskItem) 안에 있는지 */
function inListItem(state: EditorState) {
  const { $from, $to } = state.selection;
  return [$from, $to].some(($pos) => {
    for (let d = $pos.depth; d > 0; d--)
      if (LIST_ITEM_TYPES.has($pos.node(d).type.name)) return true;
    return false;
  });
}

function indent(state: EditorState, dispatch?: (tr: Transaction) => void) {
  const { selection } = state;
  if (selection.$from.parent.type.spec.code) return false;
  // 목록 항목에서 하위로 들여쓸 수 없을 때(첫 항목 등) — 항목 글자에 탭을 넣지 않고 키만 삼킨다 (EDIT-22)
  if (inListItem(state)) return true;
  // 여러 줄이거나 전체 선택(⌘A — 양 끝이 문서 자체)이면 줄마다 들여쓴다
  const multi =
    !selection.empty &&
    (selection.$from.parent !== selection.$to.parent || !selection.$from.parent.inlineContent);
  if (!dispatch) return true;
  const tr = state.tr;
  if (multi) {
    // 여러 줄: 줄마다 앞에 탭 (뒤에서부터 넣어 위치가 밀리지 않게)
    // insertText는 선택을 접으므로 insert로 넣어 줄 선택을 그대로 둔다(다시 Tab·⇧Tab 할 수 있게)
    for (const at of textblockStarts(state).reverse()) tr.insert(at, state.schema.text(TAB));
    tr.setSelection(
      TextSelection.create(
        tr.doc,
        tr.mapping.map(selection.anchor, -1),
        tr.mapping.map(selection.head),
      ),
    );
  } else {
    tr.insertText(TAB, selection.from, selection.to);
  }
  dispatch(tr.scrollIntoView());
  hintOnce();
  return true;
}

function outdent(state: EditorState, dispatch?: (tr: Transaction) => void) {
  const { selection, doc } = state;
  if (selection.$from.parent.type.spec.code) return false;
  const tr = state.tr;
  const before = selection.empty ? doc.textBetween(selection.from - 1, selection.from) : "";
  if (selection.empty && before === TAB && selection.$from.parentOffset > 0) {
    tr.delete(selection.from - 1, selection.from);
  } else {
    // 줄 맨 앞의 탭 하나를 지운다 (여러 줄이면 줄마다)
    for (const at of textblockStarts(state).reverse()) {
      if (doc.textBetween(at, Math.min(at + 1, doc.content.size)) === TAB) tr.delete(at, at + 1);
    }
  }
  if (tr.docChanged) dispatch?.(tr.scrollIntoView());
  // 지울 탭이 없어도 키를 삼킨다 — Shift+Tab이 갑자기 에디터 밖으로 나가지 않게
  return true;
}

/**
 * 들여쓰기·내어쓰기 단축키(EDIT-22). 목록 항목에서 Tab은 하위 항목 만들기를 먼저 보고,
 * 그게 안 되면(첫 항목) 여기서 아무 일도 없이 키만 삼킨다.
 */
export function tabIndentShortcuts(editor: Editor) {
  return {
    Tab: () => indent(editor.state, (tr) => editor.view.dispatch(tr)),
    "Shift-Tab": () => outdent(editor.state, (tr) => editor.view.dispatch(tr)),
  };
}

/**
 * ED-TabIndent — 글을 쓰다 Tab을 누르면 다음 칸으로 포커스가 가지 않고 탭 문자로 들여쓴다.
 * Shift+Tab은 캐럿 앞(없으면 줄 맨 앞)의 탭을 지운다. 여러 줄을 고르면 줄마다.
 *
 * 우선순위가 낮아 목록(하위 항목으로), 표(다음 칸), 코드 블록(2칸), 슬래시·멘션 메뉴(고르기)가
 * 먼저 Tab을 받는다. 키보드로 에디터를 빠져나가려면 Esc 다음 Tab(코드 편집기들과 같은 약속).
 */
export const TabIndent = Extension.create({
  name: "tabIndent",
  priority: 10,
  addKeyboardShortcuts() {
    return tabIndentShortcuts(this.editor);
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: () => ({ escaped: false }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(key) as { escaped: boolean } | undefined;
            return meta ?? prev;
          },
        },
        props: {
          handleDOMEvents: {
            // 다른 처리보다 먼저 본다. Esc 바로 다음 Tab이면 아무도 받지 않게 해 브라우저가 포커스를 옮긴다
            keydown: (view, event) => {
              if (event.key === "Escape") return false;
              const escaped = key.getState(view.state)?.escaped;
              if (!escaped) return false;
              view.dispatch(view.state.tr.setMeta(key, { escaped: false }));
              return event.key === "Tab";
            },
          },
          // 메뉴·팝오버가 처리하지 않은 Esc만 여기까지 온다
          handleKeyDown: (view, event) => {
            if (event.key === "Escape")
              view.dispatch(view.state.tr.setMeta(key, { escaped: true }));
            return false;
          },
        },
      }),
    ];
  },
});
