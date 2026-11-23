import type { Page, PageTemplate } from "@/lib/storage";
import { TEMPLATES, type TemplateResult } from "./templates";

/** 템플릿 제목·본문에서 적용할 때 오늘 날짜(YYYY-MM-DD)로 바뀌는 자리 */
export const DATE_TOKEN = "{{date}}";

/** 템플릿 문서(PAGE-14)인가 — 휴지통 밖 */
export const isTemplate = (p: Page): p is Page & { template: PageTemplate } =>
  p.template !== null && !p.trashedAt;

/** 기본 템플릿의 순서 (갤러리에서 기본 템플릿이 먼저, 원래 순서대로) */
const builtinRank = (p: Page) => {
  const i = TEMPLATES.findIndex((t) => t.id === p.template?.builtin);
  return i === -1 ? TEMPLATES.length : i;
};

/** 갤러리 순서: 기본 템플릿(원래 순서) → 내가 만든 것(만든 순) */
export function sortTemplates(pages: Page[]): Page[] {
  return [...pages].sort(
    (a, b) => builtinRank(a) - builtinRank(b) || a.createdAt.localeCompare(b.createdAt),
  );
}

/** 기본 템플릿을 워크스페이스 템플릿 문서로 (처음 한 번 사본을 넣을 때) */
export function builtinTemplatePages() {
  return TEMPLATES.map((t) => {
    const made = t.make(DATE_TOKEN);
    return {
      title: t.name,
      icon: made.icon,
      content: made.content as Page["content"],
      props: { tags: made.tags, status: made.status } as unknown as Page["props"],
      template: {
        category: t.category,
        description: t.description,
        builtin: t.id,
        pageTitle: made.title,
      } satisfies PageTemplate,
    };
  });
}

/** 글자 속 {{date}}를 날짜로 바꾼다 (적용과 갤러리 미리보기가 함께 쓴다) */
export const fillDateText = (s: string, date: string) => s.split(DATE_TOKEN).join(date);

/** 글 노드 속 {{date}}도 바꾼다 (적용과 갤러리 미리보기가 함께 쓴다) */
export function fillDateDoc(node: unknown, date: string): unknown {
  if (Array.isArray(node)) return node.map((n) => fillDateDoc(n, date));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node))
      out[k] = k === "text" && typeof v === "string" ? fillDateText(v, date) : fillDateDoc(v, date);
    return out;
  }
  return node;
}

/** 템플릿 문서 → 새 문서에 넣을 값 (날짜 자리를 채운다) */
export function templateResult(page: Page, date: string): TemplateResult {
  return {
    icon: page.icon ?? "",
    title: fillDateText(page.template?.pageTitle ?? page.title, date),
    tags: [...page.props.tags],
    status: page.props.status as TemplateResult["status"],
    content: fillDateDoc(page.content, date) as TemplateResult["content"],
  };
}
