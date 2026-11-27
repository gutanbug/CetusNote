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
  /** 합계·평균 줄이 있는가 — 있으면 `=` 없는 줄을 고쳐도 다시 계산한다(위 줄 값을 센다) */
  hasAgg: boolean;
  /** 조합 입력 중이라 다시 계산하지 않고 미뤘다 — 조합이 끝나면 계산한다 */
  stale: boolean;
};

const AGG_RE = /합계|총합|소계|평균|\b(?:sum|total|avg|average)\b/i;

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

function rangeHasEq(doc: PMNode, from: number, to: number): boolean {
  let found = false;
  const end = Math.min(to, doc.content.size);
  if (from > end) return false;
  doc.nodesBetween(from, end, (node) => {
    if (found || node.type.spec.code) return false;
    if (!node.isTextblock) return true;
    if (blockText(node).includes("=")) found = true;
    return false;
  });
  return found;
}

/** 이번 변경이 `=`가 든 블록을 건드렸는가 — 바뀌기 전과 뒤 모두 본다(지운 `=` 줄도 결과를 바꾼다) */
function touchedEq(tr: Transaction): boolean {
  return tr.mapping.maps.some((map, i) => {
    const rest = tr.mapping.slice(i + 1);
    let found = false;
    map.forEach((oldFrom, oldTo, from, to) => {
      if (found) return;
      found =
        rangeHasEq(tr.docs[i]!, oldFrom, oldTo) ||
        rangeHasEq(tr.doc, rest.map(from, -1), rest.map(to, 1));
    });
    return found;
  });
}

/** 문서의 글 블록을 위에서 아래로 계산한다. 코드 블록은 줄로 보지 않는다 */
function computeEntries(
  doc: PMNode,
  now: Date,
): { entries: CalcEntry[]; anyEq: boolean; hasAgg: boolean } {
  const blocks: { pos: number; node: PMNode }[] = [];
  let any = false;
  let hasAgg = false;
  doc.descendants((node, pos) => {
    if (node.type.spec.code) return false;
    if (!node.isTextblock) return true;
    blocks.push({ pos, node });
    const text = blockText(node);
    if (text.includes("=")) {
      any = true;
      if (!hasAgg && AGG_RE.test(text)) hasAgg = true;
    }
    return false;
  });
  // 결과는 `=`가 있는 줄에만 생긴다 — 없으면 계산하지 않는다(긴 문서의 입력 지연)
  if (!any) return { entries: [], anyEq: false, hasAgg: false };
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
  return { entries, anyEq: true, hasAgg };
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
  const { entries, anyEq, hasAgg } = computeEntries(state.doc, new Date());
  const active = activeOf(state, entries);
  return {
    entries,
    active,
    anyEq,
    hasAgg,
    stale: false,
    deco: buildDeco(state.doc, entries, active),
  };
}

/** 결과를 다시 계산하지 않고 자리만 옮긴다 */
function mapState(prev: CalcState, tr: Transaction, state: EditorState, stale: boolean): CalcState {
  if (!prev.entries.length) return stale === prev.stale ? prev : { ...prev, stale };
  const entries = prev.entries.map((e) => ({ ...e, end: tr.mapping.map(e.end, -1) }));
  const active = activeOf(state, entries);
  return {
    ...prev,
    entries,
    active,
    stale: prev.stale || stale,
    // 조합 중에는 장식 DOM을 그대로 둔다(옮기기만) — 조합 중인 글 옆 DOM이 바뀌면 WebKit 입력기가 끊긴다
    deco: stale ? prev.deco.map(tr.mapping, tr.doc) : buildDeco(state.doc, entries, active),
  };
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
              // 한글 등 조합 중에는 다시 계산하지 않는다. 조합이 끝나면(compositionend) 계산한다
              if (tr.getMeta("composition") !== undefined) return mapState(prev, tr, state, true);
              // `=` 줄을 건드리지 않았으면 결과는 그대로다 — 자리만 옮긴다(긴 문서의 입력 지연).
              // 합계·평균은 `=` 없는 위 줄 값도 세므로 그때는 다시 계산한다
              if (!prev.stale && !touchedEq(tr) && !(prev.anyEq && prev.hasAgg))
                return mapState(prev, tr, state, false);
              return build(state);
            }
            if (tr.getMeta(calcLineKey) === "refresh" && prev.stale) return build(state);
            const active = activeOf(state, prev.entries);
            if (active === prev.active) return prev;
            return { ...prev, active, deco: buildDeco(state.doc, prev.entries, active) };
          },
        },
        props: {
          decorations: (state) => calcLineKey.getState(state)?.deco,
          handleDOMEvents: {
            compositionend: (view) => {
              // 조합 중에 미룬 계산을 한다. 조합을 끝내는 트랜잭션이 먼저 적용되도록 한 틱 뒤에
              setTimeout(() => {
                if (!view.isDestroyed && calcLineKey.getState(view.state)?.stale)
                  view.dispatch(view.state.tr.setMeta(calcLineKey, "refresh"));
              });
              return false;
            },
          },
        },
      }),
    ];
  },
});
