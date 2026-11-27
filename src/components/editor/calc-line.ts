import { Extension, type Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { evaluateLines } from "@/lib/calc";

/** 결과가 붙는 블록 하나 — `end`는 블록 내용 끝 위치(캐럿이 여기 있으면 Tab으로 넣는다) */
export type CalcEntry = { end: number; text: string };
type CalcState = {
  entries: CalcEntry[];
  active: number | null;
  deco: DecorationSet;
  /** 문서에 `=`가 든 블록이 있는가 — 없으면 바뀐 곳만 본다 */
  anyEq: boolean;
};

export const calcLineKey = new PluginKey<CalcState>("calcLine");

/** 블록 글 — 블록 노드는 바뀌지 않으면 같은 객체라 다시 읽지 않는다 */
const textCache = new WeakMap<PMNode, string>();
function blockText(node: PMNode): string {
  let text = textCache.get(node);
  if (text === undefined) {
    text = node.textBetween(0, node.content.size, " ", (leaf) => {
      // 날짜 칩은 날짜로 읽는다 (`[12월 25일]까지 =`)
      if (leaf.type.name === "dateChip") return String(leaf.attrs.date ?? "");
      return leaf.type.name === "hardBreak" ? " " : "";
    });
    textCache.set(node, text);
  }
  return text;
}

/** 이번 변경으로 바뀐 블록에 `=`가 생겼는가 (지우기만으로는 생기지 않는다) */
function touchedEq(tr: Transaction): boolean {
  let found = false;
  tr.mapping.maps.forEach((map, i) => {
    if (found) return;
    const rest = tr.mapping.slice(i + 1);
    map.forEach((_a, _b, from, to) => {
      if (found) return;
      const start = rest.map(from, -1);
      const end = Math.min(rest.map(to, 1), tr.doc.content.size);
      tr.doc.nodesBetween(start, end, (node) => {
        if (found || node.type.spec.code) return false;
        if (!node.isTextblock) return true;
        if (blockText(node).includes("=")) found = true;
        return false;
      });
    });
  });
  return found;
}

/** 문서의 글 블록을 위에서 아래로 계산한다. 코드 블록은 줄로 보지 않는다 */
function computeEntries(doc: PMNode, now: Date): { entries: CalcEntry[]; anyEq: boolean } {
  const blocks: { pos: number; node: PMNode }[] = [];
  let any = false;
  doc.descendants((node, pos) => {
    if (node.type.spec.code) return false;
    if (!node.isTextblock) return true;
    blocks.push({ pos, node });
    if (!any && blockText(node).includes("=")) any = true;
    return false;
  });
  // 결과는 `=`가 있는 줄에만 생긴다 — 없으면 계산하지 않는다(긴 문서의 입력 지연)
  if (!any) return { entries: [], anyEq: false };
  const results = evaluateLines(
    blocks.map((b) => blockText(b.node)),
    now,
  );
  const entries: CalcEntry[] = [];
  results.forEach((r, i) => {
    if (!r) return;
    const b = blocks[i]!;
    entries.push({ end: b.pos + 1 + b.node.content.size, text: r.text });
  });
  return { entries, anyEq: true };
}

/** 캐럿이 결과 줄 끝에 있으면 그 위치 */
function activeOf(state: EditorState, entries: CalcEntry[]): number | null {
  const sel = state.selection;
  if (!sel.empty) return null;
  return entries.some((e) => e.end === sel.head) ? sel.head : null;
}

function resultElement(text: string, active: boolean): HTMLElement {
  const el = document.createElement("span");
  el.className = "sn-calc-result";
  el.contentEditable = "false";
  el.dataset.active = active ? "true" : "false";
  // 화면 읽기 프로그램에는 「계산 결과」라고 알린다(저장되지 않는 미리보기)
  const label = document.createElement("span");
  label.className = "sr-only";
  label.textContent = "계산 결과 ";
  el.append(label, text);
  if (active) {
    // UI-Kbd와 같은 모양의 안내. 읽기는 「Tab으로 넣기」로
    const kbd = document.createElement("kbd");
    kbd.className = "sn-calc-kbd";
    kbd.setAttribute("aria-hidden", "true");
    kbd.textContent = "Tab";
    const hint = document.createElement("span");
    hint.className = "sr-only";
    hint.textContent = ", Tab으로 넣기";
    el.append(kbd, hint);
  }
  return el;
}

function buildDeco(doc: PMNode, entries: CalcEntry[], active: number | null): DecorationSet {
  if (!entries.length) return DecorationSet.empty;
  return DecorationSet.create(
    doc,
    entries.map((e) => {
      const on = e.end === active;
      return Decoration.widget(e.end, () => resultElement(e.text, on), {
        side: 1,
        ignoreSelection: true,
        key: `calc:${on ? 1 : 0}:${e.text}`,
      });
    }),
  );
}

function build(state: EditorState): CalcState {
  const { entries, anyEq } = computeEntries(state.doc, new Date());
  const active = activeOf(state, entries);
  return { entries, active, anyEq, deco: buildDeco(state.doc, entries, active) };
}

/** 설정(SET-04 「계산 줄」)에서 끄면 에디터 DOM에 data-calc="false" — 결과를 숨기고 Tab도 넘긴다 */
function enabled(editor: Editor): boolean {
  return editor.view.dom.getAttribute("data-calc") !== "false";
}

/** 캐럿이 결과 줄 끝에 있으면 결과를 본문에 넣는다 */
export function acceptCalcResult(editor: Editor): boolean {
  if (!enabled(editor)) return false;
  const st = calcLineKey.getState(editor.state);
  const sel = editor.state.selection;
  const entry = sel.empty ? st?.entries.find((e) => e.end === sel.head) : undefined;
  if (!entry) return false;
  const before = sel.$head.parent.textBetween(0, sel.$head.parentOffset);
  return editor.commands.insertContent(`${before.endsWith(" ") ? "" : " "}${entry.text}`);
}

/**
 * ED-CalcLine — 살아 있는 계산 줄 (EDIT-38).
 * 줄이 `=`로 끝나면 그 식의 결과를 줄 끝에 흐린 글씨로 보여 준다. 캐럿이 그 줄 끝에 있을 때 Tab을 누르면 결과를 본문에 넣는다.
 * `이름 = 식`으로 이름을 정하면 아래 줄에서 쓴다. 결과는 장식이라 저장·내보내기·복사에 들어가지 않는다.
 * 계산 규칙은 `lib/calc`.
 */
export const CalcLine = Extension.create({
  name: "calcLine",
  // 목록의 Tab(하위 항목)보다 먼저. 결과가 없으면 넘긴다
  priority: 150,
  addKeyboardShortcuts() {
    return { Tab: ({ editor }) => acceptCalcResult(editor) };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<CalcState>({
        key: calcLineKey,
        state: {
          init: (_, state) => build(state),
          apply: (tr, prev, _old, state) => {
            if (tr.docChanged) {
              // `=`가 없는 문서에서 `=` 없는 글을 쓰는 동안은 문서 전체를 다시 읽지 않는다(긴 문서의 입력 지연)
              if (!prev.anyEq && !touchedEq(tr)) return prev;
              return build(state);
            }
            const active = activeOf(state, prev.entries);
            if (active === prev.active) return prev;
            return { ...prev, active, deco: buildDeco(state.doc, prev.entries, active) };
          },
        },
        props: {
          decorations: (state) => calcLineKey.getState(state)?.deco,
        },
      }),
    ];
  },
});
