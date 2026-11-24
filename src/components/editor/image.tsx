import { mergeAttributes, Node, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { ImageOff } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { isFetchableImage, remoteImagesPlugin } from "./remote-images";

/** 위 계층이 주는 이미지 다루기 (저장·읽기는 에디터가 모른다) */
export type ImageSource = {
  /** 저장된 경로(`assets/…`) → 그릴 주소(blob URL 등). 실패하면 거절 */
  load: (src: string) => Promise<string>;
  /** 붙여넣거나 끌어 놓은 파일을 저장하고 경로를 돌려준다. 실패 알림은 부르는 쪽이 한다 */
  upload: (file: File) => Promise<string>;
  /** 이미지 고르기 대화상자 → 경로. 취소하면 null */
  pick: () => Promise<string | null>;
  /** 웹 이미지 주소를 내려받아 저장하고 경로를 돌려준다(붙여 넣은 웹 글의 이미지). 없으면 링크로 남긴다 */
  fetch?: (url: string) => Promise<string>;
};

const ImageContext = React.createContext<ImageSource["load"] | null>(null);
export const ImageProvider = ImageContext.Provider;

/** 너비(본문 폭 대비 %) */
export const IMAGE_MIN_WIDTH = 10;
const STEP = 5;
const clampWidth = (w: unknown) =>
  Math.round(Math.min(100, Math.max(IMAGE_MIN_WIDTH, Number(w) || 100)));

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    image: {
      /** 지금 자리에 이미지 블록을 넣는다(빈 문단이면 그 자리를 바꾼다) */
      insertImage: (src: string, at?: number) => ReturnType;
    };
  }
}

/** 클립보드·끌어 놓기의 이미지 파일 */
function imageFiles(data: DataTransfer | null): File[] {
  return [...(data?.files ?? [])].filter((f) => f.type.startsWith("image/"));
}

/** 파일을 차례로 저장해 pos부터 넣는다. 실패한 파일은 건너뛴다(알림은 upload가) */
async function insertFiles(
  editor: Editor,
  files: File[],
  pos: number,
  upload: ImageSource["upload"],
) {
  let at = pos;
  for (const file of files) {
    let src: string;
    try {
      src = await upload(file);
    } catch {
      continue;
    }
    if (editor.isDestroyed) return;
    const before = editor.state.doc.content.size;
    editor.commands.insertImage(src, Math.min(at, before));
    at = Math.min(at, before) + (editor.state.doc.content.size - before);
  }
}

/** 손잡이 잡는 자리(이미지 높이 전체, 16px 폭)와 그 안의 막대 */
const handle = cn(
  "absolute inset-y-0 z-10 flex w-4 cursor-ew-resize touch-none items-center justify-center outline-none",
  "transition-opacity duration-(--dur)",
);
const grip = "h-12 max-h-3/5 w-1.5 rounded-pill border border-line-strong bg-elevated";

