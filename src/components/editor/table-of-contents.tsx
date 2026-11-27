import { Node } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { ListTree } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { focusRing } from "@/components/ui/styles";
import { tocDepths } from "@/lib/toc";
import { cn } from "@/lib/utils";
import { getHeadings, goToHeading, type Heading } from "./outline";
import { useMessages } from "@/lib/i18n";

/** 입력이 멈춘 뒤 목차를 다시 계산한다(글자마다 문서를 훑지 않는다) */
const DEBOUNCE_MS = 150;

/** 들여쓰기 단계(0·1·2) → 왼쪽 여백. 4px 리듬 */
const INDENT = ["pl-3", "pl-6", "pl-9"] as const;

const keyOf = (hs: Heading[]) => hs.map((h) => `${h.level}\u0000${h.text}`).join("\n");

/** 제목 목록을 들고, 문서가 바뀌면(제목이 바뀌었을 때만 다시 그리도록) 디바운스해서 갱신한다 */
function useLiveHeadings(editor: Editor): Heading[] {
  const [headings, setHeadings] = useState(() => getHeadings(editor));
  const key = useRef(keyOf(headings));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (editor.isDestroyed) return;
      const next = getHeadings(editor);
      const nextKey = keyOf(next);
      if (nextKey === key.current) return;
      key.current = nextKey;
      setHeadings(next);
    };
    const onUpdate = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return;
      clearTimeout(timer);
      timer = setTimeout(refresh, DEBOUNCE_MS);
    };
    editor.on("update", onUpdate);
    return () => {
      clearTimeout(timer);
      editor.off("update", onUpdate);
    };
  }, [editor]);

  return headings;
}

/**
 * 누른 항목으로 간다. 목록은 디바운스라 잠깐 낡았을 수 있어, 누를 때 다시 계산한 문서에서 같은 글의 제목을 찾는다.
 */
function jumpTo(editor: Editor, index: number, text: string, smooth: boolean) {
  const now = getHeadings(editor);
  const target = now[index]?.text === text ? now[index] : now.find((h) => h.text === text);
  if (target) goToHeading(editor, target, { smooth });
}

function TableOfContentsView({ editor }: ReactNodeViewProps) {
  const m = useMessages();
  const headings = useLiveHeadings(editor);
  const reduceMotion = useReducedMotion();
  const depths = tocDepths(headings.map((h) => h.level));

  if (headings.length === 0) {
    return (
      <NodeViewWrapper data-type="table-of-contents" contentEditable={false} className="my-4">
        <div className="flex items-center gap-2 px-3 py-1 text-tertiary">
          <ListTree className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
          <span className="text-body">{m.editor.toc.empty}</span>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-type="table-of-contents" contentEditable={false} className="my-4">
      <nav aria-label={m.editor.toc.label} className="flex flex-col gap-1">
        <div className="flex items-center gap-2 px-3 text-caption text-tertiary">
          <ListTree className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
          <span>{m.editor.toc.label}</span>
        </div>
        {/* 본문 CSS가 ul의 점 표시를 주므로 목록 역할만 주고 div로 그린다 */}
        <div role="list" className="flex flex-col border-l border-line">
          {headings.map((h, i) => (
            <div key={`${i}-${h.text}`} role="listitem">
              <button
                type="button"
                title={h.text}
                onClick={() => jumpTo(editor, i, h.text, !reduceMotion)}
                className={cn(
                  "block w-full truncate rounded-md py-1 pr-3 text-left hover:bg-hover force-hover:bg-hover",
                  h.level === 1 ? "text-body" : "text-secondary",
                  INDENT[Math.min(depths[i] ?? 0, INDENT.length - 1)],
                  focusRing,
                )}
              >
                {h.text}
              </button>
            </div>
          ))}
        </div>
      </nav>
    </NodeViewWrapper>
  );
}

/**
 * ED-TableOfContents — 본문 제목(H1–H3)의 계층 목록(EDIT-27). 문서 JSON에는 노드 하나만 남고 목록은 저장하지 않는다.
 * 슬래시 메뉴 「목차」로 넣는다. 블록 하나처럼 선택·삭제·끌기·실행 취소가 된다.
 */
export const TableOfContents = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="table-of-contents"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { ...HTMLAttributes, "data-type": "table-of-contents" }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableOfContentsView);
  },
});
