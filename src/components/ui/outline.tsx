import { cn } from "@/lib/utils";
import * as React from "react";
import { DropdownMenuItem, DropdownMenuLabel } from "./dropdown-menu";

export type OutlineEntry = { level: number; text: string };

type OutlineItemsProps = {
  headings: OutlineEntry[];
  /** 지금 보고 있는 제목 (없으면 -1) */
  current?: number;
  onSelect: (index: number) => void;
};

/** 가장 높은 제목 수준을 왼쪽 끝으로, 한 단계마다 한 칸씩 들인다 */
const INDENT = ["pl-2", "pl-6", "pl-10"] as const;

/**
 * OV-Outline — 목차 (PAGE-12). OV-Menu 안에 넣어 쓴다(↑↓ · Enter · 첫 글자로 이동은 메뉴가 한다).
 * 제목 수준만큼 들여 쓰고, 지금 보고 있는 제목은 포인트 색 글자로 표시한다.
 */
function OutlineItems({ headings, current = -1, onSelect }: OutlineItemsProps) {
  // 열면 지금 보고 있는 제목에서 시작한다(↑↓가 그 자리부터). 메뉴가 첫 항목을 잡은 뒤에 옮긴다
  const currentRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => currentRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);
  // 빈 메뉴는 항목이 하나는 있어야 한다(메뉴 역할) — 누를 수 없는 안내 항목
  if (!headings.length)
    return (
      <DropdownMenuItem disabled className="text-caption text-tertiary data-disabled:opacity-100">
        본문에 제목을 넣으면 여기에 보여요
      </DropdownMenuItem>
    );
  const top = Math.min(...headings.map((h) => h.level));
  return (
    <>
      <DropdownMenuLabel>목차</DropdownMenuLabel>
      {headings.map((h, i) => (
        <DropdownMenuItem
          key={i}
          ref={i === current ? currentRef : undefined}
          aria-current={i === current ? "location" : undefined}
          onSelect={() => onSelect(i)}
          className={cn(
            INDENT[Math.min(h.level - top, INDENT.length - 1)],
            h.level > top && "text-secondary",
            i === current && "font-medium text-accent",
          )}
        >
          {h.text}
        </DropdownMenuItem>
      ))}
    </>
  );
}

export { OutlineItems };