function ImageView({ node, updateAttributes, editor, selected, getPos }: ReactNodeViewProps) {
  const load = React.useContext(ImageContext);
  const src = node.attrs.src as string | null;
  // 붙여 넣은 웹 이미지를 아직 내려받는 중 (remote-images.ts)
  const fetching = !src && !!node.attrs.remote;
  const width = clampWidth(node.attrs.width);
  const [loaded, setLoaded] = React.useState<{ src: string; url?: string; failed?: boolean }>();
  const [dragWidth, setDragWidth] = React.useState<number>();
  const figureRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!src || !load) return;
    let alive = true;
    load(src).then(
      (url) => alive && setLoaded({ src, url }),
      () => alive && setLoaded({ src, failed: true }),
    );
    return () => {
      alive = false;
    };
  }, [src, load]);

  const status = fetching
    ? "loading"
    : !src || !load
      ? "error"
      : loaded?.src !== src
        ? "loading"
        : loaded.failed
          ? "error"
          : "ready";
  const caption = node.textContent;
  // 캐럿이 캡션 안에 있는지 — 빈 캡션은 이때와 이미지를 골랐을 때만 보인다
  // 선택이 바뀔 때만 확인한다. useEditorState는 트랜잭션마다 모든 이미지에서 돌아서 이미지가 많으면 입력이 느려진다 (SYS-11)
  const [captionActive, setCaptionActive] = React.useState(false);
  const captionRef = React.useRef(false);
  React.useEffect(() => {
    const check = () => {
      const pos = getPos();
      const { from, to } = editor.state.selection;
      const next = typeof pos === "number" && from > pos && to < pos + node.nodeSize;
      if (next === captionRef.current) return;
      captionRef.current = next;
      setCaptionActive(next);
    };
    check();
    editor.on("selectionUpdate", check);
    return () => {
      editor.off("selectionUpdate", check);
    };
  }, [editor, getPos, node.nodeSize]);
  const showCaption = Boolean(caption) || captionActive || (selected && editor.isEditable);
  const shown = dragWidth ?? width;

  const select = () => {
    const pos = getPos();
    if (typeof pos === "number") editor.commands.setNodeSelection(pos);
  };

  /** side: 끄는 손잡이 — 왼쪽 손잡이는 왼쪽으로 끌 때 넓어진다 */
  const startResize = (e: React.PointerEvent<HTMLDivElement>, side: 1 | -1) => {
    const figure = figureRef.current;
    const box = figure?.parentElement?.parentElement; // 래퍼 → 본문 폭
    if (!figure || !box || e.button !== 0) return;
    e.preventDefault(); // 글 선택이 시작되지 않게 — 대신 포커스는 직접 준다
    figure.querySelector<HTMLElement>("[role=slider]")?.focus();
    const startX = e.clientX;
    const startPx = figure.getBoundingClientRect().width;
    const full = box.getBoundingClientRect().width;
    let next = width;
    const move = (ev: PointerEvent) => {
      // 가운데 정렬이라 한쪽을 끌면 양쪽이 같이 늘어난다
      next = clampWidth(((startPx + (ev.clientX - startX) * 2 * side) / full) * 100);
      setDragWidth(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragWidth(undefined);
      if (next !== width) updateAttributes({ width: next });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleShown = cn(
    "opacity-0 group-hover/img:opacity-100 force-hover:opacity-100",
    (selected || dragWidth !== undefined) && "opacity-100",
  );

  const resizeKey = (e: React.KeyboardEvent) => {
    // 키를 빠르게 이어 누르면 렌더 전이라 props가 옛 값 — 문서에서 지금 너비를 읽는다
    const pos = getPos();
    const now =
      typeof pos === "number" ? clampWidth(editor.state.doc.nodeAt(pos)?.attrs.width) : width;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? now + STEP
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? now - STEP
          : e.key === "Home"
            ? IMAGE_MIN_WIDTH
            : e.key === "End"
              ? 100
              : null;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    updateAttributes({ width: clampWidth(next) });
  };

  return (
    <NodeViewWrapper data-type="image" className="sn-image">
      <figure
        ref={figureRef}
        className="relative mx-auto grid gap-2"
        style={{ width: `${shown}%` }}
        data-status={status}
      >
        <div
          contentEditable={false}
          onMouseDown={(e) => {
            if (e.button !== 0 || (e.target as HTMLElement).closest("[data-resize]")) return;
            e.preventDefault();
            select();
          }}
          className={cn(
            "group/img relative rounded-lg",
            selected && "outline-2 outline-offset-2 outline-accent outline-solid",
          )}
        >
          {status === "ready" ? (
            <img
              src={loaded!.url}
              alt={caption}
              draggable={false}
              onError={() => src && setLoaded({ src, failed: true })}
              className="block h-auto w-full rounded-lg"
            />
          ) : status === "loading" ? (
            <div
              role="img"
              aria-busy="true"
              aria-label={fetching ? "이미지를 가져오는 중" : "이미지를 불러오는 중"}
              className="aspect-video w-full rounded-lg bg-subtle"
            />
          ) : (
            <div
              role="img"
              aria-label="이미지를 불러오지 못했어요"
              className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-line bg-subtle text-caption text-tertiary"
            >
              <ImageOff className="size-5" strokeWidth={1.5} aria-hidden />
              이미지를 불러오지 못했어요
            </div>
          )}
          {editor.isEditable ? (
            <>
              {/* 너비 손잡이 — 이미지 안 양쪽 가장자리. 올리거나 고르면 보인다. 키보드는 오른쪽 손잡이(slider)로 */}
              <div
                data-resize=""
                aria-hidden
                onPointerDown={(e) => startResize(e, -1)}
                className={cn(handle, "left-0", handleShown)}
              >
                <span className={grip} />
              </div>
              <div
                data-resize=""
                role="slider"
                tabIndex={0}
                aria-label="이미지 너비"
                aria-valuemin={IMAGE_MIN_WIDTH}
                aria-valuemax={100}
                aria-valuenow={shown}
                aria-valuetext={`${shown}%`}
                aria-orientation="horizontal"
                onPointerDown={(e) => startResize(e, 1)}
                onKeyDown={resizeKey}
                className={cn(
                  handle,
                  "right-0",
                  handleShown,
                  "focus-visible:opacity-100 [&:focus-visible>span]:outline-2 [&:focus-visible>span]:outline-offset-2 [&:focus-visible>span]:outline-accent [&:focus-visible>span]:outline-solid",
                )}
              >
                <span className={grip} />
              </div>
              {dragWidth !== undefined ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-2 right-2 rounded-pill bg-elevated px-2 py-0.5 text-label text-secondary tabular-nums"
                >
                  {dragWidth}%
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        <div className={cn("relative", !showCaption && "hidden")}>
          {!caption && editor.isEditable ? (
            <span
              contentEditable={false}
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 text-center text-caption text-tertiary select-none"
            >
              캡션 추가
            </span>
          ) : null}
          {/* 캡션은 이미지 아래 가운데 */}
          <NodeViewContent<"figcaption">
            as="figcaption"
            className="text-center text-caption text-secondary"
          />
        </div>
      </figure>
    </NodeViewWrapper>
  );
}

/**
 * ED-Image — 이미지 블록 + 캡션 (프로토타입 `.imgblock`). 캡션은 이 노드의 글(서식 없음)이다.
 * 경로(`assets/…`)만 저장하고, 그릴 주소는 ImageProvider의 load로 얻는다.
 * 붙여넣기·끌어 놓기한 이미지 파일은 options.upload로 저장한 뒤 넣는다.
 */
/**
 * 이미지 바로 아래 문단의 맨 앞에서 Backspace: 문단을 캡션 끝에 합친다.
 * 글만 든 문단은 텍스트를 옮기고 문단을 지운다. 서식·멘션 같은 노드가 있는 문단은 지우지 않고 캡션 끝으로 캐럿만 옮긴다.
 */
function joinIntoCaption(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  const para = $from.parent;
  if (para.type.name !== "paragraph") return false;
  const before = $from.before();
  const image = editor.state.doc.resolve(before).nodeBefore;
  if (!image || image.type.name !== "image") return false;
  const captionEnd = before - 1;
  let plain = true;
  para.forEach((n) => {
    if (!n.isText || n.marks.length) plain = false;
  });
  const text = para.textContent;
  return editor.commands.command(({ tr }) => {
    if (plain) {
      tr.delete(before, $from.after());
      if (text) tr.insertText(text, captionEnd);
    }
    tr.setSelection(TextSelection.create(tr.doc, captionEnd));
    return true;
  });
}

export const ImageBlock = Node.create<{
  upload: ImageSource["upload"] | null;
  fetch: ImageSource["fetch"] | null;
}>({
  name: "image",
  // 캡션의 Enter·Backspace가 기본 키맵(문단 나누기·합치기)보다 먼저 오게
  priority: 1000,
  group: "block",
  content: "text*",
  marks: "",
  draggable: true,
  isolating: true,
  defining: true,

  addOptions() {
    return { upload: null, fetch: null };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-src"),
        renderHTML: (a) => (a.src ? { "data-src": a.src } : {}),
      },
      width: {
        default: 100,
        parseHTML: (el) => clampWidth(el.getAttribute("data-width")),
        renderHTML: (a) => ({ "data-width": clampWidth(a.width) }),
      },
      // 붙여 넣은 웹 이미지의 원래 주소 — 내려받으면 지운다(remote-images.ts)
      remote: {
        default: null,
        parseHTML: (el) => {
          const url = el.getAttribute("data-remote");
          return isFetchableImage(url) ? url : null;
        },
        renderHTML: (a) => (a.remote ? { "data-remote": a.remote } : {}),
      },
    };
  },

  // 바깥 HTML의 <img>는 직접 받지 않는다 — 붙여넣기 때 figure[data-remote]로 바꿔 내려받는다(remote-images.ts)
  parseHTML() {
    return [{ tag: 'figure[data-type="image"]', contentElement: "figcaption" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes({ "data-type": "image" }, HTMLAttributes), ["figcaption", 0]];
  },

  renderText({ node }) {
    return node.textContent;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView, {
      // 너비 손잡이의 키·포인터는 에디터가 아니라 손잡이가 받는다
      stopEvent: ({ event }) =>
        event.target instanceof Element && event.target.closest("[data-resize]") !== null,
    });
  },

  addCommands() {
    return {
      insertImage:
        (src, at) =>
        ({ state, chain }) => {
          const image = { type: this.name, attrs: { src } };
          if (at !== undefined) return chain().insertContentAt(at, image).run();
          const { $from, empty } = state.selection;
          // 빈 문단이면 그 문단을 이미지로 바꾼다
          if (empty && $from.parent.type.name === "paragraph" && !$from.parent.content.size)
            return chain()
              .insertContentAt({ from: $from.before(), to: $from.after() }, image)
              .run();
          return chain().insertContent(image).run();
        },
    };
  },

  addKeyboardShortcuts() {
    const inCaption = (editor: Editor) =>
      editor.state.selection.$from.parent.type.name === this.name;
    return {
      // 캡션에서 Enter: 이미지 아래에 새 문단
      Enter: ({ editor }) => {
        if (!inCaption(editor)) return false;
        const after = editor.state.selection.$from.after();
        return editor
          .chain()
          .insertContentAt(after, { type: "paragraph" })
          .setTextSelection(after + 1)
          .run();
      },
      // Backspace가 문단 맨 앞에서 눌리면: 캡션 맨 앞이면 이미지를 고르고(한 번 더 누르면 지운다),
      // 이미지 바로 아래 문단이면 캡션 끝으로 합친다(줄바꿈 제거). 나머지는 기본 키맵에 맡긴다.
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parentOffset > 0) return false;
        if (inCaption(editor)) return editor.commands.setNodeSelection($from.before());
        return joinIntoCaption(editor);
      },
    };
  },

  addProseMirrorPlugins() {
    const { upload, fetch } = this.options;
    const editor = this.editor;
    const remote = remoteImagesPlugin({ fetch: fetch ?? null, upload: upload ?? null });
    if (!upload) return [remote];
    return [
      remote,
      new Plugin({
        key: new PluginKey("imageFiles"),
        props: {
          handlePaste(view: EditorView, event: ClipboardEvent) {
            const files = imageFiles(event.clipboardData);
            if (!files.length) return false;
            event.preventDefault();
            void insertFiles(editor, files, view.state.selection.from, upload);
            return true;
          },
          handleDrop(view: EditorView, event: DragEvent, _slice, moved) {
            if (moved) return false;
            const files = imageFiles(event.dataTransfer);
            if (!files.length) return false;
            event.preventDefault();
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
            void insertFiles(editor, files, at?.pos ?? view.state.selection.from, upload);
            return true;
          },
        },
      }),
    ];
  },
});
