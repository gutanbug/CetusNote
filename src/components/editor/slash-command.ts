import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { filterSlashItems, type SlashItem } from "./slash-items";

/** 메뉴가 열려 있는 동안의 상태. 없으면(null) 닫힘 */
export type SlashState = {
  query: string;
  items: SlashItem[];
  range: Range;
  /** 캐럿 위치 (메뉴를 띄울 기준) */
  clientRect: () => DOMRect | null;
};

export type SlashCallbacks = {
  /** 열림·검색어 변경·닫힘(null) */
  onChange: (state: SlashState | null) => void;
  /** 방향키·Enter·Tab·Esc. 처리했으면 true */
  onKeyDown: (event: KeyboardEvent) => boolean;
};

export const slashPluginKey = new PluginKey("slashCommand");

/**
 * ED-SlashMenu의 동작 — `/`를 입력하면 열린다(@tiptap/suggestion, MIT).
 * 그리는 일은 NoteEditor가 SlashMenu로 한다. 코드 블록 안에서는 열리지 않는다.
 */
export function slashCommand(callbacks: SlashCallbacks) {
  return Extension.create({
    name: "slashCommand",
    // 목록·체크리스트의 Enter·Tab 단축키보다 먼저 키를 받아야 메뉴에서 고를 수 있다
    priority: 1000,
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem, SlashItem>({
          editor: this.editor as Editor,
          pluginKey: slashPluginKey,
          char: "/",
          // 글 중간(예: "날짜 1/2")이 아니라 줄 처음이나 공백 뒤에서만 연다
          allowedPrefixes: [" "],
          // "제목 1"·"코드 블록"처럼 이름에 띄어쓰기가 있다 — 공백 뒤에도 맞는 항목이 있으면 열어 둔다.
          // 공백을 넣었는데 맞는 항목이 없으면 그냥 글을 쓰는 중이니 닫는다.
          allowSpaces: true,
          shouldShow: ({ query }) => !/\s/.test(query) || filterSlashItems(query).length > 0,
          allow: ({ state, range }) => {
            const $from = state.doc.resolve(range.from);
            return !$from.parent.type.spec.code && $from.parent.type.name !== "detailsSummary";
          },
          items: ({ query }) => filterSlashItems(query),
          // 실제 실행은 NoteEditor가 SlashContext를 붙여 한다
          command: () => {},
          render: () => {
            const push = (p: {
              query: string;
              items: SlashItem[];
              range: Range;
              clientRect?: (() => DOMRect | null) | null;
            }) =>
              callbacks.onChange({
                query: p.query,
                items: p.items,
                range: p.range,
                clientRect: p.clientRect ?? (() => null),
              });
            return {
              onStart: push,
              onUpdate: push,
              onKeyDown: ({ event }) => callbacks.onKeyDown(event),
              onExit: () => callbacks.onChange(null),
            };
          },
        }),
      ];
    },
  });
}
