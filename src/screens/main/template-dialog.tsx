import type { PreviewNode } from "@/components/page/doc-preview";
import { TemplateGallery } from "@/components/page/template-gallery";
import { pagesStore, usePagesWhile } from "@/features/pages";
import {
  fillDateDoc,
  fillDateText,
  isTemplate,
  sortTemplates,
  TEMPLATE_CATEGORIES,
  type TemplateCategoryId,
  todayISO,
} from "@/features/templates";
import * as React from "react";
import {
  applyTemplate,
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  editTemplate,
  ensureTemplates,
} from "./actions";
import { useRestoreFocus } from "./use-restore-focus";
import { useMainUi } from "./ui-store";

/**
 * 템플릿 갤러리 (PAGE-07 · PAGE-14) — ⌘T · 사이드바 · 빈 페이지 · 팔레트에서 연다.
 * 템플릿은 워크스페이스의 숨은 문서다. 처음 열 때 기본 템플릿 사본을 넣는다.
 * 고른 분류는 앱을 켜 둔 동안 기억한다.
 */
export function TemplateDialog() {
  const open = useMainUi((s) => s.templatesOpen);
  const setOpen = useMainUi((s) => s.setTemplatesOpen);
  const pages = usePagesWhile(open);
  const [category, setCategory] = React.useState<TemplateCategoryId>("work");
  useRestoreFocus(open);
  React.useEffect(() => {
    if (open) ensureTemplates();
  }, [open]);
  // 미리보기는 템플릿 본문이 있어야 그린다 (SYS-10). 읽히는 대로 목록이 채워진다
  React.useEffect(() => {
    if (!open) return;
    for (const p of Object.values(pagesStore.getState().pages))
      if (isTemplate(p)) void pagesStore.getState().ensureBody(p.id);
  }, [open, pages]);
  // 미리보기는 오늘 날짜로 채운다. 원본 토큰은 템플릿 편집기에 그대로 둔다
  const items = React.useMemo(() => {
    const today = todayISO();
    return sortTemplates(
      Object.values(pages).filter((p) => isTemplate(p) && p.template.category === category),
    ).map((p) => ({
      id: p.id,
      emoji: p.icon ?? "",
      name: fillDateText(p.title, today),
      description: fillDateText(p.template?.description ?? "", today),
      doc: fillDateDoc(p.content, today) as PreviewNode,
    }));
  }, [pages, category]);
  return (
    <TemplateGallery
      open={open}
      onOpenChange={setOpen}
      categories={TEMPLATE_CATEGORIES}
      category={category}
      onCategoryChange={(id) => setCategory(id as TemplateCategoryId)}
      items={items}
      onPick={(id) => {
        setOpen(false);
        applyTemplate(id);
        // 채운 뒤 본문 첫 줄로
        setTimeout(
          () =>
            document
              .querySelector<HTMLElement>("[data-side=main] [data-slot=page-scroller] .ProseMirror")
              ?.focus(),
          0,
        );
      }}
      onEdit={editTemplate}
      onDuplicate={duplicateTemplate}
      onDelete={deleteTemplate}
      onCreate={() => createTemplate(category)}
    />
  );
}
