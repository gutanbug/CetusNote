import { Schema, type Node as PMNode } from "@tiptap/pm/model";
import { joinBackward } from "@tiptap/pm/commands";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";
import { createLowlight, common } from "lowlight";
import { describe, expect, it } from "vitest";
import { incrementalLowlight } from "./code-highlight";

// 노드 뷰·DOM 없이 ProseMirror 상태만으로 검사한다 (플러그인 장식 계산이 목적)
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    codeBlock: {
      group: "block",
      content: "text*",
      code: true,
      attrs: { language: { default: null } },
    },
    text: {},
  },
});
const lowlight = createLowlight(common);
const plugin = incrementalLowlight({ name: "codeBlock", lowlight, defaultLanguage: null });

const code = (text: string, language: string | null = "typescript") =>
  schema.nodes.codeBlock.create({ language }, text ? schema.text(text) : undefined);
const para = (text: string) =>
  schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined);

/** 장식을 비교 가능한 목록으로 (정렬해 순서 차이를 없앤다) */
function list(set: DecorationSet, doc: PMNode) {
  return set
    .find(0, doc.content.size)
    .map(
      (d) =>
        `${d.from}-${d.to}:${(d as unknown as { type: { attrs: { class: string } } }).type.attrs.class}`,
    )
    .sort();
}

/** 전체를 처음부터 다시 칠한 결과 (기준) */
function fullStateOf(doc: PMNode) {
  const fresh = EditorState.create({ doc, plugins: [plugin] });
  return list(plugin.getState(fresh) as DecorationSet, doc);
}

function start(doc: PMNode) {
  return EditorState.create({ doc, plugins: [plugin] });
}

/** 트랜잭션마다 증분 결과가 전체 재계산과 같은지 확인한다 */
function expectSameAsFull(state: EditorState, tr: Transaction) {
  const next = state.apply(tr);
  const incremental = list(plugin.getState(next) as DecorationSet, next.doc);
  expect(incremental).toEqual(fullStateOf(next.doc));
  return next;
}

describe("incrementalLowlight — 증분 하이라이트", () => {
  it("처음 상태는 전체 칠한 것과 같다", () => {
    const doc = schema.nodes.doc.create(null, [
      para("일반 글"),
      code("const a = 1;"),
      code("def f(): pass", "python"),
    ]);
    const state = start(doc);
    expect(list(plugin.getState(state) as DecorationSet, doc)).toEqual(fullStateOf(doc));
    expect(list(plugin.getState(state) as DecorationSet, doc).length).toBeGreaterThan(0);
  });

  it("글자를 넣어도 다른 코드 블록의 장식은 그대로 옮긴다", () => {
    const doc = schema.nodes.doc.create(null, [
      code("let x = 1;"),
      para("글"),
      code("const y = 2;"),
    ]);
    const state = start(doc);
    // 세 번째 블록 안(끝)에 글자 하나 넣기
    const pos = doc.content.size - 3;
    const tr = state.tr.insertText("z", pos);
    expectSameAsFull(state, tr);
  });

  it("코드 블록 안을 지우고 새로 쓴 것을 다시 칠한다", () => {
    const doc = schema.nodes.doc.create(null, [code("const a = 1;"), code("function f() {}")]);
    const state = start(doc);
    const tr = state.tr.delete(2, 8);
    expectSameAsFull(state, tr);
  });

  it("코드 블록을 통째로 지우면 그 블록의 장식도 사라진다", () => {
    const doc = schema.nodes.doc.create(null, [
      code("const a = 1;"),
      para("x"),
      code("const b = 2;"),
    ]);
    const state = start(doc);
    const first = doc.firstChild!;
    const tr = state.tr.delete(0, first.nodeSize);
    const next = expectSameAsFull(state, tr);
    expect(next.doc.firstChild!.type.name).toBe("paragraph");
  });

  it("언어를 바꾸면 그 블록만 다시 칠한다", () => {
    const doc = schema.nodes.doc.create(null, [code("const a = 1;"), code("let b = 2;")]);
    const state = start(doc);
    const tr = state.tr.setNodeMarkup(0, undefined, { language: "python" });
    expectSameAsFull(state, tr);
  });

  it("여러 블록에 걸친 붙여넣기·삭제도 전체 재계산과 같다", () => {
    const doc = schema.nodes.doc.create(null, [
      code("const a = 1;"),
      para("가운데"),
      code("const b = 2;"),
      code("const c = 3;"),
    ]);
    const state = start(doc);
    const tr = state.tr.delete(2, doc.content.size - 4);
    expectSameAsFull(state, tr);
  });

  it("빈 문단을 코드 블록으로 바꾸고 다시 되돌려도 같다", () => {
    const doc = schema.nodes.doc.create(null, [para("")]);
    const state = start(doc);
    const withCode = state.tr.replaceWith(0, doc.content.size, code("if (x) return 1;"));
    const after = expectSameAsFull(state, withCode);
    const back = after.tr.replaceWith(0, after.doc.content.size, para("되돌림"));
    expectSameAsFull(after, back);
  });

  it("글자를 넣은 뒤 선택 위치만 옮기는 트랜잭션은 장식을 바꾸지 않는다", () => {
    const doc = schema.nodes.doc.create(null, [code("const a = 1;")]);
    const state = start(doc);
    const before = list(plugin.getState(state) as DecorationSet, doc);
    const moved = state.apply(state.tr.setSelection(TextSelection.create(doc, 3)));
    expect(list(plugin.getState(moved) as DecorationSet, doc)).toEqual(before);
  });
});

