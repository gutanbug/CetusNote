import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { ChevronRight, FileText, FileX, X } from "lucide-react";
import * as React from "react";
import { IconButton } from "@/components/ui/icon-button";
import { PageIcon } from "@/components/ui/page-icon";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { useMessages } from "@/lib/i18n";

// ── 표시 (순수 UI: props만 받는다) ─────────────────────

export type SubpageState = "ready" | "loading" | "missing" | "trashed";

type SubpageBlockProps = {
  state: SubpageState;
  /** ready · trashed에서 보인다. 비면 「제목 없음」 */
  title?: string;
  icon?: string | null;
  selected?: boolean;
  /** 열기 — ⌘/Ctrl 누른 채면 newTab. ready일 때만 호출된다 */
  onOpen?: (opts: { newTab: boolean }) => void;
  /** 블록 지우기 — missing·trashed에서 보인다 */
  onRemove?: () => void;
};

const rowClass = cn(
  "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left",
  "transition-colors duration-(--dur-fast)",
);

/**
 * ED-SubpageBlock — 하위 페이지 링크 한 줄 (카드 아님). 누르면 열리고, 지운 페이지·휴지통 페이지는 흐리게 보인다.
 * 열기 단축키: Enter(새 탭은 ⌘/Ctrl+Enter). 열기 버튼과 지우기 버튼은 따로 두어 중첩 버튼을 피한다.
 */
function SubpageBlock({ state, title, icon, selected, onOpen, onRemove }: SubpageBlockProps) {
  const m = useMessages();
  const label = title || m.editor.untitled;

  if (state === "loading") {
    return (
      <div
        data-slot="subpage-block"
        data-state="loading"
        aria-busy
        className="flex items-center gap-2 rounded-md px-2 py-1.5"
      >
        <span aria-hidden className="size-4 rounded-xs bg-subtle" />
        <span aria-hidden className="h-3 w-40 rounded-xs bg-subtle" />
        <span className="sr-only">{m.editor.subpage.loading}</span>
      </div>
    );
  }

  const openable = state === "ready";
  const removable = state === "missing" || state === "trashed";

  return (
    <div
      data-slot="subpage-block"
      data-state={state}
      data-selected={selected || undefined}
      className={cn(
        "group flex w-full min-w-0 items-center gap-1 rounded-md",
        selected && "ring-1 ring-accent",
      )}
    >
      {openable ? (
        <button
          type="button"
          className={cn(rowClass, "text-primary hover:bg-hover force-hover:bg-hover", focusRing)}
          onClick={(e) => onOpen?.({ newTab: e.metaKey || e.ctrlKey })}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // 클릭 이벤트 대신 직접 처리해야 ⌘Enter가 새 탭으로 간다
            e.preventDefault();
            onOpen?.({ newTab: e.metaKey || e.ctrlKey });
          }}
        >
          <SubpageIcon icon={icon} />
          <span className="min-w-0 flex-1 truncate text-ui">{label}</span>
          <span
            aria-hidden
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 text-caption text-tertiary",
              "opacity-0 transition-opacity duration-(--dur-fast)",
              "group-focus-within:opacity-100 group-hover:opacity-100 force-hover:opacity-100",
            )}
          >
            {m.editor.subpage.label}
            <ChevronRight strokeWidth={1.5} className="size-4" />
          </span>
        </button>
      ) : (
        <div className={cn(rowClass, "text-tertiary")}>
          {state === "missing" ? (
            <FileX strokeWidth={1.5} aria-hidden className="size-4 shrink-0" />
          ) : (
            <SubpageIcon icon={icon} />
          )}
          <span className="min-w-0 flex-1 truncate text-ui">
            {state === "missing" ? m.editor.subpage.deleted : label}
          </span>
          {state === "trashed" ? (
            <span className="shrink-0 text-caption">{m.editor.subpage.inTrash}</span>
          ) : null}
        </div>
      )}
      {removable && onRemove ? (
        <IconButton label={m.editor.subpage.removeBlock} onClick={onRemove} className="mr-1">
          <X strokeWidth={1.5} />
        </IconButton>
      ) : null}
    </div>
  );
}

function SubpageIcon({ icon }: { icon?: string | null }) {
  return icon ? (
    <span aria-hidden className="inline-flex size-4 shrink-0 items-center justify-center">
      <PageIcon icon={icon} />
    </span>
  ) : (
    <FileText strokeWidth={1.5} aria-hidden className="size-4 shrink-0" />
  );
}

// ── Tiptap 노드 (atom, 속성 pageId) ───────────────────

/** 페이지 상태. undefined = 아직 읽는 중. exists false = 지워진 페이지 */
export type SubpageRef = { title: string; icon?: string | null; exists: boolean; trashed: boolean };

/** 위 계층이 준다(에디터는 저장을 모른다). */
export type SubpageSource = {
  resolvePage: (id: string) => SubpageRef | undefined;
  onOpen: (id: string, opts: { newTab: boolean }) => void;
};

const SubpageContext = React.createContext<SubpageSource | null>(null);
/** NoteEditor가 EditorContent 바깥에 둔다 — 블록이 제목을 늘 새로 읽는다 */
export const SubpageProvider = SubpageContext.Provider;

function SubpageNodeView({ node, selected, deleteNode }: ReactNodeViewProps) {
  const source = React.useContext(SubpageContext);
  const id = String(node.attrs.pageId ?? "");
  const ref: SubpageRef | undefined = source
    ? source.resolvePage(id)
    : { title: "", exists: false, trashed: false };
  const state: SubpageState =
    ref === undefined ? "loading" : !ref.exists ? "missing" : ref.trashed ? "trashed" : "ready";
  return (
    <NodeViewWrapper data-subpage={id} className="my-0.5">
      <SubpageBlock
        state={state}
        title={ref?.title}
        icon={ref?.icon}
        selected={selected}
        onOpen={(opts) => source?.onOpen(id, opts)}
        onRemove={() => deleteNode()}
      />
    </NodeViewWrapper>
  );
}

/** ED-SubpageBlock 노드. 저장 형식: `{ type: "subpage", attrs: { pageId } }`. */
export const SubpageBlockNode = Node.create({
  name: "subpage",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-subpage"),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-subpage]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-subpage": node.attrs.pageId ?? "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SubpageNodeView);
  },
});

export { SubpageBlock, type SubpageBlockProps };
