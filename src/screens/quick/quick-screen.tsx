import { emitAppEvent as emit, listenAppEvent } from "@/lib/storage/quick-events";
import { useEffect, useMemo, useRef, useState } from "react";
import { QuickInput, type QuickChip, type QuickResult } from "@/components/page/quick-input";
import {
  dueAt,
  remaining,
  type Reminder,
  type ReminderTarget,
  type RepeatRule,
} from "@/features/reminders/model";
import { formatReminderWhen } from "@/features/reminders/present";
import { remindersStore, useReminders } from "@/features/reminders";
import { createSearchIndex, type SearchIndex } from "@/features/search/search-index";
import { displayTitle } from "@/features/pages/title";
import { parseReminderText } from "@/lib/reminder-parse";
import { useMessages } from "@/lib/i18n";
import { createPage, ulid, type Page, type QuickNote } from "@/lib/storage";
import { getStorage } from "@/lib/storage/default";
import { hideCurrentWindow, resizeCurrentWindow, showMainWindow } from "@/lib/storage/window";
import { matchHangul } from "@/lib/hangul";

/**
 * 빠른 입력 창(QN-03 + SYS-16). 별도 JS 컨텍스트라 앱 본체의 스토어를 공유하지 않는다.
 * 워크스페이스 메타(빠른 메모)·페이지 구조·알림 파일을 저장 계층으로 직접 읽고 쓴다.
 * 쓴 뒤에는 `quick://changed`·`reminders://changed` 이벤트로 메인 창이 다시 읽게 한다.
 */

/** 알림 시각 한 개: 알람(지역 시각 + 반복) 또는 타이머(초) */
type TimeSpec =
  { kind: "alarm"; at: string; repeat?: RepeatRule } | { kind: "timer"; durationSec: number };

const RESULT_LIMIT = 6;
const CONFIRM_MS = 800;
const WINDOW_WIDTH = 680;

const pad = (n: number) => String(n).padStart(2, "0");

/** 지역 「YYYY-MM-DDTHH:mm」 */
function localAt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 오늘 또는 다음 날의 hh:mm 시각 */
function nextAt(now: Date, hour: number, minute = 0, daysIfPast = 1): Date {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + daysIfPast);
  return d;
}

/** 칩과 확인 문구에 쓰는 가짜 알림 한 개 (formatReminderWhen으로 같은 문장을 쓴다) */
function previewReminder(spec: TimeSpec, now: Date): Reminder {
  const base = {
    id: "preview",
    target: { type: "none" as const },
    label: "",
    createdAt: now.toISOString(),
  };
  return spec.kind === "timer"
    ? { ...base, kind: "timer", at: now.toISOString(), durationSec: spec.durationSec }
    : { ...base, kind: "alarm", at: spec.at, repeat: spec.repeat };
}

function specFromParsed(when: NonNullable<ReturnType<typeof parseReminderText>["when"]>): TimeSpec {
  return when.kind === "timer"
    ? { kind: "timer", durationSec: when.durationSec }
    : { kind: "alarm", at: when.at, repeat: when.repeat };
}

function presetSpec(id: string, now: Date): TimeSpec | null {
  const min = (n: number) => ({
    kind: "alarm" as const,
    at: localAt(new Date(now.getTime() + n * 60_000)),
  });
  switch (id) {
    case "min10":
      return min(10);
    case "min30":
      return min(30);
    case "hour1":
      return min(60);
    case "tonight6":
      return { kind: "alarm", at: localAt(nextAt(now, 18)) };
    case "tomorrow9":
      return { kind: "alarm", at: localAt(nextAt(now, 9, 0, 1)) };
    case "timer25":
      return { kind: "timer", durationSec: 25 * 60 };
    case "timer50":
      return { kind: "timer", durationSec: 50 * 60 };
    case "repeatDay":
      return { kind: "alarm", at: localAt(nextAt(now, 9)), repeat: "day" };
    case "repeatWeekday":
      return { kind: "alarm", at: localAt(nextAt(now, 9)), repeat: "weekday" };
    case "repeatWeek":
      return { kind: "alarm", at: localAt(nextAt(now, 9)), repeat: "week" };
    default:
      return null;
  }
}

const PRESET_IDS = [
  "min10",
  "min30",
  "hour1",
  "tonight6",
  "tomorrow9",
  "timer25",
  "timer50",
  "repeatDay",
  "repeatWeekday",
  "repeatWeek",
] as const;

type PageRow = { id: string; title: string; path: string; page: Page };

function clock(sec: number): string {
  return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
}

