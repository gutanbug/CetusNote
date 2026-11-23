import { cn } from "@/lib/utils";
import { Check, ChevronRight } from "lucide-react";
import type * as React from "react";
import { menuItem } from "./styles";

// OV-Menu의 드롭다운·컨텍스트 메뉴가 함께 쓰는 항목 내부 배치.

export const menuContent = "min-w-55 max-w-85 outline-none";
export const menuItemDanger =
  "text-danger [&_svg]:text-danger hover:bg-danger-soft force-hover:bg-danger-soft focus:bg-danger-soft data-highlighted:bg-danger-soft";
export const menuLabel =
  "px-2 pt-2 pb-1 text-label font-semibold tracking-(--tracking-label) text-tertiary";
export const menuSeparator = "-mx-1 my-1 h-px bg-line";
export { menuItem };

/** 항목 안쪽: 아이콘 · 라벨(말줄임) · 오른쪽(단축키 등) */
export function MenuItemInner({
  icon,
  right,
  children,
}: {
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {right ? <span className="ml-2 shrink-0 text-label text-tertiary">{right}</span> : null}
    </>
  );
}

export function SubArrow() {
  return <ChevronRight strokeWidth={1.5} className="ml-auto" aria-hidden />;
}

export function CheckMark() {
  return <Check strokeWidth={1.5} className="text-accent!" aria-hidden />;
}

export const menuIndicatorSlot = "grid size-4 shrink-0 place-items-center";

export function cx(...c: Parameters<typeof cn>) {
  return cn(...c);
}
