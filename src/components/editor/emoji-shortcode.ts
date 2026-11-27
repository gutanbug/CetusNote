import type { EditorState } from "@tiptap/pm/state";
import type { Range } from "@tiptap/core";
import { EmojiSuggestionPluginKey } from "./emoji-node";
import { prefetchEmojiTable } from "@/lib/emoji/table";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { matchShortcodes, type ShortcodeItem } from "@/lib/emoji/shortcodes";

/**
 * ED-EmojiInline의 `:` 단축 코드 제안 (EDIT-35). Tiptap Emoji 확장의 suggestion 자리에 끼운다.
 * EDIT-19의 `:smile:` 자동 변환(입력 규칙)은 그대로 두고, 이 제안은 입력 중에 목록을 보여 줄 뿐이다.
 */

export type EmojiShortcodeState = {
  query: string;
  items: ShortcodeItem[];
  range: Range;
  clientRect: () => DOMRect | null;
};

export type EmojiShortcodeCallbacks = {
  /** 열림·검색어 변경(목록이 비면 null)·닫힘 */
  onChange: (state: EmojiShortcodeState | null) => void;
  /** 방향키·Enter·Tab·Esc. 처리했으면 true */
  onKeyDown: (event: KeyboardEvent) => boolean;
};

/** 이름이 이 글자 수 이상이어야 목록을 연다 (`:s` 한 글자에는 열지 않는다) */
export const SHORTCODE_MIN_QUERY = 2;

/**
 * 열어도 되는 자리인지. 코드(블록·글자 서식)와 링크 글자 안에서는 열지 않는다.
 * 줄 처음·공백 뒤라는 조건은 Suggestion의 allowedPrefixes([" "])가 맡는다.
 */
export function shortcodeTriggerAllowed(state: EditorState, range: Range): boolean {
  if (state.doc.resolve(range.from).parent.type.spec.code) return false;
  const marks = [
    ...(state.doc.nodeAt(range.from)?.marks ?? []),
    ...(state.doc.nodeAt(Math.max(range.from, range.to - 1))?.marks ?? []),
  ];
  return !marks.some((m) => m.type.name === "code" || m.type.name === "link");
}

/** 검색어(콜론 제외)로 후보를 고른다. 짧거나 허용하지 않는 글자가 섞이면 빈 목록 */
export function shortcodeItems(query: string): ShortcodeItem[] {
  return query.length >= SHORTCODE_MIN_QUERY ? matchShortcodes(query) : [];
}

/** Tiptap Emoji의 suggestion 옵션. `command`는 `:이름`을 이모지 글자로 바꾼다 */
export function emojiShortcodeSuggestion(
  callbacks: EmojiShortcodeCallbacks,
): Partial<Omit<SuggestionOptions<ShortcodeItem>, "editor">> {
  const push = (p: {
    query: string;
    items: ShortcodeItem[];
    range: Range;
    clientRect?: (() => DOMRect | null) | null;
  }) => {
    if (!p.items.length) return callbacks.onChange(null);
    callbacks.onChange({
      query: p.query,
      items: p.items,
      range: p.range,
      clientRect: p.clientRect ?? (() => null),
    });
  };
  return {
    char: ":",
    pluginKey: EmojiSuggestionPluginKey,
    // 줄 처음이나 공백 뒤에서만 연다 (startOfLine은 줄 처음만 허용하므로 쓰지 않는다 — 슬래시 메뉴와 같은 방식)
    allowedPrefixes: [" "],
    allow: ({ state, range }) => shortcodeTriggerAllowed(state, range),
    items: ({ query }) => {
      // `:` 목록을 열면 전체 이모지 표를 미리 가져온다 (SYS-11)
      prefetchEmojiTable();
      return shortcodeItems(query);
    },
    command: ({ editor, range, props }) => {
      editor.chain().focus().insertContentAt(range, props.emoji).run();
    },
    render: () => ({
      onStart: push,
      onUpdate: push,
      onKeyDown: ({ event }) => callbacks.onKeyDown(event),
      onExit: () => callbacks.onChange(null),
    }),
  };
}
