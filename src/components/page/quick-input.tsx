import { Bell, Check, Clock, Repeat, Timer, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Kbd } from "@/components/ui/kbd";
import { IconButton } from "@/components/ui/icon-button";
import { useMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** 빠른 입력 창(QN-03)의 입력 바. 순수 UI — 저장·알림·검색은 화면(screens/quick)이 props로 넘긴다 */

export type QuickPreview = {
  kind: "alarm" | "timer" | "repeat";
  /** 「오후 3:01에 알림」 「25분 타이머」 「매일 오전 9:00」 */
  primary: string;
  /** 「1분 뒤」 「내일 오전 9:00」. 타이머는 없다 */
  relative: string | null;
};
export type QuickSuccess = { title: string; detail: string };
export type QuickPreset = { id: string; label: string };
export type QuickResult = {
  id: string;
  title: string;
  path: string;
  /** 제목에서 검색어가 맞은 범위 [시작, 끝) */
  highlight: [number, number][];
};
export type QuickTimer = { id: string; label: string; left: string };
export type QuickUpcoming = { id: string; label: string; when: string; relative: string };
export type QuickAlertItem = { id: string; label: string; when: string; canOpen: boolean };
export type QuickAlertAction = "snooze10" | "snooze60" | "done" | "open";

export type QuickInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  /** Enter: 메모 저장(note), ⌘Enter: 새 페이지(page) */
  onSubmit: (mode: "note" | "page") => void;
  onEscape: () => void;
  /** 입력에서 알아들었거나 고른 알림 시각. 없으면 null */
  preview: QuickPreview | null;
  onClearPreview: () => void;
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
  /** 저장 성공: 입력 아래 카드 내용을 이 행으로 바꾼다 (잠시 뒤 창이 숨는다) */
  success: QuickSuccess | null;
  /** 저장 실패: 입력은 그대로 두고 위험 색 문구를 보인다. 글을 고치면 사라진다 */
  error: string | null;
  /** 안내 문구(「먼저 시각을 정해 주세요」 등). 바닥 줄에 보인다 */
  notice: string | null;
  /** 울린 알림 대응 상태. 있으면 입력 대신 이 목록을 보인다 */
  alert: QuickAlertItem[] | null;
  onAlertAction: (id: string, action: QuickAlertAction) => void;
  onAlertDismiss: () => void;
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
  const { preview, results, activeIndex, success, error, alert } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const listId = `${uid}-${LIST_ID_SUFFIX}`;
  const showResults = results.length > 0;
  const activeId = showResults && activeIndex >= 0 ? `${uid}-r${activeIndex}` : undefined;
  const isEmpty = props.value.trim() === "";
  const alerting = alert !== null && alert.length > 0;
  const alertKey = alerting ? alert.map((a) => a.id).join(",") : "";
  const PreviewIcon =
    preview?.kind === "timer" ? Timer : preview?.kind === "repeat" ? Repeat : Clock;

  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [menuOpen]);

  // 알림이 울리면 첫 행동 버튼에 포커스를 준다
  useEffect(() => {
    if (!alertKey) return;
    cardRef.current?.querySelector<HTMLButtonElement>("[data-alert-action]")?.focus();
  }, [alertKey]);

  const closeMenu = () => {
    setMenuOpen(false);
    bellRef.current?.focus();
  };

  const onCardKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // 알림 상태에는 입력 칸이 없으니 Esc를 여기서 받는다
    if (alerting && e.key === "Escape") {
      e.preventDefault();
      props.onAlertDismiss();
    }
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
      // ⌥Enter: 선택한 페이지에 시각을 붙인다 (벨 버튼을 키보드로 쓰는 길)
      if (selected && e.altKey) props.onAttachResult(selected.id);
      else if (selected && !(e.metaKey || e.ctrlKey)) props.onOpenResult(selected.id);
      else props.onSubmit(e.metaKey || e.ctrlKey ? "page" : "note");
    }
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
      return;
    }
    const forward = e.key === "ArrowDown" || e.key === "ArrowRight";
    const back = e.key === "ArrowUp" || e.key === "ArrowLeft";
    if (forward || back || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
      const i = items.indexOf(document.activeElement as HTMLElement);
      const n = items.length;
      const next =
        e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (i + (forward ? 1 : -1) + n) % n;
      items[next]?.focus();
    }
  };

  const footerText =
    error ?? props.notice ?? (preview ? null : showResults ? m.hintResults : m.hint);

  return (
    <div
      ref={cardRef}
      onKeyDown={onCardKey}
      className="flex w-full flex-col overflow-hidden rounded-xl bg-elevated shadow-popover"
    >
      {alerting ? (
        <section aria-label={m.alertList} className="flex flex-col">
          <div className="flex h-12 items-center gap-2 px-4">
            <Bell aria-hidden className="size-4 text-secondary" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-primary">{m.alertLabel}</h2>
          </div>
          <ul className="flex flex-col border-t border-subtle p-1.5">
            {alert.map((a) => (
              <li
                key={a.id}
                className="flex min-h-11 flex-wrap items-center gap-2 rounded-md px-2.5 py-1.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-primary">{a.label}</span>
                  <span className="block text-xs text-secondary">{a.when}</span>
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    data-alert-action
                    onClick={() => props.onAlertAction(a.id, "snooze10")}
                    className="flex h-8 items-center rounded-pill border border-subtle px-3 text-sm text-primary hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none force-hover:bg-hover"
                  >
                    {m.alertSnooze10}
                  </button>
                  <button
                    type="button"
                    data-alert-action
                    onClick={() => props.onAlertAction(a.id, "snooze60")}
                    className="flex h-8 items-center rounded-pill border border-subtle px-3 text-sm text-primary hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none force-hover:bg-hover"
                  >
                    {m.alertSnooze60}
                  </button>
                  <button
                    type="button"
                    data-alert-action
                    onClick={() => props.onAlertAction(a.id, "done")}
                    className="flex h-8 items-center rounded-pill border border-subtle px-3 text-sm text-primary hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none force-hover:bg-hover"
                  >
                    {m.alertDone}
                  </button>
                  {a.canOpen ? (
                    <button
                      type="button"
                      data-alert-action
                      onClick={() => props.onAlertAction(a.id, "open")}
                      className="flex h-8 items-center rounded-pill px-3 text-sm text-secondary hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none force-hover:bg-hover"
                    >
                      {m.alertOpen}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-subtle px-4 py-2 text-xs text-tertiary">
            {m.alertHint}
          </div>
        </section>
      ) : (
        <>
          <div className="flex h-18 items-center gap-3 rounded-xl px-4 has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-accent has-[input:focus-visible]:ring-inset">
            <span aria-hidden className="size-5 shrink-0 rounded-full bg-hover" />
            <input
              type="text"
              role="combobox"
              aria-label={m.label}
              aria-expanded={showResults}
              aria-controls={showResults ? listId : undefined}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              name="quick-input"
              autoComplete="off"
              placeholder={m.placeholder}
              value={props.value}
              onChange={(e) => props.onValueChange(e.target.value)}
              onKeyDown={onInputKey}
              className="min-w-0 flex-1 bg-transparent text-lg text-primary placeholder:text-tertiary focus-visible:outline-none"
            />
            <div className="shrink-0">
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
            </div>
          </div>

          {menuOpen ? (
            // 창 안에서 펼친다(떠 있는 메뉴는 창 밖으로 잘린다). 창 높이는 내용에 맞춰 늘어난다
            <div
              ref={menuRef}
              role="menu"
              aria-label={m.menuLabel}
              onKeyDown={onMenuKey}
              className="flex flex-wrap gap-1.5 border-t border-subtle px-4 py-3"
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
                  className="flex h-8 items-center rounded-pill border border-subtle px-3 text-sm text-primary hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none force-hover:bg-hover"
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}

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
                    <span className="max-w-2/5 min-w-0 truncate text-xs text-tertiary">
                      {r.path}
                    </span>
                  </li>
                ))}
              </ul>
              {preview ? (
                <div className="flex shrink-0 flex-col pl-1">
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

          {preview && !success ? (
            <div
              role="group"
              aria-label={m.previewLabel}
              className="flex h-11 items-center gap-2 border-t border-subtle px-4"
            >
              <PreviewIcon
                aria-hidden
                className="size-4 shrink-0 text-secondary"
                strokeWidth={1.5}
              />
              <span className="min-w-0 truncate text-sm text-primary">{preview.primary}</span>
              {preview.relative ? (
                <span className="shrink-0 text-sm text-secondary">{preview.relative}</span>
              ) : null}
              <span className="flex-1" />
              {/* 결과가 골라져 있으면 Enter는 페이지를 연다. 그때는 생성 힌트를 숨긴다 */}
              {showResults && activeIndex >= 0 ? null : (
                <span className="flex shrink-0 items-center gap-1.5 text-sm text-accent">
                  <span>{m.actionCreate}</span>
                  <Kbd keys={["Enter"]} />
                </span>
              )}
              <IconButton
                label={m.chipIgnore}
                onClick={props.onClearPreview}
                className="size-6 shrink-0 rounded-pill text-tertiary hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent force-hover:bg-hover"
              >
                <X className="size-3.5" strokeWidth={1.5} />
              </IconButton>
            </div>
          ) : null}

          {success ? (
            <div
              role="status"
              className="flex h-11 items-center gap-2 border-t border-subtle px-4 text-sm"
            >
              <Check aria-hidden className="size-4 shrink-0 text-accent" strokeWidth={1.5} />
              <span className="text-primary">{success.title}</span>
              {success.detail ? <span className="text-secondary">{success.detail}</span> : null}
            </div>
          ) : null}

          {!success && isEmpty && !preview ? (
            <div className="flex flex-col gap-3 border-t border-subtle p-3">
              {props.timers.length > 0 ? (
                <section aria-label={m.timersTitle} className="flex flex-col gap-0.5">
                  <h2 className="px-2 pb-1 text-xs text-tertiary">{m.timersTitle}</h2>
                  {props.timers.map((t) => (
                    <div key={t.id} className="flex h-9 items-center gap-2 rounded-md px-2 text-sm">
                      <Timer
                        aria-hidden
                        className="size-4 shrink-0 text-secondary"
                        strokeWidth={1.5}
                      />
                      <span className="min-w-0 flex-1 truncate text-primary">{t.label}</span>
                      <span className="font-mono text-secondary tabular-nums" aria-live="off">
                        {t.left}
                      </span>
                      <button
                        type="button"
                        onClick={() => props.onStopTimer(t.id)}
                        aria-label={`${m.stopTimer}: ${t.label}`}
                        className="rounded-md px-2 py-1 text-xs text-secondary hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none force-hover:bg-hover"
                      >
                        {m.stopTimer}
                      </button>
                    </div>
                  ))}
                </section>
              ) : null}
              <section aria-label={m.upcomingTitle} className="flex flex-col gap-0.5">
                <h2 className="px-2 pb-1 text-xs text-tertiary">{m.upcomingTitle}</h2>
                {props.upcoming.length === 0 ? (
                  <p className="h-9 px-2 text-sm leading-9 text-tertiary">{m.noUpcoming}</p>
                ) : (
                  props.upcoming.map((u) => (
                    <div key={u.id} className="flex h-9 items-center gap-2 rounded-md px-2 text-sm">
                      <Clock
                        aria-hidden
                        className="size-4 shrink-0 text-secondary"
                        strokeWidth={1.5}
                      />
                      <span className="min-w-0 flex-1 truncate text-primary">{u.label}</span>
                      <span className="shrink-0 text-secondary">{u.when}</span>
                      <span className="w-20 shrink-0 truncate text-right text-xs text-tertiary">
                        {u.relative}
                      </span>
                    </div>
                  ))
                )}
              </section>
            </div>
          ) : null}

          {!success && (error || footerText) ? (
            <div
              role={error ? "alert" : undefined}
              className={cn(
                "border-t border-subtle px-4 py-2 text-xs",
                error ? "text-danger" : "text-tertiary",
              )}
            >
              {footerText}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
