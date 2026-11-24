import { Extension, type Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";

const CELL_TYPES = new Set(["tableCell", "tableHeader"]);

/**
 * 빈 셀에서 처음 ⌘A를 누른 자리. 같은 셀·같은 문서(글 변경 없음)에서 한 번 더 누르면 문서 전체를 고른다.
 * 에디터마다 따로 기억한다(기록 상세 등 여러 에디터가 같은 확장을 쓸 수 있다).
 */
const armedEmptyCell = new WeakMap<Editor, { cellPos: number; doc: PMNode }>();

type CellRange = {
  /** 셀 노드의 시작 위치 */
  pos: number;
  /** 셀 본문 첫 글자 위치 (첫 문단 안쪽) */
  from: number;
  /** 셀 본문 끝 위치 (마지막 문단 안쪽) */
  to: number;
  /** 셀 글자가 없음 (빈 문단만 있어도 true) */
  empty: boolean;
};

/** 캐럿(선택 시작)이 든 표 셀의 본문 범위. 셀 밖이면 null */
function cellRangeAt(doc: PMNode, anchor: number): CellRange | null {
  const $pos = doc.resolve(anchor);
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (!CELL_TYPES.has(node.type.name)) continue;
    const pos = $pos.before(d);
    const start = pos + 1;
    let from = -1;
    let to = -1;
    // 셀 안의 모든 문단(목록·인용 등 블록 포함)의 첫 글자 ~ 마지막 글자
    node.descendants((child, childPos) => {
      if (!child.isTextblock) return true;
      const inner = start + childPos + 1;
      if (from < 0) from = inner;
      to = inner + child.content.size;
      return false;
    });
    if (from < 0) return null;
    return { pos, from, to, empty: node.textContent === "" };
  }
  return null;
}

/** 문서 전체 선택 — 기본 ⌘A와 같다(표 밖, 여러 셀 선택, 셀 두 번째 누름) */
function selectDocument(editor: Editor) {
  editor.commands.selectAll();
  return true;
}

/**
 * ⌘A(macOS) / Ctrl+A(Windows·Linux) 단계 선택.
 *  1. 표 셀 안에서 셀 본문 전체를 고른다(여러 문단이면 첫 글자~마지막 글자).
 *  2. 셀 본문이 이미 다 골라져 있으면 문서 전체를 고른다.
 *  3. 빈 셀은 첫 번째 누름을 아무 일 없이 삼키고, 같은 셀에서 한 번 더 누르면 문서 전체를 고른다.
 *  - 표 밖·여러 셀 선택(CellSelection)은 문서 전체(기본 동작과 같음).
 *  - IME 조합 중에는 키를 건드리지 않는다.
 */
export function tableSelectAllShortcuts(editor: Editor) {
  return {
    "Mod-a": () => {
      if (editor.view.composing) return false;
      const { state } = editor;
      const { selection } = state;
      if (selection instanceof CellSelection) {
        armedEmptyCell.delete(editor);
        return selectDocument(editor);
      }
      const cell = cellRangeAt(state.doc, selection.$from.pos);
      if (!cell) {
        armedEmptyCell.delete(editor);
        return selectDocument(editor);
      }
      if (cell.empty) {
        const armed = armedEmptyCell.get(editor);
        if (armed && armed.cellPos === cell.pos && armed.doc === state.doc) {
          armedEmptyCell.delete(editor);
          return selectDocument(editor);
        }
        armedEmptyCell.set(editor, { cellPos: cell.pos, doc: state.doc });
        return true;
      }
      armedEmptyCell.delete(editor);
      if (selection.from <= cell.from && selection.to >= cell.to) return selectDocument(editor);
      editor.view.dispatch(
        state.tr.setSelection(TextSelection.create(state.doc, cell.from, cell.to)).scrollIntoView(),
      );
      return true;
    },
  };
}

/**
 * ED-Table 보조 — 표 셀 안의 ⌘A는 셀 내용부터 고른다(EDIT-15).
 * 기본 우선순위(100)보다 먼저 받아야 하므로 1000을 준다.
 */
export const TableSelectAll = Extension.create({
  name: "tableSelectAll",
  priority: 1000,
  addKeyboardShortcuts() {
    return tableSelectAllShortcuts(this.editor);
  },
});
