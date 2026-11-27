import { cn } from "@/lib/utils";
import type { ShortcodeItem } from "@/lib/emoji/shortcodes";
import * as React from "react";
import { EmojiPicker, type PickedEmoji } from "@/components/ui/emoji-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMessages } from "@/lib/i18n";

export type EmojiInlinePopoverProps = {
  /** 트리거 (보통 버튼). asChild로 감싼다 */
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 고르면 호출된다. 본문에는 글자로 넣는다(노드 아님) — 넣는 일은 부르는 쪽이 한다 */
  onSelect: (picked: PickedEmoji) => void;
  /** 최근에 쓴 이모지 (최신순). 저장은 부르는 쪽이 한다 */
  recent?: PickedEmoji[];
  /** 닫힌 뒤 포커스 — 보통 편집기로 돌려보낸다 */
  onCloseAutoFocus?: (e: Event) => void;
};

/**
 * ED-EmojiInline — 본문에 이모지를 넣는 피커 팝오버.
 * 슬래시 「이모지」에서 연다. 고르면 그 글자를 캐럿 자리에 넣고 닫힌다.
 * 키보드: 트리거에서 Enter → 검색창에 포커스 → 방향키로 이모지 이동 → Enter로 고르기.
 */
function EmojiInlinePopover({
  children,
  open,
  onOpenChange,
  onSelect,
  recent,
  onCloseAutoFocus,
}: EmojiInlinePopoverProps) {
  const m = useMessages();
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        aria-label={m.editor.emoji.insert}
        align="start"
        className="w-auto max-w-none p-0"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <EmojiPicker
          recent={recent}
          onSelect={(picked) => {
            onSelect(picked);
            onOpenChange(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export type EmojiShortcodeMenuProps = {
  /** 콜론 뒤에 입력한 이름으로 고른 후보 (matchShortcodes 결과) */
  items: readonly ShortcodeItem[];
  /** 활성 항목 인덱스. -1이면 없음 */
  activeIndex: number;
  onActiveChange?: (index: number) => void;
  onSelect: (item: ShortcodeItem) => void;
  /** 목록 id — 입력창의 aria-controls·aria-activedescendant와 맞춘다 */
  id: string;
  className?: string;
};

/**
 * ED-EmojiInline의 `:` 단축 코드 제안 목록. 표시만 한다 — 키 처리(위·아래·Enter·Esc)는 부르는 쪽이
 * nextActiveIndex로 한다. 포커스는 편집기(또는 입력창)에 남는다.
 * 항목 id는 `${id}-${index}`이고, aria-activedescendant로 가리킨다.
 */
function EmojiShortcodeMenu({
  items,
  activeIndex,
  onActiveChange,
  onSelect,
  id,
  className,
}: EmojiShortcodeMenuProps) {
  const m = useMessages();
  if (items.length === 0) return null;
  return (
    <div
      id={id}
      role="listbox"
      aria-label={m.editor.emoji.suggestions}
      data-slot="emoji-shortcode-menu"
      className={cn(
        "z-50 grid w-60 gap-0.5 rounded-lg bg-elevated p-1 text-body text-primary shadow-popover",
        className,
      )}
    >
      {items.map((item, i) => {
        const active = i === activeIndex;
        return (
          <div
            key={item.code}
            id={`${id}-${i}`}
            role="option"
            aria-selected={active}
            // 마우스가 지나가면 활성 항목을 옮긴다(클릭은 onMouseDown으로 — 편집기 포커스를 뺏지 않게)
            onMouseEnter={() => onActiveChange?.(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item);
            }}
            className={cn(
              "flex min-h-7.5 cursor-default items-center gap-2 rounded-md px-2 py-1 select-none",
              active ? "bg-hover" : "hover:bg-hover",
              active && "outline-2 -outline-offset-2 outline-accent outline-solid",
            )}
          >
            <span className="grid size-6 place-items-center text-h3 leading-none" aria-hidden>
              {item.emoji}
            </span>
            <span className="truncate text-ui text-primary">{item.label}</span>
            <span className="ml-auto font-mono text-label text-tertiary">:{item.code}</span>
          </div>
        );
      })}
    </div>
  );
}

export { EmojiInlinePopover, EmojiShortcodeMenu };
