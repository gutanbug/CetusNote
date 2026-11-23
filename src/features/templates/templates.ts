import type { JSONContent } from "@tiptap/core";
import type { PageStatus } from "@/lib/storage";

/**
 * 내장 템플릿 (PAGE-07) — 코드에 들어 있고 파일로 저장하지 않는다.
 * 내용은 OpenDesign 프로토타입(app.js §27)의 템플릿을 따른다. 데이터베이스 분류는 P2라 아직 없다.
 */
export type TemplateResult = {
  icon: string;
  title: string;
  tags: string[];
  status: PageStatus | null;
  content: JSONContent;
};

export type Template = {
  id: string;
  category: TemplateCategoryId;
  emoji: string;
  name: string;
  description: string;
  /** date: 오늘 날짜 "2026-11-19" */
  make: (date: string) => TemplateResult;
};

export type TemplateCategoryId = "work" | "journal" | "study";
export const TEMPLATE_CATEGORIES: { id: TemplateCategoryId; name: string }[] = [
  { id: "work", name: "업무" },
  { id: "journal", name: "기록" },
  { id: "study", name: "학습" },
];

// ── 블록 만들기 ───────────────────────────────────────
const text = (t: string): JSONContent[] => (t ? [{ type: "text", text: t }] : []);
const p = (t = ""): JSONContent => ({ type: "paragraph", content: text(t) });
const h2 = (t: string): JSONContent => ({ type: "heading", attrs: { level: 2 }, content: text(t) });
const ul = (...items: string[]): JSONContent => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});
const todo = (...items: string[]): JSONContent => ({
  type: "taskList",
  content: items.map((t) => ({ type: "taskItem", attrs: { checked: false }, content: [p(t)] })),
});
const quote = (t = ""): JSONContent => ({ type: "blockquote", content: [p(t)] });
const code = (language: string): JSONContent => ({ type: "codeBlock", attrs: { language } });
const callout = (emoji: string, color: string, t: string): JSONContent => ({
  type: "callout",
  attrs: { emoji, color },
  content: [p(t)],
});
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

export const TEMPLATES: Template[] = [
  {
    id: "meeting",
    category: "work",
    emoji: "📝",
    name: "회의록",
    description: "참석자 · 안건 · 결정 · 액션 아이템",
    make: (d) => ({
      icon: "📝",
      title: `회의록 ${d}`,
      tags: ["회의"],
      status: "진행 중",
      content: doc(
        callout("📌", "blue", `참석: · 기록: · 일시: ${d}`),
        h2("안건"),
        ul(""),
        h2("논의"),
        p(),
        h2("결정 사항"),
        ul(""),
        h2("액션 아이템"),
        todo("", ""),
      ),
    }),
  },
  {
    id: "weekly",
    category: "work",
    emoji: "🗓",
    name: "주간 리뷰",
    description: "한 주의 성과 · 막힌 것 · 다음 주 계획",
    make: () => ({
      icon: "🗓",
      title: "주간 리뷰",
      tags: ["업무"],
      status: "진행 중",
      content: doc(
        h2("이번 주 성과"),
        ul(""),
        h2("막힌 것"),
        ul(""),
        h2("다음 주 계획"),
        todo("", ""),
      ),
    }),
  },
  {
    id: "daily",
    category: "journal",
    emoji: "🌤",
    name: "일일 노트",
    description: "오늘 할 일 · 기록 · 회고",
    make: (d) => ({
      icon: "🌤",
      title: `일일 노트 ${d}`,
      tags: [],
      status: "진행 중",
      content: doc(
        h2("오늘 할 일"),
        todo("", ""),
        h2("기록"),
        p(),
        h2("회고"),
        quote("잘된 것 / 아쉬운 것 / 다음에 바꿀 것"),
      ),
    }),
  },
  {
    id: "todo",
    category: "journal",
    emoji: "✅",
    name: "할 일",
    description: "오늘 · 이번 주 · 대기",
    make: () => ({
      icon: "✅",
      title: "할 일",
      tags: ["할 일"],
      status: "진행 중",
      content: doc(h2("오늘"), todo("", ""), h2("이번 주"), todo(""), h2("대기"), todo("")),
    }),
  },
  {
    id: "study",
    category: "study",
    emoji: "📚",
    name: "학습 노트",
    description: "요약 · 예제 코드 · 기억할 점",
    make: () => ({
      icon: "📚",
      title: "학습 노트",
      tags: ["학습"],
      status: "진행 중",
      content: doc(
        h2("한 줄 요약"),
        p(),
        h2("예제 코드"),
        code("javascript"),
        h2("기억할 점"),
        ul("", ""),
        h2("더 볼 것"),
        todo(""),
      ),
    }),
  },
  {
    id: "reading",
    category: "study",
    emoji: "🔖",
    name: "읽은 글 정리",
    description: "출처 · 핵심 주장 · 내 생각",
    make: () => ({
      icon: "🔖",
      title: "읽은 글 정리",
      tags: ["학습"],
      status: "진행 중",
      content: doc(h2("출처"), p(), h2("핵심 주장"), ul("", ""), h2("내 생각"), quote()),
    }),
  },
];

/** 오늘 날짜 "YYYY-MM-DD" (기기 시간대) */
export function todayISO(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
