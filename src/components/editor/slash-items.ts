import type { Editor, JSONContent, Range } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  AtSign,
  CalendarArrowUp,
  CalendarDays,
  ChevronRight,
  ChevronsDownUp,
  Code,
  Columns2,
  Columns3,
  Columns4,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Lightbulb,
  List,
  ListOrdered,
  ListTodo,
  ListTree,
  type LucideIcon,
  Minus,
  Pi,
  Quote,
  Route,
  Sigma,
  Table,
  Type,
  FilePlus,
  FileText,
  Film,
  Music,
  Paperclip,
  Smile,
} from "lucide-react";
import type { AttachmentPickKind } from "./attachment";
import { addDays, toIsoDate } from "@/lib/dates/local-date";
import { msg } from "@/lib/i18n";

// prettier-ignore
// i18n-ignore — 그룹 키 값 (정렬·식별자. 화면 이름은 slashGroupId()로 찾아 문구에서 읽는다)
export const SLASH_GROUP = { basic: "기본 블록", media: "미디어", advanced: "고급", inline: "인라인" } as const;
export type SlashGroup = (typeof SLASH_GROUP)[keyof typeof SLASH_GROUP];
export type SlashGroupId = keyof typeof SLASH_GROUP;
/** 그룹 값으로 문구 키(basic …)를 찾는다 */
export const slashGroupId = (group: SlashGroup): SlashGroupId =>
  (Object.keys(SLASH_GROUP) as SlashGroupId[]).find((k) => SLASH_GROUP[k] === group)!;

export type SlashItem = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  group: SlashGroup;
  /** 오른쪽에 보일 단축 입력 (마크다운 문법) */
  hint?: string;
  /** 검색에 함께 쓰는 낱말 (영문 이름, 다른 이름) */
  keywords: string[];
  /** `/검색어`(range)를 지우고 블록을 바꾼다 */
  run: (editor: Editor, range: Range, ctx: SlashContext) => void;
};

/** 항목이 에디터 밖 UI를 열어야 할 때 쓰는 콜백 (NoteEditor가 준다) */
export type SlashContext = {
  /** 방금 넣은 블록 수식(pos)의 LaTeX 편집 팝오버를 연다 */
  editBlockMath: (pos: number) => void;
  /** 이미지 고르기 → 지금 자리에 넣는다 (ED-Image). 이미지 저장소가 없으면 없음 */
  pickImage?: () => void;
  /** 방금 넣은 글자 수식(pos)의 LaTeX 편집 팝오버를 연다 */
  editInlineMath: (pos: number) => void;
  /** 하위 페이지를 만들어 그 id를 돌려준다 (EDIT-29). 페이지 화면이 없으면 없음 */
  createSubpage?: () => string | null;
  /** 넣은 하위 페이지를 연다 (EDIT-29) */
  openSubpage?: (id: string) => void;
  /** 파일을 골라 지금 자리에 첨부 블록으로 넣는다 (EDIT-31~33). 첨부 저장소가 없으면 없음 */
  pickAttachment?: (kind: AttachmentPickKind) => void;
  /** 이모지 피커를 캐럿 자리에 연다 (EDIT-35) */
  pickEmoji?: () => void;
};

const chain = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);
/**
 * 팝오버(이모지·수식 편집)를 바로 여는 항목용: focus()를 붙이지 않는다.
 * Tiptap의 focus는 다음 프레임(rAF)에 편집기로 포커스를 되돌리는데, 팝오버가 그 전에 안쪽에 포커스를 잡으면
 * 편집기 포커스가 팝오버를 바깥 클릭처럼 닫는다. 수식은 닫힐 때 빈 식을 지우므로 글자가 사라진다.
 */
const chainNoFocus = (editor: Editor, range: Range) => editor.chain().deleteRange(range);

/**
 * 블록을 `/검색어` 자리에 넣는다 (EDIT-07, 어떤 문법 위치에서든 동작).
 * 1) `/검색어`를 지운다. 2) `command`가 그 자리에서 되면 그대로 둔다(기본: 노드를 캐럿 자리에 넣기).
 * 3) 스키마가 허용하지 않는 자리(목록 항목의 첫 문단, 인용·토글 안 등)면 캐럿이 있는 블록 바로 뒤에,
 *    허용되는 가장 안쪽 부모 안에 넣는다. 글은 그대로 두고, 캐럿은 새 블록 안으로 옮긴다.
 */
