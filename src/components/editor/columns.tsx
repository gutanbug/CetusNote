import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import * as React from "react";

/** 열 하나의 최소 비율(flex-grow). 이보다 좁아지지 않는다 */
export const COLUMN_MIN_WEIGHT = 0.5;
/** 열 비율을 키보드로 바꿀 때 한 번의 폭 */
export const COLUMN_STEP = 0.25;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      /** 빈 문단이 든 열 2·3·4개짜리 단 나누기를 캐럿 자리에 넣는다 */
      insertColumns: (attrs?: { count?: 2 | 3 | 4 }) => ReturnType;
      /** 단 나누기(위치 pos)의 열 비율을 한 번에 정한다 (열 수와 같은 길이) */
      setColumnWidths: (attrs: { pos: number; widths: number[] }) => ReturnType;
      /** 캐럿이 든 열에서 앞(−1)·뒤(+1) 열의 첫 줄로 옮긴다. 끝 열이면 아무것도 하지 않는다 */
      moveToColumn: (direction: 1 | -1) => ReturnType;
      /** 캐럿이 든 열을 delta만큼 넓힌다(옆 열에서 가져온다) */
      resizeColumn: (delta: number) => ReturnType;
    };
  }
}

const clampWeight = (w: number, max = 10) => Math.min(Math.max(w, COLUMN_MIN_WEIGHT), max);

/** 자식 노드들의 시작 위치 */
function childStarts(parent: PMNode, start: number) {
  const out: number[] = [];
  let at = start;
  parent.forEach((child) => {
    out.push(at);
    at += child.nodeSize;
  });
  return out;
}

/** 캐럿이 든 열과 그 단 나누기. 열 밖이면 null */
function columnContext(state: EditorState) {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 1; d--) {
    if ($from.node(d).type.name === "column" && $from.node(d - 1).type.name === "columns") {
      const columnsDepth = d - 1;
      return {
        columnsPos: $from.before(columnsDepth),
        columns: $from.node(columnsDepth),
        index: $from.index(columnsDepth),
      };
    }
  }
  return null;
}

/**
 * 이 단 나누기의 열 DOM들 (안쪽 열의 열은 제외). React 래퍼 div는 펼쳐져 있어 열이 바로 자식처럼 보인다.
 */
function columnElements(body: HTMLElement) {
  return Array.from(body.querySelectorAll<HTMLElement>('[data-type="column"]')).filter(
    (el) => el.parentElement?.closest(".sn-columns-body") === body,
  );
}

/** 열 경계 손잡이를 그릴 위치 (DOM 측정 결과) */
type Layout = { stacked: boolean; bounds: number[] };

/**
 * 열 경계의 가로 위치(단 나누기 너비에 대한 %). 세로로 쌓였으면 손잡이가 없다.
 * 측정은 DOM을 읽기만 한다(노드 뷰 바깥 열은 Tiptap이 그린다).
 */
function measureLayout(wrap: HTMLElement | null): Layout {
  const body = wrap?.querySelector<HTMLElement>(":scope > .sn-columns-body");
  if (!wrap || !body) return { stacked: true, bounds: [] };
  const cols = columnElements(body);
  if (cols.length < 2) return { stacked: true, bounds: [] };
  const rects = cols.map((c) => c.getBoundingClientRect());
  if (Math.abs(rects[0].top - rects[1].top) > 1) return { stacked: true, bounds: [] };
  const box = wrap.getBoundingClientRect();
  if (box.width === 0) return { stacked: true, bounds: [] };
  const bounds = rects
    .slice(0, -1)
    .map((r, i) => (((r.right + rects[i + 1].left) / 2 - box.left) / box.width) * 100);
  return { stacked: false, bounds };
}

function sameLayout(a: Layout, b: Layout) {
  return (
    a.stacked === b.stacked &&
    a.bounds.length === b.bounds.length &&
    a.bounds.every((x, i) => Math.abs(x - b.bounds[i]) < 0.01)
  );
}

