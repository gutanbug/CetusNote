import type { Editor, JSONContent, Range } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import "katex/dist/katex.min.css";
import * as React from "react";
import { cn } from "@/lib/utils";
import { BlockHandle } from "./block-handle";
import "./editor.css";
import { createExtensions } from "./extensions";
import { FloatingToolbar } from "./floating-toolbar";
import { ImageProvider, type ImageSource } from "./image";
import { CaretPopup } from "./caret-popup";
import { MathPopover, type MathEditTarget } from "./math-popover";
import { MentionMenu, mentionOptionId } from "./mention-menu";
import {
  insertMention,
  MentionProvider,
  type MentionSource,
  type MentionTarget,
} from "./page-mention";
import { SlashLayer } from "./slash-layer";
import type { SlashItem } from "./slash-items";
import { TableMenu } from "./table-menu";

export type NoteEditorProps = {
  /** Tiptap JSON(저장 형식) 또는 HTML(견본·붙여넣기용) */
  content?: JSONContent | string;
  /** 내용이 바뀔 때마다 Tiptap JSON을 넘긴다. 저장은 위 계층이 맡는다. */
  onChange?: (json: JSONContent) => void;
  editable?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** 본문 영역의 접근성 이름 */
  label?: string;
  /** 링크 열기(외부 브라우저). 위 계층이 준다 */
  onOpenLink?: (href: string) => void;
  /** 페이지 멘션(ED-PageMention) — 찾기·제목 읽기·열기. 없으면 `@` 제안이 꺼지고 칩은 깨진 링크로 보인다 */
  mentions?: MentionSource;
  /** 이미지(ED-Image) — 읽기·저장·고르기. 없으면 이미지는 오류 상태로 보이고 붙여넣기·`/이미지`는 꺼진다 */
  images?: ImageSource;
  /** 맞춤법 검사 밑줄 (SET-04, 기본 켬) */
  spellCheck?: boolean;
  /** 완료한 체크 항목을 회색 + 취소선으로 (SET-04, 기본 켬) */
  dimChecked?: boolean;
  /** 여러 블록을 복사할 때 다른 앱용 글자(마크다운)로 바꾸는 함수 (EDIT-26). 없으면 블록 글자만 */
  copyAsText?: (doc: JSONContent) => string;
  /** 에디터가 만들어지면(또는 사라지면 null) 알린다 — 위 계층의 찾기 막대(ED-FindBar) 등이 쓴다 */
  onEditor?: (editor: Editor | null) => void;
  className?: string;
};

function proseAttributes(label: string, spellCheck: boolean, dimChecked: boolean) {
  return {
    class: "sn-prose",
    role: "textbox",
    "aria-multiline": "true",
    "aria-label": label,
    spellcheck: spellCheck ? "true" : "false",
    "data-dim-checked": dimChecked ? "true" : "false",
  };
}

/**
 * ED-Editor — 노트 본문 에디터. props만 받는 순수 UI다(저장·Tauri 모름).
 * 본문 스타일은 editor.css의 `.sn-prose`. 편집 중에는 슬래시 메뉴 · 서식 바 · 블록 핸들이 붙는다.
 */
