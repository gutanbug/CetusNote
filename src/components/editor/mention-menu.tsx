import { menuItem, menuLabel } from "@/components/ui/menu-parts";
import { popoverSurface } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import * as React from "react";
import type { MentionTarget } from "./page-mention";
import { PageIcon } from "@/components/ui/page-icon";
import { useMessages } from "@/lib/i18n";

export type MentionMenuProps = {
  items: MentionTarget[];
  activeIndex: number;
  /** `@` 뒤에 입력한 검색어 */
  query: string;
  onSelect: (item: MentionTarget) => void;
  onActiveChange?: (index: number) => void;
  id?: string;
  className?: string;
};

export const mentionOptionId = (listId: string, item: MentionTarget) => `${listId}-${item.id}`;

/**
 * ED-PageMention 제안 목록 — 슬래시 메뉴와 같은 표면(`.popover`). 포커스는 에디터에 남는다.
 * 검색어가 없으면 최근 페이지, 있으면 제목이 맞는 페이지.
 */
export function MentionMenu({
  items,
  activeIndex,
  query,
  onSelect,
  onActiveChange,
  id = "mention-menu",
  className,
}: MentionMenuProps) {
  const m = useMessages();
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const active = items[activeIndex];
    if (!active) return;
    listRef.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(mentionOptionId(id, active))}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, items, id]);

  return (
    <div
      ref={listRef}
      id={id}
      role={items.length ? "listbox" : "status"}
      aria-label={m.editor.mention.menuLabel}
      data-slot="mention-menu"
      className={cn(popoverSurface, "max-h-80 w-72 overflow-y-auto overscroll-contain", className)}
    >
      {items.length === 0 ? (
        <p className="px-2 py-3 text-caption text-tertiary">
          {query ? m.editor.mention.noMatch(query) : m.editor.mention.empty}
        </p>
      ) : (
        <>
          <p className={menuLabel} aria-hidden>
            {query ? m.editor.mention.pages : m.editor.mention.recent}
          </p>
          {items.map((item, index) => {
            const selected = index === activeIndex;
            return (
              <div
                key={item.id}
                id={mentionOptionId(id, item)}
                role="option"
                aria-selected={selected}
                data-selected={selected}
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => !selected && onActiveChange?.(index)}
                onClick={() => onSelect(item)}
                className={menuItem}
              >
                <span aria-hidden className="grid size-4 shrink-0 place-items-center leading-none">
                  {item.icon ? (
                    <PageIcon icon={item.icon} />
                  ) : (
                    <FileText strokeWidth={1.5} className="text-tertiary" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.title || m.editor.untitled}</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