function ColumnsView({ node, editor, getPos }: ReactNodeViewProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = React.useState<Layout>({ stacked: true, bounds: [] });

  const apply = React.useCallback(
    () =>
      setLayout((prev) => {
        const next = measureLayout(wrapRef.current);
        return sameLayout(prev, next) ? prev : next;
      }),
    [],
  );
  // 열이 바뀔 때마다(렌더 뒤) 경계를 다시 잰다
  React.useLayoutEffect(() => apply());
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [apply]);

  const startDrag = (e: React.PointerEvent, i: number) => {
    const pos = getPos();
    const body = wrapRef.current?.querySelector<HTMLElement>(":scope > .sn-columns-body");
    if (typeof pos !== "number" || !body) return;
    e.preventDefault();
    const cols = columnElements(body);
    const widths: number[] = [];
    node.forEach((c) => widths.push(Number(c.attrs.width) || 1));
    const a = widths[i];
    const b = widths[i + 1];
    const sum = a + b;
    // 비율 1당 픽셀: 열 폭은 flex-grow에 비례하고 간격은 빼고 나눈다
    const pxPerWeight = cols[i].getBoundingClientRect().width / a;
    const startX = e.clientX;
    let next = a;
    const preview = () => {
      cols[i].style.flexGrow = String(next);
      cols[i + 1].style.flexGrow = String(sum - next);
    };
    const move = (ev: PointerEvent) => {
      next = clampWeight(a + (ev.clientX - startX) / pxPerWeight, sum - COLUMN_MIN_WEIGHT);
      preview();
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    const up = () => {
      stop();
      if (next === a) return;
      editor.commands.setColumnWidths({
        pos,
        widths: widths.map((w, k) => (k === i ? next : k === i + 1 ? sum - next : w)),
      });
    };
    const cancel = () => {
      stop();
      cols[i].style.flexGrow = String(a);
      cols[i + 1].style.flexGrow = String(b);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  return (
    <NodeViewWrapper
      ref={wrapRef}
      data-type="columns"
      data-count={node.childCount}
      className="@container relative my-2"
    >
      {/* 단 나누기 폭이 32rem 아래면 세로로 쌓는다 (컨테이너 쿼리) */}
      <NodeViewContent className="sn-columns-body flex flex-col gap-2 @[32rem]:flex-row" />
      {/* 손잡이는 마우스용이다. 키보드는 Mod-Alt-Shift-←→ (resizeColumn) */}
      {!layout.stacked &&
        layout.bounds.map((x, i) => (
          <div
            key={i}
            aria-hidden
            contentEditable={false}
            onPointerDown={(e) => startDrag(e, i)}
            style={{ left: `${x}%` }}
            className="group absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-col-resize touch-none"
          >
            <span className="mx-auto block h-full w-0.5 rounded-pill bg-transparent transition-colors group-hover:bg-line" />
          </div>
        ))}
    </NodeViewWrapper>
  );
}

/**
 * ED-Columns — 단 나누기 2–4열. `columns > column{2,4} > 블록+`.
 * 열 비율은 열의 `width`(flex-grow)에 저장한다. 좁은 폭(32rem 아래)에서는 세로로 쌓인다.
 *
 * 키보드: Mod-Alt-←/→ 앞·뒤 열로 옮김, Mod-Alt-Shift-←/→ 캐럿 열 폭 조절.
 * Tab은 가로채지 않는다(EDIT-22 탭 문자, 열 안 문단에서도 같다).
 * Tiptap 드래그 핸들(DragHandle)은 최상위 블록만 잡는다 — 열 안 블록은 핸들이 없다(nested 옵션은 쓰지 않음).
 * 슬래시 「2열」「3열」「4열」 연결은 phase 2 (`insertColumns`).
 */
export const Columns = Node.create({
  name: "columns",
  group: "block",
  content: "column{2,4}",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "columns" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnsView);
  },

  addCommands() {
    return {
      insertColumns:
        (attrs) =>
        ({ commands }) => {
          const count = attrs?.count ?? 2;
          return commands.insertContent({
            type: this.name,
            content: Array.from({ length: count }, () => ({
              type: "column",
              attrs: { width: 1 },
              content: [{ type: "paragraph" }],
            })),
          });
        },
      setColumnWidths:
        ({ pos, widths }) =>
        ({ state, tr }) => {
          const node = state.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name || node.childCount !== widths.length)
            return false;
          childStarts(node, pos + 1).forEach((at, i) =>
            tr.setNodeMarkup(at, undefined, {
              ...node.child(i).attrs,
              width: clampWeight(widths[i]),
            }),
          );
          return true;
        },
      moveToColumn:
        (direction) =>
        ({ state, tr }) => {
          const ctx = columnContext(state);
          if (!ctx) return false;
          const target = ctx.index + direction;
          if (target < 0 || target >= ctx.columns.childCount) return false;
          const starts = childStarts(ctx.columns, ctx.columnsPos + 1);
          // 열 안 첫 문단의 시작(열 시작 + 1)에 가장 가까운 글 위치
          tr.setSelection(TextSelection.near(tr.doc.resolve(starts[target] + 1)));
          tr.scrollIntoView();
          return true;
        },
      resizeColumn:
        (delta) =>
        ({ state, tr }) => {
          const ctx = columnContext(state);
          if (!ctx) return false;
          // 뒤 열이 있으면 거기서, 마지막 열이면 앞 열에서 가져온다
          const other = ctx.index + 1 < ctx.columns.childCount ? ctx.index + 1 : ctx.index - 1;
          if (other < 0) return false;
          const a = Number(ctx.columns.child(ctx.index).attrs.width) || 1;
          const b = Number(ctx.columns.child(other).attrs.width) || 1;
          const na = clampWeight(a + delta, a + b - COLUMN_MIN_WEIGHT);
          if (na === a) return false;
          const starts = childStarts(ctx.columns, ctx.columnsPos + 1);
          tr.setNodeMarkup(starts[ctx.index], undefined, {
            ...ctx.columns.child(ctx.index).attrs,
            width: na,
          });
          tr.setNodeMarkup(starts[other], undefined, {
            ...ctx.columns.child(other).attrs,
            width: a + b - na,
          });
          return true;
        },
    };
  },
});

/** 열 — 블록 여러 개를 담는다. 비율(`width`)은 flex-grow로 그린다 */
export const Column = Node.create({
  name: "column",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      width: {
        default: 1,
        parseHTML: (el) => Number(el.getAttribute("data-width")) || 1,
        renderHTML: (a) => ({
          "data-width": String(a.width),
          style: `flex-grow: ${a.width}`,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "column",
        class: "sn-column min-w-0 @[32rem]:basis-0",
      }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-ArrowLeft": () => this.editor.commands.moveToColumn(-1),
      "Mod-Alt-ArrowRight": () => this.editor.commands.moveToColumn(1),
      "Mod-Alt-Shift-ArrowLeft": () => this.editor.commands.resizeColumn(-COLUMN_STEP),
      "Mod-Alt-Shift-ArrowRight": () => this.editor.commands.resizeColumn(COLUMN_STEP),
    };
  },
});

export const columnExtensions = [Columns, Column];
