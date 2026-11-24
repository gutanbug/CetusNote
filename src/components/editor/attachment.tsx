import { mergeAttributes, Node, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import * as React from "react";
import type { AttachmentKind } from "@/lib/attachments/limits";
import { FileAttachment, type AttachmentActions } from "./file-attachment";
import { MediaPlayer } from "./media-player";
import { PdfViewer } from "./pdf-viewer";

/**
 * ED-FileAttachment · ED-PdfViewer · ED-MediaPlayer의 Tiptap 블록 노드 (이름 `attachment`, EDIT-31~33).
 * 종류는 노드 속성 `kind`(file · pdf · video · audio)로 가른다 — 블록 셋을 따로 두지 않는다.
 * 속성: path(`assets/<id>/…`), name, size, mime, kind, caption(선택, 영상·소리만 그린다).
 * 저장 계층은 AttachmentSource로 받는다. 이 파일은 lib/storage를 모른다.
 */

/** 고르기 대화상자의 종류 (lib/storage의 AttachmentPickKind와 같은 값) */
export type AttachmentPickKind = "file" | "pdf" | "media";

/** 노드 속성 모양의 첨부 정보 */
export type AttachmentPick = {
  path: string;
  name: string;
  size: number;
  mime: string;
  kind: AttachmentKind;
};

/** 위 계층(페이지 화면)이 주는 첨부 동작. 실패 안내는 구현 쪽이 하고, 실패는 null·거절로 돌려준다 */
export type AttachmentSource = {
  /** 경로 → 웹뷰가 읽을 주소. 파일이 없으면 거절한다 (누락 상태 판정에 쓴다) */
  resolve: (path: string) => Promise<string>;
  /** 고르기 대화상자 → 첨부. 취소하거나 실패하면 null */
  pick: (kind: AttachmentPickKind) => Promise<AttachmentPick | null>;
  /** 끌어 놓기·붙여 넣기로 받은 파일 → 첨부. 실패하면 null */
  importFile: (file: File) => Promise<AttachmentPick | null>;
  /** 기본 앱으로 열기 */
  open: (path: string) => void;
  /** Finder·탐색기에서 보기 */
  reveal: (path: string) => void;
  /** 다른 이름으로 저장 */
  saveAs: (path: string) => void;
};

const AttachmentContext = React.createContext<AttachmentSource | null>(null);
/** 첨부 저장소. 없으면 노드는 파일 카드로만 그린다(인쇄·미리 보기) */
export const AttachmentProvider = AttachmentContext.Provider;

/** 종류 → 고르기 종류 (바꾸기 대화상자가 같은 종류만 보이게) */
export function pickKindFor(kind: AttachmentKind): AttachmentPickKind {
  if (kind === "pdf") return "pdf";
  if (kind === "video" || kind === "audio") return "media";
  return "file";
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    attachment: {
      /** 자리(없으면 선택 위치)에 첨부 블록을 넣는다. 빈 문단이면 그 문단을 바꾼다 */
      insertAttachment: (
        attrs: Partial<AttachmentPick> & { caption?: string },
        at?: number,
      ) => ReturnType;
    };
  }
}

type AttachmentBlockOptions = {
  /** 끌어 놓기·붙여 넣기 파일을 저장한다(이미지가 아닌 파일). 없어도 파일은 기본 동작을 막는다 */
  importFile: ((file: File) => Promise<AttachmentPick | null>) | null;
};

/** 이미지가 아닌 파일 (붙여 넣기·끌어 놓기) */
function otherFiles(data: DataTransfer | null): File[] {
  return [...(data?.files ?? [])].filter((f) => !f.type.startsWith("image/"));
}

/** 파일을 차례로 저장해 pos부터 넣는다. 실패한 파일은 건너뛴다(알림은 저장 쪽이 한다) */
async function insertFiles(
  editor: Editor,
  files: File[],
  pos: number,
  importFile: NonNullable<AttachmentBlockOptions["importFile"]>,
) {
  let at = pos;
  for (const file of files) {
    const info = await importFile(file).catch(() => null);
    if (!info) continue;
    if (editor.isDestroyed) return;
    const before = editor.state.doc.content.size;
    editor.commands.insertAttachment(info, Math.min(at, before));
    at = Math.min(at, before) + (editor.state.doc.content.size - before);
  }
}

