import { Extension, type Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type FindMatch = { from: number; to: number };
export type FindState = {
  query: string;
  matches: FindMatch[];
  /** 지금 고른 결과 (없으면 -1) */
  index: number;
};

/** 한 번에 표시하는 결과 수 — 넘으면 앞에서부터 이만큼만 */
export const MAX_MATCHES = 1000;
/** 글이 아닌 인라인 노드(멘션·수식·줄바꿈) 자리 — 검색어가 그 너머로 이어 맞지 않게 */
const OBJECT = "￼";

const key = new PluginKey<FindState>("findReplace");
const EMPTY: FindState = { query: "", matches: [], index: -1 };

type Meta = { query?: string; index?: number; after?: number };

/** 글 블록마다 대소문자 구분 없이 찾는다. 서식(굵게 등)이 바뀌는 곳을 넘어서도 맞는다 */
export function findMatches(doc: PMNode, query: string): FindMatch[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const out: FindMatch[] = [];
  doc.descendants((node, pos) => {
    if (out.length >= MAX_MATCHES) return false;
    if (!node.isTextblock) return true;
    let text = "";
    const at: number[] = []; // 글자 → 문서 위치
    node.forEach((child, offset) => {
      const p = pos + 1 + offset;
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) at.push(p + i);
        text += child.text;
      } else {
        at.push(p);
        text += OBJECT;
      }
    });
    // 소문자로 길이가 바뀌는 드문 글자가 있으면 그대로 비교한다(위치가 어긋나지 않게)
    const lower = text.toLowerCase();
    const hay = lower.length === text.length ? lower : text;
    const needle = lower.length === text.length ? q : query;
    for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) {
      out.push({ from: at[i]!, to: at[i + needle.length - 1]! + 1 });
      if (out.length >= MAX_MATCHES) break;
    }
    return false;
  });
  return out;
}

/** pos 이후(포함) 첫 결과. 없으면 처음으로 돈다 */
function indexFrom(matches: FindMatch[], pos: number) {
  if (!matches.length) return -1;
  const i = matches.findIndex((m) => m.from >= pos);
  return i === -1 ? 0 : i;
}

export function getFind(state: EditorState): FindState {
  return key.getState(state) ?? EMPTY;
}

function dispatch(editor: Editor, meta: Meta, tr = editor.state.tr) {
  editor.view.dispatch(tr.setMeta(key, meta));
}

/** 검색어를 바꾼다. 결과는 지금 캐럿 자리부터 고른다 */
export function setFindQuery(editor: Editor, query: string) {
  dispatch(editor, { query, after: editor.state.selection.from });
}

/** 다음(1) · 이전(-1) 결과. 끝에서 처음으로 돈다 */
export function moveFind(editor: Editor, dir: 1 | -1) {
  const { matches, index } = getFind(editor.state);
  if (!matches.length) return;
  dispatch(editor, { index: (index + dir + matches.length) % matches.length });
}

/** 지금 결과를 바꾸고 다음 결과로 */
export function replaceCurrent(editor: Editor, text: string) {
  const { matches, index } = getFind(editor.state);
  const m = matches[index];
  if (!m || !editor.isEditable) return;
  const tr = editor.state.tr.insertText(text, m.from, m.to);
  dispatch(editor, { after: m.from + text.length }, tr);
}

/** 모두 바꾼다(한 번의 실행 취소로 되돌린다). 바꾼 개수 */
export function replaceAll(editor: Editor, text: string): number {
  const { matches } = getFind(editor.state);
  if (!matches.length || !editor.isEditable) return 0;
  const tr = editor.state.tr;
  for (const m of [...matches].reverse()) tr.insertText(text, m.from, m.to);
  dispatch(editor, { after: 0 }, tr);
  return matches.length;
}

/** 찾기를 끝낸다. select면 지금 결과를 본문에서 골라 둔다 */
export function closeFind(editor: Editor, { select = false } = {}) {
  const { matches, index } = getFind(editor.state);
  const m = matches[index];
  const tr = editor.state.tr;
  if (select && m) tr.setSelection(TextSelection.create(tr.doc, m.from, m.to));
  dispatch(editor, { query: "" }, tr);
}

/**
 * ED-FindBar의 상태 (EDIT-25) — 검색어 · 결과 위치 · 지금 결과. 결과는 장식(decoration)으로 칠한다.
 * 문서가 바뀌면 다시 찾고, 지금 결과는 가까운 자리를 이어 받는다.
 */
export const FindReplace = Extension.create({
  name: "findReplace",
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key,
        state: {
          init: () => EMPTY,
          apply(tr, prev) {
            const meta = tr.getMeta(key) as Meta | undefined;
            const query = meta?.query ?? prev.query;
            if (!query) return EMPTY;
            if (!meta && !tr.docChanged) return prev;
            const matches =
              tr.docChanged || query !== prev.query ? findMatches(tr.doc, query) : prev.matches;
            let index: number;
            if (meta?.index !== undefined) index = meta.index;
            else if (meta?.after !== undefined) index = indexFrom(matches, meta.after);
            else {
              // 문서만 바뀜: 지금 결과 자리를 옮겨 그 근처를 이어 고른다
              const cur = prev.matches[prev.index];
              index = indexFrom(matches, cur ? tr.mapping.map(cur.from) : 0);
            }
            return { query, matches, index: Math.min(index, matches.length - 1) };
          },
        },
        props: {
          decorations(state) {
            const { matches, index } = getFind(state);
            if (!matches.length) return null;
            return DecorationSet.create(
              state.doc,
              matches.map((m, i) =>
                Decoration.inline(m.from, m.to, {
                  class: i === index ? "sn-find-match sn-find-current" : "sn-find-match",
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});
