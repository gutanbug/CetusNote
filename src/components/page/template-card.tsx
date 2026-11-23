import { DocPreview, type PreviewNode } from "@/components/page/doc-preview";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { focusRing, press } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { Copy, Ellipsis, Pencil, Trash2 } from "lucide-react";
import type * as React from "react";

const ic = { strokeWidth: 1.5, "aria-hidden": true } as const;

type TemplateCardProps = {
  emoji: string;
  name: string;
  description: string;
  /** 템플릿 본문 (Tiptap JSON) — 앞부분을 작게 그린다 (PG-DocPreview) */
  doc: PreviewNode | null | undefined;
  onPick: () => void;
  /** 있으면 ··· 메뉴를 단다 (PAGE-14) */
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * PG-TemplateCard — 이모지 · 이름 · 설명 · 본문 미리보기 (OpenDesign §17, 프로토타입 `.tpl-card`).
 * 카드 전체가 고르는 버튼이고, 오른쪽 위 ··· 메뉴(편집 · 복제 · 삭제)는 그 옆 형제 버튼이다.
 * ··· 메뉴는 카드에 마우스가 올라가거나 카드 안에 키보드 포커스가 있거나 메뉴가 열려 있을 때만 보인다(숨김은 opacity라 Tab은 그대로 닿는다).
 */
function TemplateCard({
  emoji,
  name,
  description,
  doc,
  onPick,
  onEdit,
  onDuplicate,
  onDelete,
  className,
  style,
}: TemplateCardProps) {
  const hasMenu = !!(onEdit || onDuplicate || onDelete);
  return (
    <div data-slot="template-card" className={cn("group/card relative", className)} style={style}>
      <button
        type="button"
        data-press=""
        onClick={onPick}
        className={cn(
          "grid size-full grid-rows-[auto_auto_auto_1fr] gap-2 rounded-lg border border-line p-4 text-left",
          "transition-colors duration-(--dur-fast) ease-(--ease) hover:bg-hover force-hover:bg-hover",
          focusRing,
          press,
        )}
      >
        <span aria-hidden className="text-h3 leading-none">
          {emoji || "📄"}
        </span>
        <span className={cn("text-ui font-semibold text-primary", hasMenu && "pr-6")}>
          {name || "제목 없음"}
        </span>
        <span className="text-caption text-secondary">{description}</span>
        <DocPreview doc={doc} className="h-28 rounded-lg bg-subtle p-2.5" />
      </button>
      {hasMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              label={`${name || "제목 없음"} 템플릿 메뉴`}
              className="absolute top-3 right-3 opacity-0 transition-opacity duration-(--dur-fast) group-focus-within/card:opacity-100 group-hover/card:opacity-100 data-[state=open]:bg-active data-[state=open]:text-primary data-[state=open]:opacity-100 force-hover:opacity-100"
            >
              <Ellipsis {...ic} />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {onEdit ? (
              <DropdownMenuItem icon={<Pencil {...ic} />} onSelect={onEdit}>
                편집
              </DropdownMenuItem>
            ) : null}
            {onDuplicate ? (
              <DropdownMenuItem icon={<Copy {...ic} />} onSelect={onDuplicate}>
                복제
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
              <>
                {onEdit || onDuplicate ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem variant="danger" icon={<Trash2 {...ic} />} onSelect={onDelete}>
                  삭제
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export { TemplateCard, type TemplateCardProps };
