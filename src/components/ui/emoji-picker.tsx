import { cn } from "@/lib/utils";
import {
  EmojiPicker as Picker,
  type EmojiPickerListCategoryHeaderProps,
  type EmojiPickerListEmojiProps,
  type EmojiPickerListRowProps,
} from "frimousse";
import { Shuffle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { inputClass } from "./input";
import { focusRing } from "./styles";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * 이모지 데이터는 앱이 직접 제공한다(오프라인). vite.config.ts의 emojibaseLocal 플러그인이
 * `emojibase-data` 패키지의 한국어 데이터를 이 경로로 내보낸다.
 */
const EMOJIBASE_URL = `${import.meta.env.BASE_URL}emojibase-data`;

/** 고른 이모지. 이름(label)은 최근 목록에서 읽어 줄 때 쓴다 */
type PickedEmoji = { emoji: string; label: string };

type EmojiPickerProps = {
  onSelect: (picked: PickedEmoji) => void;
  /** 최근에 쓴 이모지(최신순). 저장은 부르는 쪽이 한다 */
  recent?: PickedEmoji[];
  /** 무작위 버튼으로 고른 이모지 (없으면 onSelect). 창을 닫지 않고 다시 누를 수 있게 할 때 */
  onRandom?: (picked: PickedEmoji) => void;
  /** 주면 "제거" 버튼을 보여 준다(페이지 아이콘 등) */
  onRemove?: () => void;
  className?: string;
};

const COLUMNS = 8;

type RawEmoji = { emoji: string; label: string; group?: number; skins?: RawEmoji[] };

/** 이모지 데이터 — 무작위·최근 이름에 쓸 때 한 번만 읽는다 */
let data: Promise<RawEmoji[]> | undefined;
function emojiData(): Promise<RawEmoji[]> {
  data ??= fetch(`${EMOJIBASE_URL}/ko/data.json`).then((r) => r.json() as Promise<RawEmoji[]>);
  data.catch(() => (data = undefined));
  return data;
}

/** 무작위 이모지 (구성 요소 그룹 2는 뺀다) */
function randomEmoji(): Promise<PickedEmoji | undefined> {
  return emojiData().then((all) => {
    const pool = all.filter((e) => e.group !== undefined && e.group !== 2);
    const e = pool[Math.floor(Math.random() * pool.length)];
    return e && { emoji: e.emoji, label: e.label };
  });
}

/** 이름 없이 넘어온 최근 이모지(이름 = 이모지 글자)에 한국어 이름을 붙인다 */
function useEmojiNames(recent: PickedEmoji[] | undefined): PickedEmoji[] | undefined {
  const needs = recent?.some((r) => r.label === r.emoji) ?? false;
  const [names, setNames] = useState<Map<string, string>>();
  useEffect(() => {
    if (!needs || names) return;
    let alive = true;
    emojiData().then(
      (all) => {
        const map = new Map<string, string>();
        for (const e of all) {
          map.set(e.emoji, e.label);
          for (const s of e.skins ?? []) map.set(s.emoji, s.label);
        }
        if (alive) setNames(map);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [needs, names]);
  if (!recent || !names) return recent;
  return recent.map((r) =>
    r.label === r.emoji ? { ...r, label: names.get(r.emoji) ?? r.label } : r,
  );
}

/** frimousse는 aria-rowindex/colindex를 0부터 매긴다. ARIA는 1부터라 하나 올린다(axe aria-valid-attr-value). */
function ariaIndex(value: unknown) {
  return typeof value === "number"
    ? value + 1
    : value === undefined
      ? undefined
      : Number(value) + 1;
}

function CategoryHeader({ category, className, ...props }: EmojiPickerListCategoryHeaderProps) {
  return (
    <div
      className={cn("bg-elevated px-3 pt-3 pb-1 text-label font-medium text-tertiary", className)}
      {...props}
    >
      {category.label}
    </div>
  );
}

function Row({ children, className, ...props }: EmojiPickerListRowProps) {
  return (
    <div
      className={cn("scroll-my-1 px-2", className)}
      {...props}
      aria-rowindex={ariaIndex(props["aria-rowindex"])}
    >
      {children}
    </div>
  );
}

function EmojiButton({ emoji, className, ...props }: EmojiPickerListEmojiProps) {
  return (
    <button
      className={cn(
        "grid size-8 place-items-center rounded-md text-h3 leading-none",
        // 키보드로 고르는 중(목록이나 검색창에 키보드 포커스)이면 현재 이모지에 포커스 링을 준다
        emoji.isActive &&
          "bg-hover group-has-focus-visible/picker:outline-2 group-has-focus-visible/picker:-outline-offset-2 group-has-focus-visible/picker:outline-accent group-has-focus-visible/picker:outline-solid",
        focusRing,
        className,
      )}
      {...props}
      aria-colindex={ariaIndex(props["aria-colindex"])}
    >
      {emoji.emoji}
    </button>
  );
}

/**
 * OV-EmojiPicker — 검색 · 최근 · 카테고리. frimousse(헤드리스) + 토큰 스타일.
 * 팝오버 안에 넣어 쓴다(`<PopoverContent className="p-0">`).
 */
function EmojiPicker({
  onSelect,
  onRandom = onSelect,
  recent: given,
  onRemove,
  className,
}: EmojiPickerProps) {
  const [query, setQuery] = useState("");
  const recent = useEmojiNames(given);
  const showRecent = !query && recent && recent.length > 0;

  return (
    <Picker.Root
      data-slot="emoji-picker"
      locale="ko"
      columns={COLUMNS}
      emojibaseUrl={EMOJIBASE_URL}
      onEmojiSelect={(e) => onSelect({ emoji: e.emoji, label: e.label })}
      className={cn("group/picker isolate flex h-90 w-74 flex-col text-primary", className)}
    >
      <div className="flex items-center gap-2 p-2">
        <Picker.Search
          aria-label="이모지 검색"
          placeholder="이모지 검색…"
          className={cn(inputClass, "min-h-8 flex-1")}
          onChange={(e) => setQuery(e.target.value)}
        />
        <IconButton
          label="무작위 이모지"
          size="md"
          onClick={() =>
            void randomEmoji().then(
              (e) => e && onRandom(e),
              () => {},
            )
          }
        >
          <Shuffle strokeWidth={1.5} />
        </IconButton>
        <Tooltip>
          <TooltipTrigger asChild>
            <Picker.SkinToneSelector
              aria-label="피부색 바꾸기"
              emoji="👋"
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-pill text-body leading-none hover:bg-hover force-hover:bg-hover",
                focusRing,
              )}
            />
          </TooltipTrigger>
          <TooltipContent>피부색 바꾸기</TooltipContent>
        </Tooltip>
        {onRemove ? (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            제거
          </Button>
        ) : null}
      </div>

      {showRecent ? (
        <div className="px-2">
          <div className="px-1 pb-1 text-label font-medium text-tertiary">최근</div>
          <div role="group" aria-label="최근 쓴 이모지" className="flex flex-wrap">
            {recent.slice(0, COLUMNS).map((r) => (
              <button
                key={r.emoji}
                type="button"
                aria-label={r.label}
                onClick={() => onSelect(r)}
                className={cn(
                  "grid size-8 place-items-center rounded-md text-h3 leading-none hover:bg-hover force-hover:bg-hover",
                  focusRing,
                )}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 목록에 Tab으로 들어오면 아직 고른 이모지가 없다 — 목록 자체에 안쪽 링 */}
      <Picker.Viewport className="relative min-h-0 flex-1 rounded-md outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid">
        <Picker.Loading className="absolute inset-0 grid place-items-center text-caption text-tertiary">
          이모지를 불러오는 중…
        </Picker.Loading>
        <Picker.Empty className="absolute inset-0 grid place-items-center px-6 text-center text-caption text-tertiary">
          {({ search }) => `“${search}”에 맞는 이모지가 없어요.`}
        </Picker.Empty>
        <Picker.List
          className="pb-2 select-none"
          components={{ CategoryHeader, Row, Emoji: EmojiButton }}
        />
      </Picker.Viewport>

      <div className="flex h-9 items-center gap-2 border-t border-line px-3">
        <Picker.ActiveEmoji>
          {({ emoji }) =>
            emoji ? (
              <>
                <span className="text-h3 leading-none">{emoji.emoji}</span>
                <span className="truncate text-caption text-secondary">{emoji.label}</span>
              </>
            ) : (
              <span className="text-caption text-tertiary">이모지를 골라 주세요</span>
            )
          }
        </Picker.ActiveEmoji>
      </div>
    </Picker.Root>
  );
}

export { EmojiPicker, type EmojiPickerProps, type PickedEmoji };
