import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import * as React from "react";
import { menuContent, menuItem } from "@/components/ui/menu-parts";
import { popoverSurface } from "@/components/ui/styles";
import { cn } from "@/lib/utils";

export type BlockMenuItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

export type BlockMenuProps = {
  /** 접근성 이름 (menu의 aria-label) */
  label: string;
  items: BlockMenuItem[];
  /** 메뉴를 붙일 블록의 사각형. 열린 동안 한 번 잰다 */
  anchor: () => DOMRect | null;
  onSelect: (id: string) => void;
  /** Esc·Tab·바깥 누름 — 호출한 쪽이 포커스를 에디터로 돌려준다 */
  onClose: () => void;
  className?: string;
};

/**
 * ED-BlockHandle의 키보드 메뉴 — 블록 핸들의 ＋·⋮⋮ 동작을 목록으로 연다(⌘/).
 * 열리면 첫 항목에 포커스가 간다. ↑↓·Home·End로 옮기고 Enter로 고른다. Esc는 닫고 캐럿으로 돌아간다.
 * 포커스 관리는 메뉴 자체가 한다(에디터에 aria-activedescendant를 달지 않는다).
 */
export function BlockMenu({ label, items, anchor, onSelect, onClose, className }: BlockMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // 블록 옆에 붙인다 (아래 왼쪽 정렬, 화면 밖이면 뒤집기·밀기)
  React.useLayoutEffect(() => {
    const floating = ref.current;
    if (!floating) return;
    const reference = { getBoundingClientRect: () => anchor() ?? new DOMRect() };
    void computePosition(reference, floating, {
      placement: "bottom-start",
      strategy: "fixed",
      middleware: [offset(4), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      Object.assign(floating.style, { left: `${x}px`, top: `${y}px` });
    });
  }, [anchor]);

  // 열리면 첫 항목으로 포커스를 옮긴다
  React.useEffect(() => {
    itemRefs.current[0]?.focus();
  }, []);

  // 메뉴 바깥을 누르면 닫는다
  React.useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [onClose]);

  const move = (to: number) => {
    const n = itemRefs.current.length;
    itemRefs.current[(to + n) % n]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowUp") move(i - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(itemRefs.current.length - 1);
    else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else return;
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      data-slot="block-menu"
      onKeyDown={onKeyDown}
      style={{ position: "fixed", left: 0, top: 0 }}
      className={cn(popoverSurface, menuContent, "z-50", className)}
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          type="button"
          role="menuitem"
          tabIndex={-1}
          data-slot="block-menu-item"
          className={menuItem}
          onClick={() => onSelect(item.id)}
        >
          {item.icon}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
