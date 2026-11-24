import { TabIndent } from "./tab-indent";
import { TextAlignment } from "./text-align";
import { Extension, type AnyExtension } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import Emoji, { emojis } from "@tiptap/extension-emoji";
import Highlight from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { BlockKeys } from "./block-keys";
import { Callout } from "./callout";
import { TableOfContents } from "./table-of-contents";
import { CodeBlock } from "./code-block";
import { ImageBlock, type ImageSource } from "./image";
import { CopyAsTextExtension, type CopyAsText } from "./copy-as-text";
import { FindReplace } from "./find-replace";
import { MarkdownPaste } from "./markdown-paste";
import { mathExtensions, type MathClick } from "./math";
import {
  pageIdOfHref,
  mentionSuggestion,
  PageMention,
  type MentionCallbacks,
  type MentionTarget,
} from "./page-mention";
import { slashCommand, type SlashCallbacks } from "./slash-command";
import { TaskItemShortcuts } from "./task-item-shortcuts";
import { toggleExtensions } from "./toggle";

export type EditorExtensionOptions = {
  /** 빈 문단에 보일 안내 (EDIT-11) */
  placeholder?: string;
  onMathClick?: MathClick;
  /** 주면 `/` 슬래시 메뉴를 켠다 (ED-SlashMenu) */
  slash?: SlashCallbacks;
  /** 주면 `@` 페이지 멘션 제안을 켠다 (ED-PageMention). 멘션 노드 자체는 늘 읽고 쓴다 */
  mention?: {
    callbacks: MentionCallbacks;
    search: (query: string) => MentionTarget[];
    resolve: (id: string) => MentionTarget | null;
    open: (id: string) => void;
  };
  /** ⌥⌘↵ (SHELL-19). 캐럿이 페이지 링크·멘션 위에 있을 때만 그 id를 넘긴다. 아니면 아무것도 하지 않는다 */
  paneKey?: (linkedPageId: string) => void;
  /** 주면 이미지 파일 붙여넣기·끌어 놓기를 저장해 넣는다 (ED-Image). 이미지 노드 자체는 늘 읽고 쓴다 */
  upload?: ImageSource["upload"];
  /** 주면 붙여 넣은 웹 글의 이미지를 내려받아 넣는다(EDIT-24). 없으면 링크로 남긴다 */
  fetchImage?: ImageSource["fetch"];
  /** 주면 여러 블록을 복사할 때 글자(text/plain)를 이 변환(마크다운)으로 (EDIT-26) */
  copyAsText?: CopyAsText;
};

/** 이모지가 아니라 글자 기호로 남길 것 (EDIT-18: (c)→© · (r)→® · (tm)→™) */
const TEXT_SYMBOLS = new Set(["copyright", "registered", "tm"]);

/**
 * ⌥⌘↵ — 캐럿 밑 링크·멘션 id를 화면에 넘긴다 (열기·포커스는 화면이 정한다, SHELL-19).
 * 링크·멘션이 없으면 키를 받기만 하고 아무것도 하지 않는다(기본 입력도 막는다).
 */
const PaneKey = Extension.create<{ onPress?: (linkedPageId: string) => void }>({
  name: "paneKey",
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-Enter": ({ editor }) => {
        if (!this.options.onPress) return false;
        const sel = editor.state.selection;
        const linked =
          sel instanceof NodeSelection && sel.node.type.name === "pageMention"
            ? String(sel.node.attrs.id)
            : pageIdOfHref(editor.getAttributes("link").href);
        if (linked) this.options.onPress(linked);
        return true;
      },
    };
  },
});

