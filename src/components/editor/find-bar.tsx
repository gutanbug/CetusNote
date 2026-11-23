import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { ChevronDown, ChevronRight, ChevronUp, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { inputClass } from "@/components/ui/input";
import { popoverSurface } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import {
  closeFind,
  getFind,
  MAX_MATCHES,
  moveFind,
  replaceAll,
  replaceCurrent,
  setFindQuery,
} from "./find-replace";

export type FindBarProps = {
  editor: Editor;
  /** 처음에 바꾸기 칸까지 열지 (⌥⌘F) */
  replace?: boolean;
  /** 열 때 채울 검색어 (본문에서 고른 글자) */
  initialQuery?: string;
  /** 닫기 (Esc · × 버튼). 부르는 쪽이 막대를 내린다 */
  onClose: () => void;
  /** 바뀌면 찾기 칸(또는 바꾸기 칸)으로 다시 포커스 — ⌘F를 또 눌렀을 때 */
  focusSignal?: number;
  /** 모두 바꾼 뒤 알림 (몇 개) */
  onReplacedAll?: (count: number) => void;
  className?: string;
};

/** UI-Input 모양 그대로 (검색 칸이라 자동 완성·맞춤법 밑줄은 끈다) */
const fieldProps = {
  // 격자 가운데 열을 채우고, 버튼과 같은 28px(h-7) 높이로 맞춘다
  className: cn(inputClass, "col-start-2 h-7 min-h-7"),
  autoComplete: "off",
  spellCheck: false,
  enterKeyHint: "search",
} as const;

/**
 * ED-FindBar (EDIT-25) — 페이지 안 찾기·바꾸기 막대. ⌘F 찾기, ⌥⌘F 바꾸기.
 * Enter 다음 · ⇧Enter 이전 · Esc 닫기(지금 결과를 본문에서 골라 두고 본문으로).
 * 대소문자는 가리지 않는다. 결과 표시는 find-replace.ts가 본문에 칠한다.
 */
export function FindBar({
  editor,
  replace: replaceOpen = false,
  initialQuery = "",
  onClose,
  focusSignal,
  onReplacedAll,
  className,
}: FindBarProps) {
  const [query, setQuery] = React.useState(initialQuery);
  // 바꾸기 칸: 막대를 연 방식(⌘F · ⌥⌘F)을 따르고, 펼침 버튼을 누르면 그 열기 동안만 덮어쓴다
  const [toggled, setToggled] = React.useState<{ signal?: number; open: boolean } | null>(null);
  const replacing = toggled && toggled.signal === focusSignal ? toggled.open : replaceOpen;
  const [replacement, setReplacement] = React.useState("");
  const findRef = React.useRef<HTMLInputElement>(null);
  const replaceRef = React.useRef<HTMLInputElement>(null);
  const editable = editor.isEditable;

  const { count, index } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const s = getFind(e.state);
      return { count: s.matches.length, index: s.index };
    },
  });

  // ⌘F를 다시 누르면(이미 열려 있어도) 찾기 칸으로, ⌥⌘F면 바꾸기 칸까지
  React.useEffect(() => {
    const input = replaceOpen && editable ? replaceRef.current : findRef.current;
    input?.focus();
    input?.select();
  }, [replaceOpen, editable, focusSignal]);

  // 검색어 → 본문 표시. 닫히면 표시를 지운다
  React.useEffect(() => {
    if (!editor.isDestroyed) setFindQuery(editor, query);
  }, [editor, query]);
  React.useEffect(
    () => () => {
      if (!editor.isDestroyed && getFind(editor.state).query) closeFind(editor);
    },
    [editor],
  );

  // 지금 결과가 보이게
  React.useEffect(() => {
    if (index < 0 || editor.isDestroyed) return;
    editor.view.dom
      .querySelector(".sn-find-current")
      ?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [editor, index, count]);

  const close = (select: boolean) => {
    if (!editor.isDestroyed) {
      closeFind(editor, { select });
      if (select) editor.view.focus();
    }
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    }
  };

  const status = !query
    ? ""
    : count === 0
      ? "결과 없음"
      : `${index + 1}/${count}${count >= MAX_MATCHES ? "+" : ""}`;

  return (
    // 찾기·바꾸기 두 줄을 한 격자에 올려 입력 칸 폭과 줄 맞춤을 같게 한다 (입력 칸 = 가운데 열)
    <div
      role="search"
      aria-label="페이지에서 찾기"
      data-slot="find-bar"
      onKeyDown={onKeyDown}
      className={cn(
        popoverSurface,
        "grid w-88 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 p-1.5",
        className,
      )}
    >
      {editable ? (
        <IconButton
          label={replacing ? "바꾸기 닫기" : "바꾸기 열기"}
          shortcut={replacing ? undefined : "⌥⌘F"}
          aria-expanded={replacing}
          onClick={() => setToggled({ signal: focusSignal, open: !replacing })}
          className="size-7"
        >
          {replacing ? <ChevronDown strokeWidth={1.5} /> : <ChevronRight strokeWidth={1.5} />}
        </IconButton>
      ) : null}
      <input
        ref={findRef}
        aria-label="찾을 글자"
        placeholder="찾기"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          moveFind(editor, e.shiftKey ? -1 : 1);
        }}
        {...fieldProps}
      />
      <div className="col-start-3 flex items-center gap-1">
        <span
          aria-live="polite"
          className="w-16 shrink-0 text-center text-caption text-tertiary tabular-nums"
        >
          {status}
        </span>
        <IconButton
          label="이전 결과"
          shortcut="⇧Enter"
          disabled={count === 0}
          onClick={() => moveFind(editor, -1)}
          className="size-7"
        >
          <ChevronUp strokeWidth={1.5} />
        </IconButton>
        <IconButton
          label="다음 결과"
          shortcut="Enter"
          disabled={count === 0}
          onClick={() => moveFind(editor, 1)}
          className="size-7"
        >
          <ChevronDown strokeWidth={1.5} />
        </IconButton>
        <IconButton
          label="찾기 닫기"
          shortcut="Esc"
          onClick={() => close(false)}
          className="size-7"
        >
          <X strokeWidth={1.5} />
        </IconButton>
      </div>
      {replacing && editable ? (
        <>
          <input
            ref={replaceRef}
            aria-label="바꿀 글자"
            placeholder="바꿀 내용"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
              e.preventDefault();
              replaceCurrent(editor, replacement);
            }}
            {...fieldProps}
            enterKeyHint="done"
          />
          <div className="col-start-3 flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={count === 0}
              onClick={() => replaceCurrent(editor, replacement)}
            >
              바꾸기
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={count === 0}
              onClick={() => onReplacedAll?.(replaceAll(editor, replacement))}
            >
              모두 바꾸기
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
