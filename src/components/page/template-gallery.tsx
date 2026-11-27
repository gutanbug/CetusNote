import { insetFocus, rowActive, rowBase } from "@/components/shell/parts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeaderRow,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FileText, LayoutTemplate, Plus } from "lucide-react";
import * as React from "react";
import { rovingKey } from "./roving";
import type { PreviewNode } from "./doc-preview";
import { TemplateCard } from "./template-card";
import { useMessages } from "@/lib/i18n";

export type TemplateGalleryItem = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  /** 템플릿 본문 — 카드에 앞부분을 그린다 */
  doc: PreviewNode | null;
};
export type TemplateCategory = { id: string; name: string };

type TemplateGalleryProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: TemplateCategory[];
  category: string;
  onCategoryChange: (id: string) => void;
  /** 지금 분류의 템플릿 */
  items: TemplateGalleryItem[];
  onPick: (id: string) => void;
  /** 카드 ··· 메뉴 (PAGE-14). 없으면 메뉴를 달지 않는다 */
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** 지금 분류에 빈 템플릿을 만들어 편집한다 */
  onCreate?: () => void;
};

const ID = "template-gallery";

/**
 * PG-TemplateGallery — 왼쪽 분류 + 카드 그리드 (OpenDesign §17, 프로토타입 `.gallery` 880×560).
 * 분류는 세로 탭(↑↓로 바로 바뀐다), 카드는 차례로 떠오른다(rise, 30ms 간격·상한 300ms).
 */
function TemplateGallery({
  open,
  onOpenChange,
  categories,
  category,
  onCategoryChange,
  items,
  onPick,
  onEdit,
  onDuplicate,
  onDelete,
  onCreate,
}: TemplateGalleryProps) {
  const m = useMessages();
  const ids = categories.map((c) => c.id);
  const current = categories.find((c) => c.id === category);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size={null}
        data-slot="template-gallery"
        // 삭제 뒤 뜨는 실행 취소 토스트를 눌러도 갤러리가 닫히지 않게 한다
        onPointerDownOutside={(e) => {
          if (e.target instanceof Element && e.target.closest("[data-sonner-toaster]"))
            e.preventDefault();
        }}
        className="grid h-140 max-h-[calc(var(--fit-h)-var(--s16))] w-220 max-w-[calc(var(--fit-w)-var(--s8))] grid-cols-[calc(var(--spacing)*45)_minmax(0,1fr)] gap-0 overflow-hidden p-0"
      >
        <div className="grid content-start gap-0.5 border-r border-line bg-subtle px-2 py-4">
          <p
            aria-hidden
            className="px-2 pb-1 text-label font-semibold tracking-(--tracking-label) text-tertiary"
          >
            {m.page.category}
          </p>
          <div
            role="tablist"
            aria-label={m.page.gallery.list}
            aria-orientation="vertical"
            data-roving=""
            className="grid gap-0.5"
          >
            {categories.map((c) => {
              const active = c.id === category;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  id={`${ID}-tab-${c.id}`}
                  aria-controls={`${ID}-panel`}
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  data-value={c.id}
                  data-active={active || undefined}
                  onClick={() => onCategoryChange(c.id)}
                  onKeyDown={(e) => {
                    const next = rovingKey(e, ids, category, "vertical");
                    if (next) onCategoryChange(next);
                  }}
                  className={cn(rowBase, rowActive, "min-h-7.5 gap-2 px-2 py-1", insetFocus)}
                >
                  <FileText strokeWidth={1.5} aria-hidden className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)]">
          <DialogHeaderRow className="border-b border-line">
            <DialogTitle className="flex-1">
              {current ? m.page.gallery.titleWith(current.name) : m.page.gallery.title}
            </DialogTitle>
            {onCreate ? (
              <Button variant="ghost" size="sm" onClick={onCreate}>
                <Plus strokeWidth={1.5} aria-hidden />
                {m.page.newTemplate}
              </Button>
            ) : null}
            <DialogDescription className="sr-only">{m.page.gallery.description}</DialogDescription>
          </DialogHeaderRow>
          <div
            role="tabpanel"
            id={`${ID}-panel`}
            aria-labelledby={`${ID}-tab-${category}`}
            className="overflow-y-auto p-6"
          >
            <div
              // 분류를 바꾸면 카드가 다시 떠오른다
              key={category}
              className="grid grid-cols-[repeat(auto-fill,minmax(calc(var(--spacing)*60),1fr))] gap-4"
            >
              {items.map((t, i) => (
                <TemplateCard
                  key={t.id}
                  emoji={t.emoji}
                  name={t.name}
                  description={t.description}
                  doc={t.doc}
                  onPick={() => onPick(t.id)}
                  onEdit={onEdit && (() => onEdit(t.id))}
                  onDuplicate={onDuplicate && (() => onDuplicate(t.id))}
                  onDelete={onDelete && (() => onDelete(t.id))}
                  style={{ "--i": i } as React.CSSProperties}
                  className="animate-rise [animation-delay:calc(min(var(--i),10)*var(--dur-fast)/4)] [animation-fill-mode:backwards]"
                />
              ))}
            </div>
            {items.length ? null : (
              // 빈 분류: 가운데 정렬한 안내(20px 아이콘 · 글 · 새 템플릿 버튼)
              <div className="grid justify-items-center gap-3 py-12 text-center">
                <LayoutTemplate strokeWidth={1.5} aria-hidden className="size-5 text-tertiary" />
                <p className="text-caption text-tertiary">{m.page.gallery.empty}</p>
                {onCreate ? (
                  <Button variant="secondary" size="sm" onClick={onCreate}>
                    <Plus strokeWidth={1.5} aria-hidden />
                    {m.page.newTemplate}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { TemplateGallery, type TemplateGalleryProps };
