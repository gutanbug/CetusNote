import type { Editor, Range } from "@tiptap/core";
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
} from "lucide-react";
import { addDays, toIsoDate } from "@/lib/dates/local-date";

export type SlashGroup = "기본 블록" | "미디어" | "고급" | "인라인";

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
};

const chain = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

/**
 * ED-SlashMenu 항목 — 프로토타입 app.js `SLASH`와 같은 순서·문구.
 * 데이터베이스는 P2라 아직 없다.
 */
export const SLASH_ITEMS: SlashItem[] = [
  {
    id: "paragraph",
    title: "텍스트",
    description: "일반 본문 블록",
    icon: Type,
    group: "기본 블록",
    keywords: ["text", "paragraph", "plain", "본문", "문단", "텍스트"],
    run: (e, r) => chain(e, r).setParagraph().run(),
  },
  ...([1, 2, 3] as const).map((level): SlashItem => ({
    id: `heading${level}`,
    title: `제목 ${level}`,
    description: ["가장 큰 섹션 제목", "중간 섹션 제목", "작은 섹션 제목"][level - 1]!,
    icon: [Heading1, Heading2, Heading3][level - 1]!,
    group: "기본 블록",
    hint: "#".repeat(level),
    keywords: [`h${level}`, "heading", "title", "헤딩"],
    run: (e, r) => chain(e, r).setHeading({ level }).run(),
  })),
  ...([1, 2, 3] as const).map((level): SlashItem => ({
    id: `toggleHeading${level}`,
    title: `토글 제목 ${level}`,
    description: "제목을 누르면 아래 내용이 접히는 토글",
    icon: ChevronsDownUp,
    group: "기본 블록",
    keywords: [`th${level}`, "toggle heading", "toggle", "토글 제목", "토글", "접기"],
    run: (e, r) => chain(e, r).setToggleHeading({ level }).run(),
  })),
  {
    id: "bulletList",
    title: "글머리 목록",
    description: "순서 없는 목록",
    icon: List,
    group: "기본 블록",
    hint: "-",
    keywords: ["bullet", "list", "ul", "불릿"],
    run: (e, r) => chain(e, r).toggleBulletList().run(),
  },
  {
    id: "orderedList",
    title: "번호 목록",
    description: "순서 있는 목록",
    icon: ListOrdered,
    group: "기본 블록",
    hint: "1.",
    keywords: ["number", "num", "ordered", "list", "ol", "숫자", "번호"],
    run: (e, r) => chain(e, r).toggleOrderedList().run(),
  },
  {
    id: "taskList",
    title: "체크리스트",
    description: "완료 여부를 체크",
    icon: ListTodo,
    group: "기본 블록",
    hint: "[]",
    keywords: ["todo", "task", "checklist", "할 일", "투두", "체크"],
    run: (e, r) => chain(e, r).toggleTaskList().run(),
  },
  {
    id: "toggle",
    title: "토글 목록",
    description: "접었다 펼치는 목록",
    icon: ChevronRight,
    group: "기본 블록",
    hint: ">>",
    keywords: ["toggle", "details", "접기"],
    run: (e, r) => chain(e, r).setDetails().run(),
  },
  {
    id: "blockquote",
    title: "인용",
    description: "왼쪽 선이 있는 인용문",
    icon: Quote,
    group: "기본 블록",
    hint: ">",
    keywords: ["quote", "blockquote", "인용문"],
    run: (e, r) => chain(e, r).toggleBlockquote().run(),
  },
  {
    id: "divider",
    title: "구분선",
    description: "가로 구분선",
    icon: Minus,
    group: "기본 블록",
    hint: "---",
    keywords: ["divider", "div", "hr", "line", "선"],
    run: (e, r) => chain(e, r).setHorizontalRule().run(),
  },
  {
    id: "image",
    title: "이미지",
    description: "캡션이 있는 이미지",
    icon: Image,
    group: "미디어",
    keywords: ["image", "picture", "photo", "사진", "그림"],
    run: (e, r, ctx) => {
      chain(e, r).run();
      ctx.pickImage?.();
    },
  },
  {
    id: "codeBlock",
    title: "코드 블록",
    description: "언어 선택 · 문법 하이라이트",
    icon: Code,
    group: "미디어",
    hint: "```",
    keywords: ["code", "코드"],
    run: (e, r) => chain(e, r).setCodeBlock().run(),
  },
  {
    id: "table",
    title: "표",
    description: "간단한 표",
    icon: Table,
    group: "미디어",
    keywords: ["table", "테이블"],
    run: (e, r) => chain(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "callout",
    title: "콜아웃",
    description: "이모지 + 소프트 배경 강조",
    icon: Lightbulb,
    group: "고급",
    hint: ":::",
    keywords: ["callout", "강조", "메모"],
    run: (e, r) => chain(e, r).setCallout().run(),
  },
  ...([2, 3, 4] as const).map((count): SlashItem => ({
    id: `columns${count}`,
    title: `${count}단 나누기`,
    description: `가로로 ${count}열, 각 열에 블록을 넣는다`,
    icon: [Columns2, Columns3, Columns4][count - 2]!,
    group: "고급",
    keywords: ["columns", "column", "단", "열", `${count}열`, `${count}단`, "나누기"],
    run: (e, r) => chain(e, r).insertColumns({ count }).run(),
  })),
  {
    id: "breadcrumb",
    title: "경로 표시",
    description: "현재 페이지까지의 상위 경로",
    icon: Route,
    group: "고급",
    keywords: ["breadcrumb", "경로", "bread", "path", "위치"],
    run: (e, r) => chain(e, r).insertContent({ type: "breadcrumb" }).run(),
  },
  {
    id: "tableOfContents",
    title: "목차",
    description: "문서의 제목 목록으로 이동",
    icon: ListTree,
    group: "고급",
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
    title: "페이지 멘션",
    description: "다른 페이지를 연결",
    icon: AtSign,
    group: "고급",
    hint: "@",
    keywords: ["mention", "link", "page", "링크", "연결"],
    // `@`를 넣어 페이지 제안을 연다
    run: (e, r) => chain(e, r).insertContent("@").run(),
  },
  {
    id: "blockMath",
    title: "수식 블록",
    description: "KaTeX 수식 (LaTeX)",
    icon: Sigma,
    group: "고급",
    hint: "$$$",
    keywords: ["math", "latex", "equation", "katex", "수학"],
    run: (e, r, ctx) => {
      chain(e, r).run();
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
    id: "inlineMath",
    title: "인라인 수식",
    description: "문장 안에 넣는 KaTeX 수식",
    icon: Pi,
    group: "인라인",
    hint: "$",
    keywords: ["inline math", "math", "equation", "latex", "katex", "수식", "인라인"],
    // 커서 자리에 빈 수식을 넣고 바로 편집 팝오버를 연다
    run: (e, r, ctx) => {
      chain(e, r).run();
      const pos = e.state.selection.from;
      e.chain()
        .insertContentAt(pos, { type: "inlineMath", attrs: { latex: "" } })
        .run();
      ctx.editInlineMath(pos);
    },
  },
  {
    id: "date",
    title: "날짜",
    description: "오늘 날짜 칩 — 누르면 날짜를 바꾼다",
    icon: CalendarDays,
    group: "인라인",
    keywords: ["date", "today", "오늘", "날짜", "now"],
    run: (e, r) =>
      chain(e, r)
        .insertDateChip({ date: toIsoDate(new Date()) })
        .run(),
  },
  {
    id: "dateTomorrow",
    title: "내일 날짜",
    description: "내일 날짜 칩",
    icon: CalendarArrowUp,
    group: "인라인",
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
