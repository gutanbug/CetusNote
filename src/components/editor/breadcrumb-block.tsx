import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import * as React from "react";
import { Breadcrumb, type Crumb } from "@/components/shell/breadcrumb";
import { cn } from "@/lib/utils";

// ── 표시 (순수 UI: props만 받는다) ─────────────────────

type BreadcrumbBlockProps = {
  /** 맨 위 → 이 페이지. undefined면 아직 읽는 중 */
  items?: Crumb[];
  onNavigate?: (id: string) => void;
  selected?: boolean;
};

/**
 * ED-Breadcrumb — 본문 안의 경로 한 줄. 시각은 SH-Breadcrumb을 그대로 쓴다(L4 → L3 import 허용).
 * 최상위 페이지면 현재 페이지 이름 하나만 보인다. 마지막 항목(현재 페이지)은 누를 수 없다.
 */
function BreadcrumbBlock({ items, onNavigate, selected }: BreadcrumbBlockProps) {
  if (items === undefined) {
    return (
      <div
        data-slot="breadcrumb-block"
        data-state="loading"
        aria-busy
        className="flex items-center gap-2 rounded-md px-1 py-1 text-caption text-tertiary"
      >
        <span aria-hidden className="h-3 w-24 rounded-xs bg-subtle" />
        <span className="sr-only">경로를 불러오는 중</span>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div
        data-slot="breadcrumb-block"
        data-state="missing"
        className="rounded-md px-1 py-1 text-caption text-tertiary"
      >
        이 페이지의 경로를 찾을 수 없어요
      </div>
    );
  }
  return (
    <div
      data-slot="breadcrumb-block"
      data-state="ready"
      data-selected={selected || undefined}
      className={cn("flex min-w-0 rounded-md px-1 py-1", selected && "ring-1 ring-accent")}
    >
      <Breadcrumb items={items} onNavigate={onNavigate} maxItems={4} />
    </div>
  );
}

// ── Tiptap 노드 (atom, 속성 없음) ─────────────────────

/** 현재 페이지와 경로 조회는 위 계층이 준다. 노드에는 아무것도 저장하지 않는다. */
export type BreadcrumbSource = {
  /** 이 노트 페이지의 id (경로의 마지막 항목) */
  currentPageId: string;
  /** 맨 위 → pageId 순서. 항목 마지막이 pageId 자신. undefined면 읽는 중 */
  resolvePath: (pageId: string) => Crumb[] | undefined;
  onOpen: (id: string) => void;
};

const BreadcrumbContext = React.createContext<BreadcrumbSource | null>(null);
/** NoteEditor가 EditorContent 바깥에 둔다 */
export const BreadcrumbProvider = BreadcrumbContext.Provider;

function BreadcrumbNodeView({ selected }: ReactNodeViewProps) {
  const source = React.useContext(BreadcrumbContext);
  const items = source ? source.resolvePath(source.currentPageId) : []; // 원본 없으면 "찾을 수 없음"
  return (
    <NodeViewWrapper data-breadcrumb="" className="my-1">
      <BreadcrumbBlock items={items} selected={selected} onNavigate={(id) => source?.onOpen(id)} />
    </NodeViewWrapper>
  );
}

/** ED-Breadcrumb 노드. 저장 형식: `{ type: "breadcrumb" }` (속성 없음). */
export const BreadcrumbBlockNode = Node.create({
  name: "breadcrumb",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: "div[data-breadcrumb]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-breadcrumb": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BreadcrumbNodeView);
  },
});

export { BreadcrumbBlock, type BreadcrumbBlockProps };