/**
 * ED-Editor가 쓰는 확장 묶음 — 모두 Tiptap 오픈소스(MIT) 확장이다.
 *
 * | 문법                | 확장                          | 단축 입력                       |
 * | ------------------- | ----------------------------- | ------------------------------- |
 * | 제목·목록·인용·구분선 | StarterKit                    | `#` `-` `1.` `>` `---`          |
 * | 체크리스트            | TaskList/TaskItem (중첩)       | `[ ]` `[x]`                     |
 * | 토글                 | Details                       | `>>`                            |
 * | 콜아웃               | Callout (커스텀)               | `:::`                           |
 * | 코드 블록            | CodeBlockLowlight (37개 언어)  | ``` ```언어 ```                 |
 * | 표                   | TableKit (열 너비 조절)        | —                               |
 * | 블록 옮기기           | BlockKeys (커스텀)             | ⌘⇧↑ ⌘⇧↓                         |
 * | 탭 들여쓰기           | TabIndent (커스텀)             | Tab ⇧Tab, Esc 다음 Tab은 나가기 |
 * | 수식                 | Mathematics (KaTeX)           | `$x$` `$$x$$` `$$$x$$$`         |
 * | 인라인 서식          | StarterKit + Highlight·Color·위/아래 첨자 | `**` `*` `~~` `` ` `` `==` |
 * | 자동 변환·이모지      | Typography · Emoji            | `->` `(c)` `:smile:`            |
 * | 이미지 + 캡션         | ImageBlock (커스텀)              | 이미지 파일 붙여넣기·끌어 놓기 |
 * | 페이지 멘션           | PageMention (커스텀, Suggestion) | `@제목`, 페이지 링크 붙여넣기 |
 * | 찾기·바꾸기          | FindReplace (커스텀, 장식)       | ⌘F ⌥⌘F (ED-FindBar)            |
 * | 마크다운으로 복사      | CopyAsText (커스텀)             | 여러 블록 복사 → 글자는 마크다운 |
 * | 마크다운 붙여넣기      | MarkdownPaste (커스텀, marked)  | 마크다운 글 붙여넣기, ⇧⌘V는 글자 그대로 |
 */
export function createExtensions({
  placeholder = "'/'를 입력해 명령어 사용",
  onMathClick = () => {},
  slash,
  mention,
  paneKey,
  upload,
  fetchImage,
  copyAsText,
}: EditorExtensionOptions = {}): AnyExtension[] {
  return [
    ...(slash ? [slashCommand(slash)] : []),
    ...(mention ? [mentionSuggestion(mention.callbacks, mention.search)] : []),
    PageMention.configure({ resolve: mention?.resolve, open: mention?.open }),
    PaneKey.configure({ onPress: paneKey }),
    BlockKeys,
    TabIndent,
    MarkdownPaste,
    FindReplace,
    CopyAsTextExtension.configure({ serialize: copyAsText ?? null }),
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3] },
      // 블록을 끌 때 놓일 자리 (프로토타입 .block[data-dropline]: accent 2px)
      dropcursor: { color: "var(--accent)", width: 2, class: "sn-dropcursor" },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: null },
      },
    }),
    Placeholder.configure({
      includeChildren: true,
      placeholder: ({ node }) => {
        if (node.type.name === "heading") return `제목 ${node.attrs.level}`;
        if (node.type.name === "detailsSummary") return "토글 제목";
        if (node.type.name === "image") return ""; // 캡션 안내는 노드 뷰가 그린다
        // 코드 블록에서는 / 메뉴가 열리지 않고, 안내가 언어 고르기 줄과 겹친다
        if (node.type.name === "codeBlock") return "";
        return placeholder;
      },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
      a11y: {
        checkboxLabel: (node, checked) =>
          `${node.textContent || "빈 할 일"} ${checked ? "완료됨" : "완료 표시"}`,
      },
    }),
    TaskItemShortcuts,
    ...toggleExtensions,
    Callout,
    TableOfContents,
    CodeBlock,
    ImageBlock.configure({ upload: upload ?? null, fetch: fetchImage ?? null }),
    TableKit.configure({ table: { resizable: true, cellMinWidth: 80 } }),
    ...mathExtensions(onMathClick),
    // 색은 토큰 변수를 그대로 저장해 테마가 바뀌어도 따라간다 (예: "var(--c-red-fg)")
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    // ⌘, (설정)·⌘. (집중 모드)는 앱 단축키라 첨자는 ⇧를 더한다 (2026-11-19, SET-05)
    Subscript.extend({
      addKeyboardShortcuts() {
        return { "Mod-Shift-,": () => this.editor.commands.toggleSubscript() };
      },
    }),
    Superscript.extend({
      addKeyboardShortcuts() {
        return { "Mod-Shift-.": () => this.editor.commands.toggleSuperscript() };
      },
    }),
    TextAlignment.configure({ types: ["heading", "paragraph"] }),
    // `>>`(토글)·`$x^2$`(수식) 단축 입력과 겹치는 변환은 끈다. 위 첨자는 ⌘⇧. 로 쓴다.
    Typography.configure({
      laquo: false,
      raquo: false,
      superscriptTwo: false,
      superscriptThree: false,
    }),
    // ©®™는 글자로 둔다 — 이모지 확장은 입력된 이모지 문자를 노드로 바꾸는데, Typography의 (c)→©까지 이모지가 된다
    Emoji.configure({
      emojis: emojis.filter((e) => !TEXT_SYMBOLS.has(e.name)),
      enableEmoticons: false,
      forceFallbackImages: false,
    }),
  ];
}
