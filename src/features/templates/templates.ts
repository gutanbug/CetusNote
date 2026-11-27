import type { JSONContent } from "@tiptap/core";
import { msg } from "@/lib/i18n";
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
const tt = () => msg().features.templates;

export const TEMPLATE_CATEGORIES: { id: TemplateCategoryId; name: string }[] = [
  {
    id: "work",
    get name() {
      return tt().categories.work;
    },
  },
  {
    id: "journal",
    get name() {
      return tt().categories.journal;
    },
  },
  {
    id: "study",
    get name() {
      return tt().categories.study;
    },
  },
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

/** 내장 템플릿. 이름·설명·내용은 읽을 때의 언어로 만든다 */
export const TEMPLATES: Template[] = [
  {
    id: "meeting",
    category: "work",
    emoji: "📝",
    get name() {
      return tt().meeting.name;
    },
    get description() {
      return tt().meeting.description;
    },
    make: (d) => {
      const m = tt().meeting;
      return {
        icon: "📝",
        title: m.title(d),
        // i18n-ignore — 저장되는 태그 값
        tags: ["회의"],
        // i18n-ignore — 저장되는 상태 값
        status: "진행 중",
        content: doc(
          callout("📌", "blue", m.header(d)),
          h2(m.agenda),
          ul(""),
          h2(m.discussion),
          p(),
          h2(m.decisions),
          ul(""),
          h2(m.actionItems),
          todo("", ""),
        ),
      };
    },
  },
  {
    id: "weekly",
    category: "work",
    emoji: "🗓",
    get name() {
      return tt().weekly.name;
    },
    get description() {
      return tt().weekly.description;
    },
    make: () => {
      const m = tt().weekly;
      return {
        icon: "🗓",
        title: m.title,
        // i18n-ignore — 저장되는 태그 값
        tags: ["업무"],
        // i18n-ignore — 저장되는 상태 값
        status: "진행 중",
        content: doc(h2(m.wins), ul(""), h2(m.blockers), ul(""), h2(m.nextWeek), todo("", "")),
      };
    },
  },
  {
    id: "daily",
    category: "journal",
    emoji: "🌤",
    get name() {
      return tt().daily.name;
    },
    get description() {
      return tt().daily.description;
    },
    make: (d) => {
      const m = tt().daily;
      return {
        icon: "🌤",
        title: m.title(d),
        tags: [],
        // i18n-ignore — 저장되는 상태 값
        status: "진행 중",
        content: doc(
          h2(m.today),
          todo("", ""),
          h2(m.log),
          p(),
          h2(m.reflection),
          quote(m.reflectionPrompt),
        ),
      };
    },
  },
  {
    id: "todo",
    category: "journal",
    emoji: "✅",
    get name() {
      return tt().todo.name;
    },
    get description() {
      return tt().todo.description;
    },
    make: () => {
      const m = tt().todo;
      return {
        icon: "✅",
        title: m.title,
        // i18n-ignore — 저장되는 태그 값
        tags: ["할 일"],
        // i18n-ignore — 저장되는 상태 값
        status: "진행 중",
        content: doc(h2(m.today), todo("", ""), h2(m.thisWeek), todo(""), h2(m.waiting), todo("")),
      };
    },
  },
  {
    id: "study",
    category: "study",
    emoji: "📚",
    get name() {
      return tt().study.name;
    },
    get description() {
      return tt().study.description;
    },
    make: () => {
      const m = tt().study;
      return {
        icon: "📚",
        title: m.title,
        // i18n-ignore — 저장되는 태그 값
        tags: ["학습"],
        // i18n-ignore — 저장되는 상태 값
        status: "진행 중",
        content: doc(
          h2(m.summary),
          p(),
          h2(m.example),
          code("javascript"),
          h2(m.remember),
          ul("", ""),
          h2(m.more),
          todo(""),
        ),
      };
    },
  },
  {
    id: "reading",
    category: "study",
    emoji: "🔖",
    get name() {
      return tt().reading.name;
    },
    get description() {
      return tt().reading.description;
    },
    make: () => {
      const m = tt().reading;
      return {
        icon: "🔖",
        title: m.title,
        // i18n-ignore — 저장되는 태그 값
        tags: ["학습"],
        // i18n-ignore — 저장되는 상태 값
        status: "진행 중",
        content: doc(h2(m.source), p(), h2(m.claims), ul("", ""), h2(m.mine), quote()),
      };
    },
  },
];

/** 오늘 날짜 "YYYY-MM-DD" (기기 시간대) */
export function todayISO(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