export function insertBlock(
  editor: Editor,
  range: Range,
  node: JSONContent,
  command: (editor: Editor) => boolean = (ed) => ed.chain().insertContent(node).run(),
) {
  chain(editor, range).run();
  // 빈 목록 항목에서 고르면 항목을 목록 밖으로 빼고 그 자리에서 바꾼다 — 마크다운 단축 입력(`::: `)과 같은 결과.
  // 그대로 두면 빈 글머리(•) 아래에 블록이 붙는다
  liftEmptyListItem(editor);
  if (command(editor)) return;
  placeBlockAtCaret(editor, editor.schema.nodeFromJSON(node));
}

function liftEmptyListItem(editor: Editor) {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.content.size !== 0 || $from.depth < 2) return;
  const item = $from.node($from.depth - 1);
  if (!["listItem", "taskItem"].includes(item.type.name) || item.childCount !== 1) return;
  editor.commands.liftListItem(item.type.name);
}

function placeBlockAtCaret(editor: Editor, node: PMNode) {
  const { state } = editor;
  const { $from } = state.selection;
  const tr = state.tr;
  let at = -1;
  for (let d = $from.depth - 1; d >= 0 && at < 0; d--) {
    const parent = $from.node(d);
    const index = $from.index(d);
    // 캐럿 문단이 비었으면 그 문단을 바꾼다
    if (
      d === $from.depth - 1 &&
      $from.parent.content.size === 0 &&
      parent.canReplaceWith(index, index + 1, node.type)
    ) {
      at = $from.before();
      tr.replaceWith(at, $from.after(), node);
    } else if (parent.canReplaceWith(index + 1, index + 1, node.type)) {
      at = $from.after(d + 1);
      tr.insert(at, node);
    }
  }
  if (at < 0) return;
  // 원자 노드(구분선·목차 등)는 그 뒤에, 블록 노드는 안쪽 첫 글자 자리에 캐럿을 둔다
  const caret = node.isAtom || node.isLeaf ? at + node.nodeSize : at + 1;
  editor.view.dispatch(tr.setSelection(Selection.near(tr.doc.resolve(caret), 1)).scrollIntoView());
}

/**
 * ED-SlashMenu 항목 — 프로토타입 app.js `SLASH`와 같은 순서·문구.
 * 데이터베이스는 P2라 아직 없다.
 */
