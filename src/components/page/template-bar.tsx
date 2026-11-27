import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { LayoutTemplate } from "lucide-react";
import { useMessages } from "@/lib/i18n";

type TemplateBarProps = {
  categories: { id: string; name: string }[];
  category: string;
  onCategoryChange: (id: string) => void;
  /** 갤러리 카드 설명 */
  description: string;
  onDescriptionChange: (value: string) => void;
  /** 적용한 새 문서의 제목 ({{date}} = 오늘 날짜) */
  pageTitle: string;
  onPageTitleChange: (value: string) => void;
  /** 편집을 마치고 갤러리로 */
  onDone: () => void;
  className?: string;
};

/**
 * PG-TemplateBar — 템플릿 편집 띠 (PAGE-14). 템플릿 문서를 열면 상단 바 아래에 붙는다.
 * 페이지 제목·아이콘·본문은 평소처럼 고치고, 여기서는 갤러리 분류·카드 설명·새 문서 제목을 고친다.
 */
function TemplateBar({
  categories,
  category,
  onCategoryChange,
  description,
  onDescriptionChange,
  pageTitle,
  onPageTitleChange,
  onDone,
  className,
}: TemplateBarProps) {
  const m = useMessages();
  return (
    <div
      role="region"
      aria-label={m.page.templateBar.edit}
      data-slot="template-bar"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-subtle px-6 py-2",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-caption font-semibold text-accent">
        <LayoutTemplate strokeWidth={1.5} aria-hidden className="size-4" />
        {m.page.templateBar.editing}
      </span>
      <Segmented
        label={m.page.category}
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        value={category}
        onValueChange={onCategoryChange}
      />
      <Input
        aria-label={m.page.templateBar.cardDescription}
        placeholder={m.page.templateBar.cardDescription}
        value={description}
        maxLength={120}
        onChange={(e) => onDescriptionChange(e.target.value)}
        className="min-h-7 w-56 flex-none text-caption"
      />
      <Input
        aria-label={m.page.templateBar.newPageTitle}
        placeholder={m.page.templateBar.newPageTitlePlaceholder}
        value={pageTitle}
        maxLength={120}
        onChange={(e) => onPageTitleChange(e.target.value)}
        className="min-h-7 w-64 flex-none text-caption"
      />
      <Button size="sm" variant="secondary" onClick={onDone} className="ml-auto">
        {m.page.templateBar.done}
      </Button>
    </div>
  );
}

export { TemplateBar, type TemplateBarProps };