/** 코드 블록 밖에 걸린 장식 수 (옛 하이라이트가 문단에 남았는지 본다) */
function decorationsOutsideCode(state: EditorState) {
  const set = plugin.getState(state) as DecorationSet;
  return set
    .find(0, state.doc.content.size)
    .filter((d) => state.doc.resolve(d.from).parent.type.name !== "codeBlock").length;
}

describe("incrementalLowlight — 블록 구조가 바뀌는 편집 (SYS-11 회귀)", () => {
  it("Backspace로 코드 블록을 문단에 잇면 옛 하이라이트가 문단에 남지 않는다", () => {
    const doc = schema.nodes.doc.create(null, [para("hello"), code("const a = 1;")]);
    const state = start(doc);
    // 코드 블록 시작(8)에서 Backspace = joinBackward
    const at = state.apply(state.tr.setSelection(TextSelection.create(doc, 8)));
    let joined: EditorState | null = null;
    expect(joinBackward(at, (tr) => (joined = at.apply(tr)))).toBe(true);
    expect(decorationsOutsideCode(joined!)).toBe(0);
    expect(list(plugin.getState(joined!) as DecorationSet, joined!.doc)).toEqual(
      fullStateOf(joined!.doc),
    );
  });

  it("문단과 코드 블록에 걸친 범위 삭제 뒤에도 전체 재계산과 같다", () => {
    const doc = schema.nodes.doc.create(null, [para("abc"), code("let q = 3;")]);
    const state = start(doc);
    const next = expectSameAsFull(state, state.tr.delete(2, 9));
    expect(decorationsOutsideCode(next)).toBe(0);
  });

  it("코드 블록 중간에 코드 블록을 붙여 넣어 나누면 전체 재계산과 같다", () => {
    const doc = schema.nodes.doc.create(null, [code("const a = 1; let b = 22;")]);
    const state = start(doc);
    expectSameAsFull(state, state.tr.replaceWith(9, 9, code("color: red;", "css")));
  });

  it("무작위 편집 100회 × 30단계도 매번 전체 재계산과 같다 (고정 시드)", () => {
    const LANGS = [null, "typescript", "python", "css", "nope-lang"];
    const WORDS = ["const ", "function ", "'s' ", "// c\n", "return ", "{ a: 1 } ", "x", "\n"];
    for (let seed = 1; seed <= 100; seed++) {
      let s = seed * 2654435761;
      const r = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
      const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
      const text = () =>
        Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(WORDS)).join("");
      const block = () => (r() < 0.5 ? para(text()) : code(text(), pick(LANGS)));
      let state = start(
        schema.nodes.doc.create(null, [block(), block(), block(), block(), block()]),
      );
      for (let step = 0; step < 30; step++) {
        const doc = state.doc;
        const textblocks: number[] = [];
        doc.descendants((node, pos) => {
          if (node.isTextblock) textblocks.push(pos);
          return !node.isTextblock;
        });
        const k = r();
        let tr: Transaction | null = null;
        try {
          if (k < 0.3) {
            const tb = pick(textblocks);
            const pos = tb + 1 + Math.floor(r() * doc.nodeAt(tb)!.content.size);
            tr = state.tr.insertText(text(), pos);
          } else if (k < 0.45) {
            const a = Math.floor(r() * doc.content.size);
            const b = Math.min(doc.content.size, a + 1 + Math.floor(r() * 12));
            tr = state.tr.delete(a, b);
          } else if (k < 0.6) {
            const at = pick(textblocks) + 1;
            const sel = state.apply(state.tr.setSelection(TextSelection.create(doc, at)));
            joinBackward(sel, (t) => (tr = t));
          } else if (k < 0.8) {
            const a = Math.floor(r() * doc.content.size);
            tr = state.tr.replaceWith(a, a, block());
          } else {
            const at = pick(textblocks);
            const node = doc.nodeAt(at);
            if (node?.type.name === "codeBlock") {
              tr = state.tr.setNodeMarkup(at, undefined, { language: pick(LANGS) });
            }
          }
        } catch {
          tr = null;
        }
        if (!tr || !tr.docChanged) continue;
        state = expectSameAsFull(state, tr);
      }
    }
  });
});
