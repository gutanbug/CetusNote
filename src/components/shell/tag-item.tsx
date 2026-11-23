import { IconButton } from "@/components/ui/icon-button";
import type { SoftColor } from "@/components/ui/tag-chip";
import { cn } from "@/lib/utils";
import { Ellipsis } from "lucide-react";
import type * as React from "react";
import { insetFocus, revealOnRow, rowActive, rowBase } from "./parts";
import { TAG_DOT } from "./tag-dot";

type TagItemProps = Omit<React.ComponentProps<"button">, "children" | "color"> & {
  name: string;
  color?: SoftColor;
  /** 이 태그가 붙은 페이지 수 */
  count: number;
  /** 지금 이 태그 보기를 보고 있다 */
  active?: boolean;
  /**
   * 행의 ··· 메뉴. 주면 마우스를 올리거나 포커스가 오면 ···가 나타나고, 누르면 이 함수가 행 요소를 받는다
   * (메뉴는 행 아래에 붙고, 닫히면 포커스는 행으로 돌아간다). 우클릭·Shift+F10은 부르는 쪽이 따로 잇는다.
   */
  onMenu?: (row: HTMLElement) => void;
};

/**
 * SH-TagItem — 사이드바 태그 한 줄 (SHELL-07, 프로토타입 `#tagList .nav-item`).
 * 색 점 + 이름 + 개수. 누르면 태그 보기를 연다(부르는 쪽). onMenu를 주면 페이지 행과 같은 ···가 붙는다(SHELL-18).
 */
function TagItem({
  name,
  color = "gray",
  count,
  active,
  className,
  type = "button",
  onMenu,
  ...props
}: TagItemProps) {
  const row = (
    <button
      type={type}
      data-slot="tag-item"
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        rowBase,
        rowActive,
        "min-h-7.5 gap-2 px-2 py-1",
        insetFocus,
        onMenu ? "min-w-0 flex-1" : className,
      )}
      {...props}
    >
      <span aria-hidden className="grid size-4 shrink-0 place-items-center">
        <span className={cn("size-2 rounded-pill", TAG_DOT[color])} />
      </span>
      <span title={name} className="min-w-0 flex-1 truncate">
        {name}
      </span>
      <span className="shrink-0 text-label text-tertiary tabular-nums">
        <span className="sr-only">페이지 </span>
        {count}
        <span className="sr-only">개</span>
      </span>
    </button>
  );
  if (!onMenu) return row;
  return (
    <div data-slot="tag-row" className={cn("group/row flex w-full items-center", className)}>
      {row}
      <span className={cn("flex shrink-0 items-center pr-1", revealOnRow)}>
        <IconButton
          label={`${name} 태그 메뉴`}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            const row = e.currentTarget
              .closest<HTMLElement>('[data-slot="tag-row"]')
              ?.querySelector<HTMLElement>('[data-slot="tag-item"]');
            if (row) onMenu(row);
          }}
          className="[&_svg]:size-3.5"
        >
          <Ellipsis strokeWidth={1.5} />
        </IconButton>
      </span>
    </div>
  );
}

export { TagItem, type TagItemProps };
