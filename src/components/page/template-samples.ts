/* i18n-ignore-file — 스토리 전용 샘플 문서 본문 (앱 데이터·기본 템플릿이 아님) */
import type { PreviewNode } from "./doc-preview";

/** 스토리용 템플릿 본문 견본 (실제 기본 템플릿과 같은 모양) */
const t = (text: string): PreviewNode => ({ type: "text", text });
const h = (text: string, level = 2): PreviewNode => ({
  type: "heading",
  attrs: { level },
  content: [t(text)],
});
const p = (text: string): PreviewNode => ({ type: "paragraph", content: text ? [t(text)] : [] });
const list = (type: string, items: string[], checked: boolean[] = []): PreviewNode => ({
  type,
  content: items.map((x, i) => ({
    type: type === "taskList" ? "taskItem" : "listItem",
    attrs: type === "taskList" ? { checked: !!checked[i] } : {},
    content: [p(x)],
  })),
});
const doc = (...content: PreviewNode[]): PreviewNode => ({ type: "doc", content });

export const SAMPLE_DOCS = {
  meeting: doc(
    h("참석자"),
    list("bulletList", ["민지, 준호, 서연"]),
    h("안건"),
    list("orderedList", ["다음 분기 출시 범위", "디자인 리뷰 일정"]),
    h("결정"),
    h("액션 아이템"),
    list("taskList", ["회의록 공유", ""]),
  ),
  weekly: doc(
    h("이번 주 한 일"),
    list("bulletList", [""]),
    h("막힌 것"),
    h("다음 주 계획"),
    list("taskList", [""]),
  ),
  daily: doc(
    h("오늘 할 일"),
    list("taskList", ["메일 정리", "기획서 초안"], [true, false]),
    h("기록"),
    p(""),
    h("회고"),
    { type: "blockquote", content: [p("오늘 가장 잘한 일은?")] },
  ),
  todo: doc(h("오늘"), list("taskList", ["", ""]), h("이번 주"), list("taskList", [""]), h("대기")),
  study: doc(
    h("요약"),
    p("한 문단으로 핵심을 적어요."),
    h("예제 코드"),
    { type: "codeBlock", attrs: { language: "ts" }, content: [t("const answer = 42;")] },
    h("기억할 점"),
    list("bulletList", [""]),
  ),
  empty: doc(),
} satisfies Record<string, PreviewNode>;
