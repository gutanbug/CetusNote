import type { Editor, JSONContent, Range } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { BlockHandle } from "./block-handle";
import { BreadcrumbProvider, type BreadcrumbSource } from "./breadcrumb-block";
import "./editor.css";
import { createExtensions } from "./extensions";
import { FloatingToolbar } from "./floating-toolbar";
import { ImageProvider, type ImageSource } from "./image";
import { AttachmentProvider, type AttachmentPickKind, type AttachmentSource } from "./attachment";
import { EmojiInlinePopover, EmojiShortcodeMenu } from "./emoji-inline";
import type { ShortcodeItem } from "@/lib/emoji/shortcodes";
import type { PickedEmoji } from "@/components/ui/emoji-picker";
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
import { SubpageProvider, type SubpageSource } from "./subpage-block";
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
  /** 파일 첨부(EDIT-31~33) — 고르기·끌어 놓기 저장·열기. 없으면 첨부는 파일 카드로만 보이고 슬래시 「파일」 등이 아무것도 넣지 않는다 */
  attachments?: AttachmentSource;
  /** 맞춤법 검사 밑줄 (SET-04, 기본 켬) */
  spellCheck?: boolean;
  /** 완료한 체크 항목을 회색 + 취소선으로 (SET-04, 기본 켬) */
  dimChecked?: boolean;
  /** 계산 줄(EDIT-38): 줄 끝 `=`에 결과를 보여 준다 */
  calc?: boolean;
  /** 계산 결과를 본문 오른쪽 끝에 맞춘다 (끄면 `=` 바로 뒤) */
  calcRight?: boolean;
  /** 여러 블록을 복사할 때 다른 앱용 글자(마크다운)로 바꾸는 함수 (EDIT-26). 없으면 블록 글자만 */
  copyAsText?: (doc: JSONContent) => string;
  /** 하위 페이지 블록(EDIT-29) — 제목·열기. 없으면 블록은 「삭제된 페이지」로 보인다 */
  subpages?: SubpageSource;
  /** 슬래시 「하위 페이지」: 새 하위 페이지를 만들고 id를 돌려준다. 없으면 항목이 아무것도 넣지 않는다 */
  createSubpage?: () => string | null;
  /** 경로 표시 블록(EDIT-30) — 이 노트 페이지의 경로 */
  breadcrumb?: BreadcrumbSource;
  /** 에디터가 만들어지면(또는 사라지면 null) 알린다 — 위 계층의 찾기 막대(ED-FindBar) 등이 쓴다 */
  onEditor?: (editor: Editor | null) => void;
  className?: string;
};