export function NoteEditor({
  content,
  onChange,
  editable = true,
  placeholder,
  autoFocus = false,
  label = "본문",
  onOpenLink,
  mentions,
  images,
  spellCheck = true,
  dimChecked = true,
  onEditor,
  copyAsText,
  className,
}: NoteEditorProps) {
  // 플러그인은 처음 받은 함수를 계속 쓰므로 최신 함수는 바깥 상자에서 읽는다
  const [liveCopy] = React.useState(() => latest(copyAsText));
  React.useLayoutEffect(() => liveCopy.set(copyAsText), [liveCopy, copyAsText]);
  const [mathTarget, setMathTarget] = React.useState<MathEditTarget>(null);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editorRef = React.useRef<Editor | null>(null);
  const [liveImages] = React.useState(() => latest(images));
  React.useLayoutEffect(() => liveImages.set(images), [liveImages, images]);
  /** 고르기 대화상자 → 지금 자리에 넣기 (취소·실패면 그대로) */
  const pickImage = async () => {
    const src = await liveImages
      .get()
      ?.pick()
      .catch(() => null);
    const e = editorRef.current;
    if (src && e && !e.isDestroyed) e.chain().focus().insertImage(src).run();
  };
  const slash = useSuggestMenu<SlashItem>((item, range) => {
    const e = editorRef.current;
    if (e)
      item.run(e, range, {
        editBlockMath: (pos) => setMathTarget({ kind: "block", pos, latex: "" }),
        pickImage: liveImages.get() ? () => void pickImage() : undefined,
      });
  });
  const mention = useSuggestMenu<MentionTarget>((item, range) => {
    const e = editorRef.current;
    if (e) insertMention(e, range, item);
  });
  // 플러그인은 처음 받은 함수를 계속 쓰므로 최신 mentions는 바깥 상자에서 읽는다
  const [liveMentions] = React.useState(() => latest(mentions));
  React.useLayoutEffect(() => liveMentions.set(mentions), [liveMentions, mentions]);

  const editor = useEditor({
    extensions: createExtensions({
      placeholder,
      onMathClick: (kind, node, pos) => setMathTarget({ kind, pos, latex: node.attrs.latex ?? "" }),
      slash: slash.callbacks,
      mention: {
        callbacks: mention.callbacks,
        search: (q) => liveMentions.get()?.search(q) ?? [],
        resolve: (id) => liveMentions.get()?.resolve(id) ?? null,
        open: (id) => liveMentions.get()?.onOpen(id),
      },
      upload: images
        ? (file) =>
            liveImages.get()?.upload(file) ?? Promise.reject(new Error("이미지 저장소 없음"))
        : undefined,
      copyAsText: copyAsText ? (doc) => liveCopy.get()?.(doc) ?? "" : undefined,
      fetchImage: images?.fetch
        ? (url) => liveImages.get()?.fetch?.(url) ?? Promise.reject(new Error("이미지 저장소 없음"))
        : undefined,
    }),
    content,
    editable,
    autofocus: autoFocus ? "end" : false,
    editorProps: { attributes: proseAttributes(label, spellCheck, dimChecked) },
    onUpdate: ({ editor: e }) => onChangeRef.current?.(e.getJSON()),
  });
  React.useLayoutEffect(() => {
    editorRef.current = editor;
  }, [editor]);
  const onEditorRef = React.useRef(onEditor);
  React.useLayoutEffect(() => {
    onEditorRef.current = onEditor;
  }, [onEditor]);
  React.useEffect(() => {
    onEditorRef.current?.(editor);
    return () => onEditorRef.current?.(null);
  }, [editor]);
  // 설정이 바뀌면 열린 에디터에도 바로 반영한다(다시 만들지 않는다)
  React.useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: proseAttributes(label, spellCheck, dimChecked),
      },
    });
  }, [editor, label, spellCheck, dimChecked]);
  const mentionListId = React.useId().replace(/:/g, "") + "-mention";

  React.useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;
  return (
    <div data-slot="note-editor" className={cn("relative", className)}>
      <MentionProvider value={mentions ?? null}>
        <ImageProvider value={images?.load ?? null}>
          <EditorContent editor={editor} />
        </ImageProvider>
      </MentionProvider>
      <TableMenu editor={editor} />
      {editable ? (
        <>
          <FloatingToolbar editor={editor} onOpenLink={onOpenLink} />
          <BlockHandle editor={editor} />
          <SlashLayer
            editor={editor}
            state={slash.state}
            activeIndex={slash.active}
            onActiveChange={slash.setActive}
            onSelect={slash.select}
          />
          {mention.state && mentions ? (
            <CaretPopup
              editor={editor}
              clientRect={mention.state.clientRect}
              listId={mentionListId}
              activeOptionId={
                mention.state.items[mention.active]
                  ? mentionOptionId(mentionListId, mention.state.items[mention.active]!)
                  : undefined
              }
            >
              <MentionMenu
                id={mentionListId}
                items={mention.state.items}
                query={mention.state.query}
                activeIndex={mention.active}
                onActiveChange={mention.setActive}
                onSelect={mention.select}
              />
            </CaretPopup>
          ) : null}
          <MathPopover editor={editor} target={mathTarget} onClose={() => setMathTarget(null)} />
        </>
      ) : null}
    </div>
  );
}

/** 렌더 밖(플러그인 콜백)에서 최신 값을 읽는 상자 */
function latest<T>(initial: T) {
  let value = initial;
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
    },
  };
}

type SuggestState<T> = {
  query: string;
  items: T[];
  range: Range;
  clientRect: () => DOMRect | null;
};

/**
 * 제안 목록 상태(슬래시 메뉴 · 멘션) — Suggestion 플러그인(콜백)과 React 상태를 잇는다.
 * 방향키로 고르고 Enter·Tab으로 넣는다.
 */
function useSuggestMenu<T>(run: (item: T, range: Range) => void) {
  const [state, setState] = React.useState<SuggestState<T> | null>(null);
  const [active, setActive] = React.useState(0);
  const live = React.useRef({ state, active, run });
  React.useLayoutEffect(() => {
    live.current = { state, active, run };
  });

  const select = React.useCallback((item: T) => {
    const st = live.current.state;
    if (st) live.current.run(item, st.range);
  }, []);

  // 플러그인은 처음 만든 콜백을 계속 쓰므로 한 번만 만들고 ref로 최신 상태를 본다
  const callbacks = React.useMemo(
    () => ({
      onChange: (next: SuggestState<T> | null) => {
        setState((prev) => {
          if (!next || prev?.query !== next.query) setActive(0);
          return next;
        });
      },
      onKeyDown: (event: KeyboardEvent) => {
        const { state: st, active: i } = live.current;
        if (!st) return false;
        const n = st.items.length;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          if (n) setActive((i + (event.key === "ArrowDown" ? 1 : n - 1)) % n);
          return true;
        }
        if ((event.key === "Enter" || event.key === "Tab") && n) {
          select(st.items[Math.min(i, n - 1)]!);
          return true;
        }
        return false;
      },
    }),
    [select],
  );

  return { state, active, setActive, select, callbacks };
}
