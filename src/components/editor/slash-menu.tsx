import * as React from "react";
import { menuItem, menuLabel } from "@/components/ui/menu-parts";
import { popoverSurface } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { useMessages } from "@/lib/i18n";
import { groupSlashItems, slashGroupId, type SlashItem } from "./slash-items";

export type SlashMenuProps = {
  /** 걸러진 항목 (filterSlashItems 결과) */
  items: SlashItem[];
  /** 키보드로 고른 항목 (items 기준 번호) */
  activeIndex: number;
  /** `/` 뒤에 입력한 검색어 — 결과 없음 문구에 쓴다 */
  query: string;
  onSelect: (item: SlashItem) => void;
  /** 마우스를 올린 항목으로 선택을 옮긴다 */
  onActiveChange?: (index: number) => void;
  /** listbox id. 에디터의 aria-controls / aria-activedescendant가 가리킨다 */
  id?: string;
  className?: string;
};

export const slashOptionId = (listId: string, item: SlashItem) => `${listId}-${item.id}`;

/**
 * ED-SlashMenu의 목록 — 프로토타입 `.slash` (components.html §5).
 * 포커스는 에디터에 남고 방향키·Enter는 Suggestion이 넘겨준다(aria-activedescendant 패턴).
 */
export function SlashMenu({
  items,
  activeIndex,
  query,
  onSelect,
  onActiveChange,
  id = "slash-menu",
  className,
}: SlashMenuProps) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const m = useMessages();

  // 고른 항목이 늘 보이게 스크롤한다
  React.useEffect(() => {
    const active = items[activeIndex];
    if (!active) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `#${CSS.escape(slashOptionId(id, active))}`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, items, id]);

  return (
    <div
      ref={listRef}
      id={id}
      // 결과가 없으면 목록이 아니라 안내문이다
      role={items.length ? "listbox" : "status"}
      aria-label={m.editor.slash.menuLabel}
      data-slot="slash-menu"
      className={cn(popoverSurface, "max-h-95 w-80 overflow-y-auto overscroll-contain", className)}
    >
      {items.length === 0 ? (
        <p className="px-2 py-3 text-caption text-tertiary">{m.editor.slash.empty(query)}</p>
      ) : (
        groupSlashItems(items).map(({ group, items: groupItems }) => (
          <div key={group} role="group" aria-labelledby={`${id}-${group}`}>
            <p id={`${id}-${group}`} className={menuLabel}>
              {m.editor.slash.groups[slashGroupId(group)]}
            </p>
            {groupItems.map((item) => {
              const index = items.indexOf(item);
              const selected = index === activeIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  id={slashOptionId(id, item)}
                  role="option"
                  aria-selected={selected}
                  data-selected={selected}
                  // 에디터 포커스를 뺏지 않는다
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => !selected && onActiveChange?.(index)}
                  onClick={() => onSelect(item)}
                  className={cn(menuItem, "min-h-10.5 items-start py-1")}
                >
                  <span className="grid h-7.5 w-10 shrink-0 place-items-center rounded-md border border-line bg-subtle text-secondary">
                    <Icon strokeWidth={1.5} aria-hidden />
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="font-medium">{item.title}</span>
                    <span className="truncate text-label leading-relaxed text-tertiary">
                      {item.description}
                    </span>
                  </span>
                  {item.hint ? (
                    <span className="ml-2 shrink-0 self-center font-mono text-label text-tertiary">
                      {item.hint}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