export const SLASH_ITEMS: SlashItem[] = [
  {
    id: "paragraph",
    get title() {
      return msg().editor.slash.items.paragraph.title;
    },
    get description() {
      return msg().editor.slash.items.paragraph.description;
    },
    icon: Type,
    group: SLASH_GROUP.basic,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["text", "paragraph", "plain", "본문", "문단", "텍스트"],
    run: (e, r) => chain(e, r).setParagraph().run(),
  },
  ...([1, 2, 3] as const).map((level): SlashItem => ({
    id: `heading${level}`,
    get title() {
      return msg().editor.slash.items.heading.title(level);
    },
    get description() {
      return msg().editor.slash.items.heading.description[level - 1]!;
    },
    icon: [Heading1, Heading2, Heading3][level - 1]!,
    group: SLASH_GROUP.basic,
    hint: "#".repeat(level),
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: [`h${level}`, "heading", "title", "헤딩"],
    run: (e, r) => chain(e, r).setHeading({ level }).run(),
  })),
  ...([1, 2, 3] as const).map((level): SlashItem => ({
    id: `toggleHeading${level}`,
    get title() {
      return msg().editor.slash.items.toggleHeading.title(level);
    },
    get description() {
      return msg().editor.slash.items.toggleHeading.description;
    },
    icon: ChevronsDownUp,
    group: SLASH_GROUP.basic,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: [`th${level}`, "toggle heading", "toggle", "토글 제목", "토글", "접기"],
    run: (e, r) => chain(e, r).setToggleHeading({ level }).run(),
  })),
  {
    id: "bulletList",
    get title() {
      return msg().editor.slash.items.bulletList.title;
    },
    get description() {
      return msg().editor.slash.items.bulletList.description;
    },
    icon: List,
    group: SLASH_GROUP.basic,
    hint: "-",
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["bullet", "list", "ul", "불릿"],
    run: (e, r) => chain(e, r).toggleBulletList().run(),
  },
  {
    id: "orderedList",
    get title() {
      return msg().editor.slash.items.orderedList.title;
    },
    get description() {
      return msg().editor.slash.items.orderedList.description;
    },
    icon: ListOrdered,
    group: SLASH_GROUP.basic,
    hint: "1.",
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["number", "num", "ordered", "list", "ol", "숫자", "번호"],
    run: (e, r) => chain(e, r).toggleOrderedList().run(),
  },
  {
    id: "taskList",
    get title() {
      return msg().editor.slash.items.taskList.title;
    },
    get description() {
      return msg().editor.slash.items.taskList.description;
    },
    icon: ListTodo,
    group: SLASH_GROUP.basic,
    hint: "[]",
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["todo", "task", "checklist", "할 일", "투두", "체크"],
    run: (e, r) => chain(e, r).toggleTaskList().run(),
  },
  {
    id: "toggle",
    get title() {
      return msg().editor.slash.items.toggle.title;
    },
    get description() {
      return msg().editor.slash.items.toggle.description;
    },
    icon: ChevronRight,
    group: SLASH_GROUP.basic,
    hint: ">>",
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["toggle", "details", "접기"],
    run: (e, r) =>
      insertBlock(e, r, {
        type: "details",
        attrs: { open: true },
        content: [
          { type: "detailsSummary" },
          { type: "detailsContent", content: [{ type: "paragraph" }] },
        ],
      }),
  },
  {
    id: "blockquote",
    get title() {
      return msg().editor.slash.items.blockquote.title;
    },
    get description() {
      return msg().editor.slash.items.blockquote.description;
    },
    icon: Quote,
    group: SLASH_GROUP.basic,
    hint: ">",
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["quote", "blockquote", "인용문"],
    run: (e, r) =>
      insertBlock(e, r, { type: "blockquote", content: [{ type: "paragraph" }] }, (ed) =>
        ed.chain().toggleBlockquote().run(),
      ),
  },
  {
    id: "divider",
    get title() {
      return msg().editor.slash.items.divider.title;
    },
    get description() {
      return msg().editor.slash.items.divider.description;
    },
    icon: Minus,
    group: SLASH_GROUP.basic,
    hint: "---",
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["divider", "div", "hr", "line", "선"],
    run: (e, r) => chain(e, r).setHorizontalRule().run(),
  },
  {
    id: "image",
    get title() {
      return msg().editor.slash.items.image.title;
    },
    get description() {
      return msg().editor.slash.items.image.description;
    },
    icon: Image,
    group: SLASH_GROUP.media,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["image", "picture", "photo", "사진", "그림"],
    run: (e, r, ctx) => {
      chain(e, r).run();
      ctx.pickImage?.();
    },
  },
  {
    id: "file",
    get title() {
      return msg().editor.slash.items.file.title;
    },
    get description() {
      return msg().editor.slash.items.file.description;
    },
    icon: Paperclip,
    group: SLASH_GROUP.media,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["file", "attach", "attachment", "첨부", "파일 첨부"],
    run: (e, r, ctx) => {
      chain(e, r).run();
      ctx.pickAttachment?.("file");
    },
  },
  {
    id: "pdf",
    get title() {
      return msg().editor.slash.items.pdf.title;
    },
    get description() {
      return msg().editor.slash.items.pdf.description;
    },
    icon: FileText,
    group: SLASH_GROUP.media,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["pdf", "document", "문서"],
    run: (e, r, ctx) => {
      chain(e, r).run();
      ctx.pickAttachment?.("pdf");
    },
  },
  {
    id: "video",
    get title() {
      return msg().editor.slash.items.video.title;
    },
    get description() {
      return msg().editor.slash.items.video.description;
    },
    icon: Film,
    group: SLASH_GROUP.media,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["video", "movie", "clip", "동영상", "영상"],
    run: (e, r, ctx) => {
      chain(e, r).run();
      ctx.pickAttachment?.("media");
    },
  },
  {
    id: "audio",
    get title() {
      return msg().editor.slash.items.audio.title;
    },
    get description() {
      return msg().editor.slash.items.audio.description;
    },
    icon: Music,
    group: SLASH_GROUP.media,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["audio", "sound", "voice", "music", "소리", "음성"],
    run: (e, r, ctx) => {
      chain(e, r).run();
      ctx.pickAttachment?.("media");
    },
  },
  {
    id: "codeBlock",
    get title() {
      return msg().editor.slash.items.codeBlock.title;
    },
    get description() {
      return msg().editor.slash.items.codeBlock.description;
    },
    icon: Code,
    group: SLASH_GROUP.media,
    hint: "```",
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["code", "코드"],
    run: (e, r) => chain(e, r).setCodeBlock().run(),
  },
  {
    id: "table",
    get title() {
      return msg().editor.slash.items.table.title;
    },
    get description() {
      return msg().editor.slash.items.table.description;
    },
    icon: Table,
    group: SLASH_GROUP.media,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["table", "테이블"],
    run: (e, r) => chain(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "callout",
    get title() {
      return msg().editor.slash.items.callout.title;
    },
    get description() {
      return msg().editor.slash.items.callout.description;
    },
    icon: Lightbulb,
    group: SLASH_GROUP.advanced,
    hint: ":::",
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["callout", "강조", "메모"],
    run: (e, r) =>
      insertBlock(e, r, { type: "callout", content: [{ type: "paragraph" }] }, (ed) =>
        ed.chain().setCallout().run(),
      ),
  },
  ...([2, 3, 4] as const).map((count): SlashItem => ({
    id: `columns${count}`,
    get title() {
      return msg().editor.slash.items.columns.title(count);
    },
    get description() {
      return msg().editor.slash.items.columns.description(count);
    },
    icon: [Columns2, Columns3, Columns4][count - 2]!,
    group: SLASH_GROUP.advanced,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["columns", "column", "단", "열", `${count}열`, `${count}단`, "나누기"],
    run: (e, r) => chain(e, r).insertColumns({ count }).run(),
  })),
  {
    id: "subpage",
    get title() {
      return msg().editor.slash.items.subpage.title;
    },
    get description() {
      return msg().editor.slash.items.subpage.description;
    },
    icon: FilePlus,
    group: SLASH_GROUP.advanced,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["page", "subpage", "하위 페이지", "새 페이지", "child", "하위", "페이지"],
    // 새 페이지를 만들어 링크 블록을 넣고, 그 페이지를 연다 (Notion과 같은 흐름)
    run: (e, r, ctx) => {
      const id = ctx.createSubpage?.() ?? null;
      if (!id) {
        chain(e, r).run();
        return;
      }
      // insertContent는 커서를 블록 뒤로 옮긴다(경로 표시와 같은 방식) — 다음 명령이 그 자리에서 이어진다
      chain(e, r)
        .insertContent({ type: "subpage", attrs: { pageId: id } })
        .run();
      ctx.openSubpage?.(id);
    },
  },
  {
    id: "breadcrumb",
    get title() {
      return msg().editor.slash.items.breadcrumb.title;
    },
    get description() {
      return msg().editor.slash.items.breadcrumb.description;
    },
    icon: Route,
    group: SLASH_GROUP.advanced,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["breadcrumb", "경로", "bread", "path", "위치"],
    run: (e, r) => chain(e, r).insertContent({ type: "breadcrumb" }).run(),
  },
  {
    id: "tableOfContents",
    get title() {
      return msg().editor.slash.items.tableOfContents.title;
    },
    get description() {
      return msg().editor.slash.items.tableOfContents.description;
    },
    icon: ListTree,
    group: SLASH_GROUP.advanced,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["toc", "contents", "table of contents", "차례", "목차"],
    // 빈 문단이면 그 자리를, 글이 있으면 다음 자리를 목차 블록으로 채운다 (수식 블록과 같은 방식)
    run: (e, r) => {
      chain(e, r).run();
      const { $from } = e.state.selection;
      const empty = $from.parent.content.size === 0;
      const range = empty ? { from: $from.before(), to: $from.after() } : $from.after();
      e.chain().insertContentAt(range, { type: "tableOfContents" }).run();
    },
  },
  {
    id: "pageMention",
    get title() {
      return msg().editor.slash.items.pageMention.title;
    },
    get description() {
      return msg().editor.slash.items.pageMention.description;
    },
    icon: AtSign,
    group: SLASH_GROUP.advanced,
    hint: "@",
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["mention", "link", "page", "링크", "연결"],
    // `@`를 넣어 페이지 제안을 연다
    // 문자열을 넣으면 Tiptap이 HTML로 읽는데 그때 DOM이 필요하다 — 글자 노드로 넣는다
    run: (e, r) => chain(e, r).insertContent({ type: "text", text: "@" }).run(),
  },
  {
    id: "blockMath",
    get title() {
      return msg().editor.slash.items.blockMath.title;
    },
    get description() {
      return msg().editor.slash.items.blockMath.description;
    },
    icon: Sigma,
    group: SLASH_GROUP.advanced,
    hint: "$$$",
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["math", "latex", "equation", "katex", "수학"],
    run: (e, r, ctx) => {
      chainNoFocus(e, r).run();
      // 빈 문단이면 그 자리를, 글이 있으면 다음 자리를 수식 블록으로 채운다
      const { $from } = e.state.selection;
      const empty = $from.parent.content.size === 0;
      const at = empty ? $from.before() : $from.after();
      const range = empty ? { from: at, to: $from.after() } : at;
      // Tiptap의 insertBlockMath는 빈 식을 거부하므로 노드를 직접 넣고 바로 편집 팝오버를 연다
      e.chain()
        .insertContentAt(range, { type: "blockMath", attrs: { latex: "" } })
        .run();
      ctx.editBlockMath(at);
    },
  },
  {
    id: "emoji",
    get title() {
      return msg().editor.slash.items.emoji.title;
    },
    get description() {
      return msg().editor.slash.items.emoji.description;
    },
    icon: Smile,
    group: SLASH_GROUP.inline,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["emoji", "emoticon", "smile", "이모지", "이모티콘", "감정"],
    run: (e, r, ctx) => {
      chainNoFocus(e, r).run();
      ctx.pickEmoji?.();
    },
  },
  {
    id: "inlineMath",
    get title() {
      return msg().editor.slash.items.inlineMath.title;
    },
    get description() {
      return msg().editor.slash.items.inlineMath.description;
    },
    icon: Pi,
    group: SLASH_GROUP.inline,
    hint: "$",
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["inline math", "math", "equation", "latex", "katex", "수식", "인라인"],
    // 커서 자리에 빈 수식을 넣고 바로 편집 팝오버를 연다
    run: (e, r, ctx) => {
      chainNoFocus(e, r).run();
      const pos = e.state.selection.from;
      e.chain()
        .insertContentAt(pos, { type: "inlineMath", attrs: { latex: "" } })
        .run();
      ctx.editInlineMath(pos);
    },
  },
  {
    id: "date",
    get title() {
      return msg().editor.slash.items.date.title;
    },
    get description() {
      return msg().editor.slash.items.date.description;
    },
    icon: CalendarDays,
    group: SLASH_GROUP.inline,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["date", "today", "오늘", "날짜", "now"],
    run: (e, r) =>
      chain(e, r)
        .insertDateChip({ date: toIsoDate(new Date()) })
        .run(),
  },
  {
    id: "dateTomorrow",
    get title() {
      return msg().editor.slash.items.dateTomorrow.title;
    },
    get description() {
      return msg().editor.slash.items.dateTomorrow.description;
    },
    icon: CalendarArrowUp,
    group: SLASH_GROUP.inline,
    // i18n-ignore — 한국어 검색 별칭 (영어 별칭과 함께 둔다)
    keywords: ["tomorrow", "내일", "date", "날짜"],
    run: (e, r) =>
      chain(e, r)
        .insertDateChip({ date: toIsoDate(addDays(new Date(), 1)) })
        .run(),
  },
];

/** 이름 · 단축 입력 · 낱말로 거른다(대소문자 무시). 빈 검색어면 전부 */
export function filterSlashItems(query: string, items: SlashItem[] = SLASH_ITEMS): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (it) =>
      it.title.toLowerCase().includes(q) ||
      it.hint?.includes(q) ||
      it.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}

/** 화면에 보일 순서대로 묶는다 */
export function groupSlashItems(items: SlashItem[]) {
  const groups: { group: SlashGroup; items: SlashItem[] }[] = [];
  for (const it of items) {
    const g = groups.find((x) => x.group === it.group);
    if (g) g.items.push(it);
    else groups.push({ group: it.group, items: [it] });
  }
  return groups;
}