export const AttachmentBlock = Node.create<AttachmentBlockOptions>({
  name: "attachment",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { importFile: null };
  },

  addAttributes() {
    return {
      path: { default: "" },
      name: { default: "" },
      size: { default: 0 },
      mime: { default: "" },
      kind: { default: "file" },
      caption: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-attachment]",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          return {
            path: el.getAttribute("data-path") ?? "",
            name: el.getAttribute("data-name") ?? "",
            size: Number(el.getAttribute("data-size") ?? 0) || 0,
            mime: el.getAttribute("data-mime") ?? "",
            kind: el.getAttribute("data-kind") ?? "file",
            caption: el.getAttribute("data-caption") ?? "",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    // 본문 글자는 파일 이름 — 복사·인쇄에서도 이름이 남는다
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-attachment": "",
        "data-path": node.attrs.path,
        "data-name": node.attrs.name,
        "data-size": String(node.attrs.size ?? 0),
        "data-mime": node.attrs.mime,
        "data-kind": node.attrs.kind,
        "data-caption": node.attrs.caption,
      }),
      String(node.attrs.name ?? ""),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentView);
  },

  addCommands() {
    return {
      insertAttachment:
        (attrs, at) =>
        ({ state, chain }) => {
          const node = { type: this.name, attrs };
          const { $from, empty } = state.selection;
          // 빈 문단이면 그 문단을 첨부로 바꾼다 (이미지와 같은 규칙)
          const replaceEmpty =
            at === undefined &&
            empty &&
            $from.parent.type.name === "paragraph" &&
            !$from.parent.content.size;
          const target =
            at ??
            (replaceEmpty ? { from: $from.before(), to: $from.after() } : state.selection.from);
          return chain()
            .insertContentAt(target, node)
            .command(({ tr, state: next }) => {
              // 맨 끝에 넣었으면 그 뒤에 글을 쓸 문단을 둔다
              if (next.doc.lastChild?.type.name !== "paragraph") {
                tr.insert(next.doc.content.size, next.schema.nodes.paragraph!.create());
              }
              return true;
            })
            .run();
        },
    };
  },

  addProseMirrorPlugins() {
    const importFile = this.options.importFile;
    if (!importFile) return [];
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("attachmentFiles"),
        props: {
          handlePaste(view: EditorView, event: ClipboardEvent) {
            const files = otherFiles(event.clipboardData);
            if (!files.length) return false;
            event.preventDefault();
            void insertFiles(editor, files, view.state.selection.from, importFile);
            return true;
          },
          handleDrop(view: EditorView, event: DragEvent, _slice, moved) {
            if (moved) return false;
            const files = otherFiles(event.dataTransfer);
            if (!files.length) return false;
            event.preventDefault();
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
            void insertFiles(editor, files, at?.pos ?? view.state.selection.from, importFile);
            return true;
          },
        },
      }),
    ];
  },
});

/** 노드 뷰: 원본을 확인하고(누락 판정) 종류에 맞는 블록을 그린다 */
function AttachmentView({
  node,
  editor,
  selected,
  updateAttributes,
  deleteNode,
}: ReactNodeViewProps) {
  const source = React.useContext(AttachmentContext);
  const path = String(node.attrs.path ?? "");
  const name = String(node.attrs.name ?? "");
  const size = Number(node.attrs.size ?? 0) || undefined;
  const mime = String(node.attrs.mime ?? "");
  const caption = String(node.attrs.caption ?? "");
  const kind = (node.attrs.kind as AttachmentKind) ?? "file";
  const editable = editor.isEditable;

  // 경로마다 한 번 확인한다. 옛 결과는 경로가 바뀌면 무시한다
  const [resolved, setResolved] = React.useState<
    { path: string; src: string } | { path: string; missing: true } | null
  >(null);
  React.useEffect(() => {
    if (!source) return;
    let alive = true;
    source.resolve(path).then(
      (src) => alive && setResolved({ path, src }),
      () => alive && setResolved({ path, missing: true }),
    );
    return () => {
      alive = false;
    };
  }, [source, path]);

  const current = source && resolved?.path === path ? resolved : null;
  const missing = current !== null && "missing" in current;
  const src = current && "src" in current ? current.src : undefined;
  const present = !!source && !missing;

  const replace = async () => {
    const info = await source?.pick(pickKindFor(kind));
    if (!info) return;
    updateAttributes({
      path: info.path,
      name: info.name,
      size: info.size,
      mime: info.mime,
      kind: info.kind,
    });
  };

  const actions: AttachmentActions = {
    onOpen: present ? () => source?.open(path) : undefined,
    onReveal: present ? () => source?.reveal(path) : undefined,
    onDownload: present ? () => source?.saveAs(path) : undefined,
    onReplace: editable && source ? () => void replace() : undefined,
    onRemove: editable ? () => deleteNode() : undefined,
  };

  let body: React.ReactNode;
  if (kind === "pdf" && src && !missing) {
    body = (
      <PdfViewer
        name={name}
        src={src}
        size={size}
        selected={selected}
        editable={editable}
        {...actions}
      />
    );
  } else if ((kind === "video" || kind === "audio") && src && !missing) {
    body = (
      <MediaPlayer
        kind={kind}
        name={name}
        src={src}
        size={size}
        mime={mime}
        caption={caption || undefined}
        selected={selected}
        editable={editable}
        {...actions}
      />
    );
  } else {
    body = (
      <FileAttachment
        name={name}
        size={size}
        mime={mime}
        kind={kind}
        missing={missing}
        selected={selected}
        editable={editable}
        {...actions}
      />
    );
  }

  return (
    <NodeViewWrapper data-type="attachment-view" data-kind={kind} className="py-1">
      {body}
    </NodeViewWrapper>
  );
}
