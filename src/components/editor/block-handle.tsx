import type { Editor } from "@tiptap/core";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { GripVertical, Plus } from "lucide-react";
import * as React from "react";
import { Kbd } from "@/components/ui/kbd";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { BlockMenu } from "./block-menu";
import { BLOCK_MENU_EVENT } from "./block-keys";

// DragHandle은 이 객체가 바뀌면 플러그인을 다시 등록한다(그때 다른 플러그인 뷰도 다시 만들어져
// 열린 슬래시 메뉴가 닫힌다). 그래서 모듈 상수로 둔다.
const POSITION = { placement: "left-start", strategy: "absolute" } as const;

/**
 * 블록 맨 위가 아니라 **첫 줄 글자의 가운데**에 핸들을 맞출 거리(px, 런타임 측정값).
 * 인용(앞 여백)·제목(큰 줄 높이)·표처럼 첫 줄 위치가 블록마다 달라 측정한다. 글자가 없으면 줄 높이로 계산한다.
 */
export function firstLineCenter(dom: HTMLElement): number {
  const top = dom.getBoundingClientRect().top;
  const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  });
  const text = walker.nextNode();
  if (text) {
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 1);
    const rect = range.getClientRects()[0];
    if (rect && rect.height) return rect.top + rect.height / 2 - top;
  }
  const cs = getComputedStyle(dom);
  const height = dom.getBoundingClientRect().height;
  const line = Number.parseFloat(cs.lineHeight) || height;
  return (Number.parseFloat(cs.paddingTop) || 0) + Math.min(line, height) / 2;
}

type Target = { node: PMNode; pos: number };

/**
 * ED-BlockHandle — 블록에 마우스를 올리면 왼쪽에 `＋`(아래에 블록 추가)와 `⋮⋮`(끌어서 옮기기)가 뜬다.
 * 프로토타입 `.block-gutter` (아이콘 버튼 22×24, 3차 글자색). 끌기는 @tiptap/extension-drag-handle(MIT).
 * 키보드: ⌘/ 로 캐럿이 있는 블록에 같은 두 동작을 목록으로 연다(BlockMenu).
 */
export function BlockHandle({ editor }: { editor: Editor }) {
  const target = React.useRef<Target | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [menu, setMenu] = React.useState<Target | null>(null);
  const handleRef = React.useRef<HTMLDivElement>(null);

  /** 아래에 빈 문단을 만들고 `/`를 넣어 슬래시 메뉴를 연다. 빈 문단이면 그 자리에서 연다 */
  const addBelow = (t: Target | null) => {
    if (!t) return;
    const emptyParagraph = t.node.type.name === "paragraph" && t.node.content.size === 0;
    const chain = editor.chain().focus();
    if (emptyParagraph) {
      chain
        .setTextSelection(t.pos + 1)
        .insertContent("/")
        .run();
      return;
    }
    const after = t.pos + t.node.nodeSize;
    chain
      .insertContentAt(after, { type: "paragraph", content: [{ type: "text", text: "/" }] })
      .setTextSelection(after + 2)
      .run();
  };

  /** 누르면 블록 전체를 고른다(지우기·복사를 키보드로 이어서 할 수 있다) */
  const selectBlock = (t: Target | null) => {
    if (t) editor.chain().focus().setNodeSelection(t.pos).run();
  };

  // ⌘/ (BlockKeys 키맵이 보낸 이벤트) — 캐럿이 있는 최상위 블록에 메뉴를 연다.
  // view가 아직 없을 수 있어 editor.view를 읽지 않고, 이벤트 대상의 dom.editor로 자기 에디터인지 가린다
  React.useEffect(() => {
    const onEvent = (e: Event) => {
      const dom = e.target as (HTMLElement & { editor?: Editor }) | null;
      if (!dom || dom.editor !== editor) return;
      const { $from } = editor.state.selection;
      if ($from.depth < 1) return;
      setMenu({ node: $from.node(1), pos: $from.before(1) });
    };
    document.addEventListener(BLOCK_MENU_EVENT, onEvent);
    return () => document.removeEventListener(BLOCK_MENU_EVENT, onEvent);
  }, [editor]);

  // Esc·바깥 누름으로 닫으면 메뉴 항목이 사라진 뒤 캐럿으로 포커스를 돌린다(사라지기 전에 주면 body로 빠진다)
  const returnFocus = React.useRef(false);
  React.useEffect(() => {
    if (!menu && returnFocus.current) {
      returnFocus.current = false;
      editor.view.focus();
    }
  }, [menu, editor]);

  const menuAnchor = React.useCallback(() => {
    if (!menu) return null;
    const dom = editor.view.nodeDOM(menu.pos);
    return dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
  }, [editor, menu]);

  return (
    <>
      <DragHandle
        editor={editor}
        onNodeChange={({ node, pos }) => {
          target.current = node ? { node, pos } : null;
          const el = handleRef.current;
          const dom = node ? editor.view.nodeDOM(pos) : null;
          if (el && dom instanceof HTMLElement) {
            const shift = firstLineCenter(dom) - el.offsetHeight / 2;
            el.style.transform = `translateY(${Math.round(shift)}px)`;
          }
        }}
        onElementDragStart={() => setDragging(true)}
        onElementDragEnd={() => setDragging(false)}
        computePositionConfig={POSITION}
      >
        <div
          ref={handleRef}
          data-slot="block-handle"
          data-dragging={dragging || undefined}
          className={cn("flex items-center pr-1", dragging && "opacity-0")}
        >
          <IconButton
            label="아래에 블록 추가"
            noTooltip={dragging}
            className="h-6 w-5.5 text-tertiary"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => addBelow(target.current)}
          >
            <Plus strokeWidth={1.5} />
          </IconButton>
          <IconButton
            label="끌어서 옮기기 · 눌러서 고르기"
            shortcut={<Kbd keys={["⌘", "/"]} />}
            noTooltip={dragging}
            className="h-6 w-5.5 cursor-grab text-tertiary active:cursor-grabbing"
            onClick={() => selectBlock(target.current)}
          >
            <GripVertical strokeWidth={1.5} />
          </IconButton>
        </div>
      </DragHandle>
      {menu ? (
        <BlockMenu
          label="블록 메뉴"
          anchor={menuAnchor}
          items={[
            { id: "add", label: "아래에 블록 추가", icon: <Plus strokeWidth={1.5} /> },
            {
              id: "select",
              label: "끌어서 옮기기 · 블록 선택",
              icon: <GripVertical strokeWidth={1.5} />,
            },
          ]}
          onSelect={(id) => {
            const t = menu;
            returnFocus.current = false;
            setMenu(null);
            if (id === "add") addBelow(t);
            else selectBlock(t);
          }}
          onClose={() => {
            returnFocus.current = true;
            setMenu(null);
          }}
        />
      ) : null}
    </>
  );
}
