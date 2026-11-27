import { Bell, Clock, Repeat, Timer, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { useMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** 빠른 입력 창(QN-03)의 입력 바. 순수 UI — 저장·알림·검색은 화면(screens/quick)이 props로 넘긴다 */

export type QuickChip = { text: string; kind: "alarm" | "timer" | "repeat" };
export type QuickPreset = { id: string; label: string };
export type QuickResult = {
  id: string;
  title: string;
  path: string;
  /** 제목에서 검색어가 맞은 범위 [시작, 끝) */
  highlight: [number, number][];
};
export type QuickTimer = { id: string; label: string; left: string };
export type QuickUpcoming = { id: string; label: string; when: string };

export type QuickInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  /** Enter: 메모 저장(note), ⌘Enter: 새 페이지(page) */
  onSubmit: (mode: "note" | "page") => void;
  onEscape: () => void;
  chip: QuickChip | null;
  onClearChip: () => void;
  presets: QuickPreset[];
  onPreset: (id: string) => void;
  results: QuickResult[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onOpenResult: (id: string) => void;
  onAttachResult: (id: string) => void;
  timers: QuickTimer[];
  onStopTimer: (id: string) => void;
  upcoming: QuickUpcoming[];
  /** 저장 뒤 짧은 확인 문구. 있으면 힌트 줄 대신 보인다 */
  confirmation: string | null;
};

const LIST_ID_SUFFIX = "results";

function Highlighted({ text, ranges }: { text: string; ranges: [number, number][] }) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([s, e], i) => {
    if (s > cursor) parts.push(text.slice(cursor, s));
    parts.push(
      <mark key={i} className="bg-transparent font-medium text-accent">
        {text.slice(s, e)}
      </mark>,
    );
    cursor = e;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function QuickInput(props: QuickInputProps) {
  const m = useMessages().screens.quickInput;
  const { chip, results, activeIndex } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const listId = `${uid}-${LIST_ID_SUFFIX}`;
  const showResults = results.length > 0;
  const activeId = showResults && activeIndex >= 0 ? `${uid}-r${activeIndex}` : undefined;
  const isEmpty = props.value.trim() === "";
  const ChipIcon = chip?.kind === "timer" ? Timer : chip?.kind === "repeat" ? Repeat : Clock;

  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    bellRef.current?.focus();
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (menuOpen) closeMenu();
      else props.onEscape();
      return;
    }
    if (e.key === "ArrowDown" && showResults) {
      e.preventDefault();
      props.onActiveIndexChange(Math.min(activeIndex + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && showResults) {
      e.preventDefault();
      props.onActiveIndexChange(Math.max(activeIndex - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const selected = showResults && activeIndex >= 0 ? results[activeIndex] : undefined;
      if (selected && !(e.metaKey || e.ctrlKey)) props.onOpenResult(selected.id);
      else props.onSubmit(e.metaKey || e.ctrlKey ? "page" : "note");
    }
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    }
  };

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl bg-elevated shadow-modal">
      <div className="flex h-18 items-center gap-3 px-4">
        <span aria-hidden className="size-5 shrink-0 rounded-full bg-accent" />
        <input
          type="text"
          role="combobox"
          aria-label={m.label}
          aria-expanded={showResults}
          aria-controls={showResults ? listId : undefined}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          placeholder={m.placeholder}
          value={props.value}
          onChange={(e) => props.onValueChange(e.target.value)}
          onKeyDown={onInputKey}
          className="min-w-0 flex-1 bg-transparent text-lg text-primary placeholder:text-tertiary focus-visible:outline-none"
        />
        {chip ? (
          <span className="flex shrink-0 items-center gap-1 rounded-pill bg-accent-soft py-1 pr-1 pl-2.5 text-sm text-accent">
            <ChipIcon aria-hidden className="size-3.5" strokeWidth={1.5} />
            <span>{chip.text}</span>
            <IconButton
              label={m.chipIgnore}
              onClick={props.onClearChip}
              className="size-5 rounded-pill text-accent hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent force-hover:bg-hover"
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </IconButton>
          </span>
        ) : null}
        <div className="relative shrink-0">
          <IconButton
            ref={bellRef}
            label={m.alarmButton}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="size-8 rounded-md text-secondary hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent force-hover:bg-hover"
          >
            <Bell className="size-4" strokeWidth={1.5} />
          </IconButton>
          {menuOpen ? (
            <div
              ref={menuRef}
              role="menu"
              aria-label={m.menuLabel}
              onKeyDown={onMenuKey}
              className="absolute top-full right-0 z-10 mt-2 flex w-56 flex-col rounded-lg bg-elevated p-1 shadow-popover"
            >
              {props.presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    props.onPreset(p.id);
                  }}
                  className="flex h-8 items-center rounded-md px-2.5 text-left text-sm text-primary hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none force-hover:bg-hover"
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {showResults ? (
        // 알림 붙이기 버튼은 listbox 밖의 열로 둔다(listbox 자식은 option만 허용). 행 높이를 맞춘다
        <div className="flex border-t border-subtle p-1.5">
          <ul
            id={listId}
            role="listbox"
            aria-label={m.resultsLabel}
            className="flex min-w-0 flex-1 flex-col"
          >
            {results.map((r, i) => (
              <li
                key={r.id}
                id={`${uid}-r${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => props.onOpenResult(r.id)}
                onMouseEnter={() => props.onActiveIndexChange(i)}
                className={cn(
                  "flex h-11 min-w-0 cursor-default items-center gap-2 rounded-md px-2.5",
                  i === activeIndex ? "bg-active" : "hover:bg-hover force-hover:bg-hover",
                )}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-primary">
                  <Highlighted text={r.title} ranges={r.highlight} />
                </span>
                <span className="max-w-[45%] min-w-0 truncate text-xs text-tertiary">{r.path}</span>
              </li>
            ))}
          </ul>
          {chip ? (
            <div className="flex shrink-0 flex-col pl-1" aria-hidden={false}>
              {results.map((r) => (
                <IconButton
                  key={r.id}
                  label={m.attach}
                  tabIndex={-1}
                  onClick={() => props.onAttachResult(r.id)}
                  className="h-11 w-8 justify-center rounded-md text-secondary hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent force-hover:bg-hover"
                >
                  <Bell className="size-3.5" strokeWidth={1.5} />
                </IconButton>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {isEmpty && (props.timers.length > 0 || props.upcoming.length > 0) ? (
        <div className="flex flex-col gap-2 border-t border-subtle p-3">
          {props.timers.length > 0 ? (
            <section aria-label={m.timersTitle} className="flex flex-col gap-0.5">
              <h2 className="px-1 pb-1 text-xs text-tertiary">{m.timersTitle}</h2>
              {props.timers.map((t) => (
                <div key={t.id} className="flex h-9 items-center gap-2 rounded-md px-2 text-sm">
                  <Timer aria-hidden className="size-3.5 text-secondary" strokeWidth={1.5} />
                  <span className="min-w-0 flex-1 truncate text-primary">{t.label}</span>
                  <span className="font-mono text-secondary tabular-nums" aria-live="off">
                    {t.left}
                  </span>
                  <button
                    type="button"
                    onClick={() => props.onStopTimer(t.id)}
                    className="rounded-md px-2 py-1 text-xs text-secondary hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none force-hover:bg-hover"
                  >
                    {m.stopTimer}
                  </button>
                </div>
              ))}
            </section>
          ) : null}
          {props.upcoming.length > 0 ? (
            <section aria-label={m.upcomingTitle} className="flex flex-col gap-0.5">
              <h2 className="px-1 pb-1 text-xs text-tertiary">{m.upcomingTitle}</h2>
              {props.upcoming.map((u) => (
                <div key={u.id} className="flex h-9 items-center gap-2 rounded-md px-2 text-sm">
                  <Clock aria-hidden className="size-3.5 text-secondary" strokeWidth={1.5} />
                  <span className="min-w-0 flex-1 truncate text-primary">{u.label}</span>
                  <span className="text-secondary">{u.when}</span>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-subtle px-4 py-2 text-xs text-tertiary" role="status">
        {props.confirmation ?? m.hint}
      </div>
    </div>
  );
}