function proseAttributes(
  label: string,
  spellCheck: boolean,
  dimChecked: boolean,
  calc: boolean,
  calcRight: boolean,
) {
  return {
    class: "sn-prose",
    role: "textbox",
    "aria-multiline": "true",
    "aria-label": label,
    spellcheck: spellCheck ? "true" : "false",
    "data-dim-checked": dimChecked ? "true" : "false",
    "data-calc": calc ? "true" : "false",
    "data-calc-align": calcRight ? "right" : "inline",
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
  attachments,
  spellCheck = true,
  dimChecked = true,
  calc = true,
  calcRight = false,
  onEditor,
  copyAsText,
  subpages,
  createSubpage,
  breadcrumb,
  className,
}: NoteEditorProps) {
  const [liveSubpages] = React.useState(() => latest(subpages));
  React.useLayoutEffect(() => liveSubpages.set(subpages), [liveSubpages, subpages]);
  const [liveCreateSubpage] = React.useState(() => latest(createSubpage));
  React.useLayoutEffect(
    () => liveCreateSubpage.set(createSubpage),
    [liveCreateSubpage, createSubpage],
  );
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
  // 파일 첨부 — 저장소 최신값은 바깥 상자에서 읽는다 (플러그인은 처음 받은 값을 쓴다)
  const [liveAttachments] = React.useState(() => latest(attachments));
  React.useLayoutEffect(() => liveAttachments.set(attachments), [liveAttachments, attachments]);
  /** 고르기 대화상자 → 지금 자리에 첨부 블록 (취소·실패면 그대로) */
  const pickAttachmentInto = async (kind: AttachmentPickKind) => {
    const info = await liveAttachments.get()?.pick(kind);
    const e = editorRef.current;
    if (info && e && !e.isDestroyed) e.chain().focus().insertAttachment(info).run();
  };
  /** 이모지 피커를 연 자리 (EDIT-35). null이면 닫힘 */
  const [emojiAt, setEmojiAt] = React.useState<number | null>(null);
  const [emojiAnchor, setEmojiAnchor] = React.useState<{ x: number; y: number } | null>(null);
  const pickEmoji = () => {
    const e = editorRef.current;
    if (!e) return;
    const at = e.state.selection.from;
    const c = e.view.coordsAtPos(at);
    setEmojiAnchor({ x: c.left, y: c.bottom });
    setEmojiAt(at);
  };
  const insertEmoji = (picked: PickedEmoji) => {
    const e = editorRef.current;
    if (!e || e.isDestroyed || emojiAt === null) return;
    e.chain()
      .focus()
      .insertContentAt(emojiAt, picked.emoji)
      .setTextSelection(emojiAt + picked.emoji.length)
      .run();
  };
  const emojiListId = React.useId().replace(/:/g, "") + "-emoji";
  /** `:` 단축 코드 목록 (EDIT-35) — 고르면 `:이름`을 이모지로 바꾼다 */
  const emojiMenu = useSuggestMenu<ShortcodeItem>((item, range) => {
    const e = editorRef.current;
    if (e) e.chain().focus().insertContentAt(range, item.emoji).run();
  });
  const slash = useSuggestMenu<SlashItem>((item, range) => {
    const e = editorRef.current;
    if (e)
      item.run(e, range, {
        editBlockMath: (pos) => setMathTarget({ kind: "block", pos, latex: "" }),
        editInlineMath: (pos) => setMathTarget({ kind: "inline", pos, latex: "" }),
        pickImage: liveImages.get() ? () => void pickImage() : undefined,
        pickAttachment: liveAttachments.get() ? (kind) => void pickAttachmentInto(kind) : undefined,
        pickEmoji,
        createSubpage: createSubpage ? () => liveCreateSubpage.get()?.() ?? null : undefined,
        openSubpage: (id) => liveSubpages.get()?.onOpen(id, { newTab: false }),
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
    extensions: [
      ...createExtensions({
        placeholder,
        onMathClick: (kind, node, pos) =>
          setMathTarget({ kind, pos, latex: node.attrs.latex ?? "" }),
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
        attachments: {
          importFile: (file) => liveAttachments.get()?.importFile(file) ?? Promise.resolve(null),
        },
        emojiShortcode: emojiMenu.callbacks,
        fetchImage: images?.fetch
          ? (url) =>
              liveImages.get()?.fetch?.(url) ?? Promise.reject(new Error("이미지 저장소 없음"))
          : undefined,
      }),
    ],
    content,
    editable,
    autofocus: autoFocus ? "end" : false,
    editorProps: { attributes: proseAttributes(label, spellCheck, dimChecked, calc, calcRight) },
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
        attributes: proseAttributes(label, spellCheck, dimChecked, calc, calcRight),
      },
    });
  }, [editor, label, spellCheck, dimChecked, calc, calcRight]);
  const mentionListId = React.useId().replace(/:/g, "") + "-mention";

  React.useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;
  return (
    <div data-slot="note-editor" className={cn("relative", className)}>
      <MentionProvider value={mentions ?? null}>
        <ImageProvider value={images?.load ?? null}>
          <SubpageProvider value={subpages ?? null}>
            <BreadcrumbProvider value={breadcrumb ?? null}>
              <AttachmentProvider value={attachments ?? null}>
                <EditorContent editor={editor} />
              </AttachmentProvider>
            </BreadcrumbProvider>
          </SubpageProvider>
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
          {emojiAt !== null && emojiAnchor ? (
            <EmojiInlinePopover
              open
              onOpenChange={(open) => {
                if (!open) setEmojiAt(null);
              }}
              onSelect={insertEmoji}
              onCloseAutoFocus={(event) => {
                // 닫히면 포커스는 편집기로 돌아간다
                event.preventDefault();
                editorRef.current?.commands.focus();
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none fixed size-0"
                style={{ left: emojiAnchor.x, top: emojiAnchor.y }}
              />
            </EmojiInlinePopover>
          ) : null}
          {emojiMenu.state && emojiMenu.state.items.length ? (
            <CaretPopup
              editor={editor}
              clientRect={emojiMenu.state.clientRect}
              listId={emojiListId}
              activeOptionId={
                emojiMenu.state.items[emojiMenu.active]
                  ? `${emojiListId}-${emojiMenu.active}`
                  : undefined
              }
            >
              <EmojiShortcodeMenu
                id={emojiListId}
                items={emojiMenu.state.items}
                activeIndex={emojiMenu.active}
                onActiveChange={emojiMenu.setActive}
                onSelect={emojiMenu.select}
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