export function QuickScreen() {
  const m = useMessages().screens.quickInput;
  const reminders = useReminders((s) => s.list);
  const [value, setValue] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [picked, setPicked] = useState<TimeSpec | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  // 파싱: 입력 문장에서 시각을 알아들었으면 칩으로 보여 준다 (무시하면 같은 시각은 다시 붙지 않는다)
  const parsed = useMemo(() => parseReminderText(value, now), [value, now]);
  const parsedKey = parsed.when ? JSON.stringify(parsed.when) : null;
  const parsedSpec = parsed.when && parsedKey !== dismissedKey ? specFromParsed(parsed.when) : null;
  const spec = picked ?? parsedSpec;
  const usingParsed = picked === null && parsedSpec !== null;
  const label = (usingParsed ? parsed.label : value).trim();

  const chip: QuickChip | null = spec
    ? {
        kind: spec.kind === "timer" ? "timer" : spec.repeat ? "repeat" : "alarm",
        text: formatReminderWhen(previewReminder(spec, now), now),
      }
    : null;

  // 페이지 검색: 칩이 없고 글자가 있을 때만 (저장 의도가 없을 때)
  const index = useMemo<SearchIndex>(() => {
    const idx = createSearchIndex();
    idx.build(pages.map((r) => r.page));
    return idx;
  }, [pages]);
  const results: QuickResult[] = useMemo(() => {
    const q = value.trim();
    if (!q || spec) return [];
    const hits = index.search(q, { limit: RESULT_LIMIT });
    const byId = new Map(pages.map((r) => [r.id, r]));
    return hits.flatMap((h) => {
      const row = byId.get(h.id);
      if (!row) return [];
      const spans = matchHangul(row.title, q) ?? [];
      return [{ id: row.id, title: row.title, path: row.path, highlight: spans }];
    });
  }, [value, spec, pages, index]);

  const activeResult = results.length > 0 && activeIndex >= 0 ? activeIndex : -1;

  // 진행 중인 타이머·다가오는 알림 (입력이 비었을 때만 보인다)
  const timers = reminders
    .filter((r) => r.kind === "timer" && !r.done && (remaining(r, now) ?? 0) > 0)
    .map((r) => ({
      id: r.id,
      label: r.label || m.timerLabel,
      left: clock(remaining(r, now) ?? 0),
    }));
  const upcoming = reminders
    .filter((r) => r.kind === "alarm" && !r.done && dueAt(r) !== null)
    .sort((a, b) => (dueAt(a)?.getTime() ?? 0) - (dueAt(b)?.getTime() ?? 0))
    .slice(0, 3)
    .map((r) => ({ id: r.id, label: r.label, when: formatReminderWhen(r, now) }));

  // 입력이 비었으면 목록을, 아니면 결과 개수만큼 창 높이를 맞춘다
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const apply = () => void resizeCurrentWindow(WINDOW_WIDTH, Math.ceil(el.offsetHeight) + 16);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 시계: 타이머 카운트다운
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  async function loadPages() {
    try {
      const { pages: all } = await getStorage().loadPageMeta();
      const byId = new Map(all.map((p) => [p.id, p]));
      const pathOf = (p: Page): string => {
        const names: string[] = [];
        let parent = p.parentId ? byId.get(p.parentId) : undefined;
        while (parent && names.length < 8) {
          names.unshift(displayTitle(parent));
          parent = parent.parentId ? byId.get(parent.parentId) : undefined;
        }
        return names.join(" / ");
      };
      setPages(
        all
          .filter((p) => !p.trashedAt)
          .map((p) => ({ id: p.id, title: displayTitle(p), path: pathOf(p), page: p })),
      );
    } catch {
      setPages([]);
    }
  }

  // 창이 다시 보일 때: 포커스, 알림·페이지 목록 새로 읽기
  const refresh = () => {
    void remindersStore.getState().load();
    void loadPages();
    document.querySelector<HTMLInputElement>('[role="combobox"]')?.focus();
  };
  useEffect(() => {
    // 첫 읽기는 다음 턴에 한다(마운트 중 상태를 바로 바꾸지 않는다)
    const first = window.setTimeout(refresh, 0);
    window.addEventListener("focus", refresh);
    // 비활성 패널은 focus 이벤트가 오지 않을 수 있어 Rust가 띄울 때마다 알린다
    const unlisten = listenAppEvent("quick://shown", refresh);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener("focus", refresh);
      void unlisten.then((off) => off());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(text: string) {
    setConfirmation(text);
    setValue("");
    setPicked(null);
    setDismissedKey(null);
    window.setTimeout(() => {
      setConfirmation(null);
      void hideCurrentWindow();
    }, CONFIRM_MS);
  }

  async function saveNoteOrPage(mode: "note" | "page", s: TimeSpec | null, text: string) {
    const storage = getStorage();
    let target: ReminderTarget = { type: "none" };
    if (mode === "page") {
      const page = createPage({
        title: text || m.timerLabel,
        content: text
          ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }
          : { type: "doc", content: [] },
      });
      if (!(await storage.writePage(page))) throw new Error("page");
      target = { type: "page", id: page.id };
    } else if (text) {
      const note: QuickNote = { id: ulid(), text, createdAt: new Date().toISOString() };
      // 읽기·쓰기를 백엔드가 한 번에 한다 (메인 창의 메타 쓰기와 겹쳐도 메모가 지워지지 않는다)
      await storage.appendQuickNote(note);
      target = { type: "quickNote", id: note.id };
    }
    if (s) {
      // 글이 없으면 대상 없이 둔다. 타이머 이름이 비면 「타이머」
      const base = { target, label: text || (s.kind === "timer" ? m.timerLabel : "") };
      if (s.kind === "timer")
        remindersStore.getState().add({ kind: "timer", durationSec: s.durationSec, ...base });
      else remindersStore.getState().add({ kind: "alarm", at: s.at, repeat: s.repeat, ...base });
      await remindersStore.getState().flush();
      await emit("reminders://changed");
    }
    await emit("quick://changed");
  }

  async function onSubmit(mode: "note" | "page") {
    const text = label;
    if (!text && !spec) return;
    if (busy.current) return;
    busy.current = true;
    try {
      await saveNoteOrPage(mode, spec, text);
      const when = spec ? formatReminderWhen(previewReminder(spec, new Date()), new Date()) : null;
      finish(mode === "page" ? m.savedPage : when ? m.savedWithAlarm(when) : m.savedNote);
    } catch {
      setConfirmation(m.needTime);
    } finally {
      busy.current = false;
    }
  }

  async function onOpenResult(id: string) {
    // 메인 창이 숨어 있어도 열리도록 먼저 보인 뒤 페이지를 열어 달라고 한다
    await showMainWindow();
    await emit("quick://open-page", { id });
    setValue("");
    await hideCurrentWindow();
  }

  async function onAttachResult(id: string) {
    if (!spec) {
      setConfirmation(m.needTime);
      return;
    }
    const base = { target: { type: "page" as const, id }, label: label || m.timerLabel };
    if (spec.kind === "timer")
      remindersStore.getState().add({ kind: "timer", durationSec: spec.durationSec, ...base });
    else
      remindersStore.getState().add({ kind: "alarm", at: spec.at, repeat: spec.repeat, ...base });
    await remindersStore.getState().flush();
    await emit("reminders://changed");
    finish(m.attached);
  }

  function onPreset(id: string) {
    if (id === "direct") {
      setConfirmation(m.directHint);
      document.querySelector<HTMLInputElement>('[role="combobox"]')?.focus();
      return;
    }
    const s = presetSpec(id, new Date());
    if (s) {
      setPicked(s);
      setConfirmation(null);
    }
  }

  async function onStopTimer(id: string) {
    remindersStore.getState().remove(id);
    await remindersStore.getState().flush();
    await emit("reminders://changed");
  }

  return (
    <div ref={rootRef} className="p-2">
      <QuickInput
        value={value}
        onValueChange={(v) => {
          setValue(v);
          setActiveIndex(-1);
          setConfirmation(null);
        }}
        onSubmit={(mode) => void onSubmit(mode)}
        onEscape={() => {
          setValue("");
          setPicked(null);
          setDismissedKey(null);
          void hideCurrentWindow();
        }}
        chip={chip}
        onClearChip={() => {
          // × 는 파싱된 시각과 선택한 시각을 모두 무시한다 (입력이 바뀌어 다른 시각이 되면 다시 붙는다)
          setPicked(null);
          setDismissedKey(parsedKey ?? "__picked__");
        }}
        presets={[
          ...PRESET_IDS.map((id) => ({ id, label: m.presets[id] })),
          { id: "direct", label: m.presets.direct },
        ]}
        onPreset={onPreset}
        results={results}
        activeIndex={activeResult}
        onActiveIndexChange={setActiveIndex}
        onOpenResult={(id) => void onOpenResult(id)}
        onAttachResult={(id) => void onAttachResult(id)}
        timers={value.trim() ? [] : timers}
        onStopTimer={(id) => void onStopTimer(id)}
        upcoming={value.trim() ? [] : upcoming}
        confirmation={confirmation}
      />
    </div>
  );
}
