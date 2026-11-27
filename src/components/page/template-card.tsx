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
import { useMessages } from "@/lib/i18n";

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
  const m = useMessages();
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
          {name || m.page.untitled}
        </span>
        <span className="text-caption text-secondary">{description}</span>
        {/* 줄 단위로 5줄까지만 — 아래 끝은 마스크로 흐려서 마지막 줄이 반쯤 잘리지 않게 한다 */}
        <DocPreview
          doc={doc}
          max={5}
          className="h-28 rounded-lg bg-subtle mask-b-from-70% mask-b-to-100% p-2.5"
        />
      </button>
      {hasMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              label={m.page.templateCard.menu(name || m.page.untitled)}
              // 숨은 동안(opacity-0)에도 자리를 차지하므로 카드 모서리 클릭을 가리지 않게 포인터 이벤트를 끈다. 키보드 포커스는 그대로 닿는다
              className="pointer-events-none absolute top-3 right-3 opacity-0 transition-opacity duration-(--dur-fast) group-focus-within/card:pointer-events-auto group-focus-within/card:opacity-100 group-hover/card:pointer-events-auto group-hover/card:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:bg-active data-[state=open]:text-primary data-[state=open]:opacity-100 force-hover:pointer-events-auto force-hover:opacity-100"
            >
              <Ellipsis {...ic} />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {onEdit ? (
              <DropdownMenuItem icon={<Pencil {...ic} />} onSelect={onEdit}>
                {m.page.templateCard.edit}
              </DropdownMenuItem>
            ) : null}
            {onDuplicate ? (
              <DropdownMenuItem icon={<Copy {...ic} />} onSelect={onDuplicate}>
                {m.page.templateCard.duplicate}
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
              <>
                {onEdit || onDuplicate ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem variant="danger" icon={<Trash2 {...ic} />} onSelect={onDelete}>
                  {m.page.templateCard.delete}
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
