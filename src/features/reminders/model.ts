/**
 * 알림 모델 (SYS-16). 순수 함수만 둔다. 저장·예약·화면은 store·scheduler·UI가 맡는다.
 *
 * 시각 규칙
 * - `at`, `snoozedUntil`, `anchor`: 지역 날짜·시각 "YYYY-MM-DDTHH:mm" (분 단위, 기기 시간대).
 * - `createdAt`: UTC ISO 문자열. 타이머의 기준 시각이다.
 * - 타이머는 createdAt + durationSec에 울린다. `at`은 그 시각을 분 단위로 적은 표시용 값이다.
 * - 반복 알람은 `anchor`(처음 정한 시각)를 기준으로 다음 날짜를 계산한다. 월말 날짜(31일 등)는
 *   짧은 달에서 그 달의 마지막 날로 맞추고, 다음 달에는 원래 날짜로 돌아간다.
 */

export const REMINDERS_SCHEMA_VERSION = 1;

export type ReminderKind = "alarm" | "timer";
export type ReminderTarget =
  { type: "page"; id: string } | { type: "quickNote"; id: string } | { type: "none" };
export type RepeatRule = "day" | "weekday" | "week" | "month";
export const REPEAT_RULES: readonly RepeatRule[] = ["day", "weekday", "week", "month"];

export type Reminder = {
  id: string;
  kind: ReminderKind;
  target: ReminderTarget;
  label: string;
  /** 알람: 다음(또는 지금의) 울림 시각. 타이머: createdAt + durationSec의 분 단위 표시 */
  at: string;
  /** 타이머 길이(초). 타이머만 */
  durationSec?: number;
  /** 반복. 알람만 */
  repeat?: RepeatRule;
  /** 반복의 기준 시각(처음 정한 `at`). 반복 알람만. 없으면 `at`을 쓴다 */
  anchor?: string;
  /** 미루기로 정한 다음 울림 시각. 있으면 `at`보다 우선한다 */
  snoozedUntil?: string;
  createdAt: string;
  done?: boolean;
};

/** 미루기: 분 단위, 또는 「내일 아침 9시」 */
export type SnoozeSpec = number | "tomorrow9";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const WEEK_MS = 7 * DAY_MS;
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** 「YYYY-MM-DDTHH:mm」을 지역 시각 Date로. 형식이 틀리거나 없는 날짜(2월 30일)면 null */
export function parseLocal(s: string): Date | null {
  const m = LOCAL_RE.exec(s);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const date = new Date(y, mo - 1, d, h, mi);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d ||
    date.getHours() !== h ||
    date.getMinutes() !== mi
  )
    return null;
  return date;
}

/** Date를 지역 「YYYY-MM-DDTHH:mm」으로 (초 이하는 버린다) */
export function formatLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate();
}

/** 반복 알람의 기준 시각 (anchor가 있으면 그것, 없으면 at) */
function anchorOf(rem: Reminder): Date | null {
  return parseLocal(rem.anchor ?? rem.at);
}

/**
 * 반복 규칙에 따라 `after`보다 뒤인 첫 울림 시각. 반복이 없으면 `at`이 `after`보다 뒤일 때만 그 시각을 돌려준다.
 * - day: 매일 같은 시각
 * - weekday: 월~금(토·일 건너뜀)
 * - week: 처음 정한 요일과 시각을 7일마다
 * - month: 처음 정한 날짜를 매달(짧은 달은 그 달의 마지막 날)
 */
export function nextOccurrence(rem: Reminder, after: Date): Date | null {
  const base = anchorOf(rem);
  if (!base) return null;
  const afterMs = after.getTime();
  if (!rem.repeat) {
    const at = parseLocal(rem.at);
    return at && at.getTime() > afterMs ? at : null;
  }
  const h = base.getHours();
  const mi = base.getMinutes();
  const y0 = base.getFullYear();
  const mo0 = base.getMonth();
  const d0 = base.getDate();
  const ok = (c: Date) => c.getTime() > afterMs && c.getTime() >= base.getTime();

  if (rem.repeat === "day" || rem.repeat === "weekday") {
    // 하루 전에서 시작해 앞으로 훑는다 (DST로 한 시간 밀려도 놓치지 않게)
    const i0 = Math.max(0, Math.floor((afterMs - base.getTime()) / DAY_MS) - 1);
    for (let i = i0; i < i0 + 10; i++) {
      const c = new Date(y0, mo0, d0 + i, h, mi);
      if (rem.repeat === "weekday" && (c.getDay() === 0 || c.getDay() === 6)) continue;
      if (ok(c)) return c;
    }
    return null;
  }
  if (rem.repeat === "week") {
    const i0 = Math.max(0, Math.floor((afterMs - base.getTime()) / WEEK_MS) - 1);
    for (let k = i0; k < i0 + 3; k++) {
      const c = new Date(y0, mo0, d0 + 7 * k, h, mi);
      if (ok(c)) return c;
    }
    return null;
  }
  // month
  const fromMonths = (after.getFullYear() - y0) * 12 + (after.getMonth() - mo0);
  const k0 = Math.max(0, fromMonths - 1);
  for (let k = k0; k < k0 + 4; k++) {
    const m = mo0 + k;
    const y = y0 + Math.floor(m / 12);
    const mo = ((m % 12) + 12) % 12;
    const c = new Date(y, mo, Math.min(d0, daysInMonth(y, mo)), h, mi);
    if (ok(c)) return c;
  }
  return null;
}

/** 타이머의 끝 시각 (createdAt + durationSec). 타이머가 아니거나 정보가 없으면 null */
export function timerEnd(rem: Reminder): Date | null {
  if (rem.kind !== "timer" || rem.durationSec === undefined) return null;
  const created = Date.parse(rem.createdAt);
  if (!Number.isFinite(created)) return null;
  return new Date(created + rem.durationSec * 1000);
}

/** 지금 울려야 할 시각: 미루기 시각 → 타이머 끝 → 알람 시각 순서 */
export function dueAt(rem: Reminder): Date | null {
  if (rem.snoozedUntil) {
    const s = parseLocal(rem.snoozedUntil);
    if (s) return s;
  }
  if (rem.kind === "timer") return timerEnd(rem);
  return parseLocal(rem.at);
}

/** 끝난 항목이 아니고 울릴 시각이 지났는가 */
export function isDue(rem: Reminder, now: Date): boolean {
  if (rem.done) return false;
  const due = dueAt(rem);
  return due !== null && due.getTime() <= now.getTime();
}

/** 타이머의 남은 시간(초, 올림). 지났으면 0. 알람이면 null */
export function remaining(rem: Reminder, now: Date): number | null {
  if (rem.kind !== "timer") return null;
  const end = timerEnd(rem);
  if (!end) return null;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 1000));
}

/** 미루기. 분 단위는 지금부터, 「내일」은 내일 오전 9시 */
export function snooze(rem: Reminder, by: SnoozeSpec, now: Date): Reminder {
  const until =
    by === "tomorrow9"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0)
      : new Date(Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS + by * MINUTE_MS);
  return { ...rem, snoozedUntil: formatLocal(until) };
}

function withoutSnooze(rem: Reminder): Reminder {
  const copy = { ...rem };
  delete copy.snoozedUntil;
  return copy;
}

/**
 * 완료 처리. 반복 알람은 지금(또는 현재 `at`) 다음 울림으로 넘기고 미루기를 지운다.
 * 한 번짜리 알람과 타이머는 끝(done)으로 표시한다.
 */
export function complete(rem: Reminder, now: Date): Reminder {
  if (rem.kind === "alarm" && rem.repeat) {
    const at = parseLocal(rem.at);
    const from = at && at.getTime() > now.getTime() ? at : now;
    const next = nextOccurrence(rem, from);
    if (next) {
      const rest = withoutSnooze(rem);
      return { ...rest, at: formatLocal(next) };
    }
  }
  const rest = withoutSnooze(rem);
  return { ...rest, done: true };
}

/** 새 알림을 만든다. 입력이 틀리면 null */
export function createReminder(
  input: {
    id: string;
    kind: ReminderKind;
    target: ReminderTarget;
    label: string;
    /** 알람: 지역 「YYYY-MM-DDTHH:mm」 */
    at?: string;
    /** 타이머 길이(초) */
    durationSec?: number;
    repeat?: RepeatRule;
  },
  now: Date,
): Reminder | null {
  const raw: Record<string, unknown> = {
    id: input.id,
    kind: input.kind,
    target: input.target,
    label: input.label,
    createdAt: now.toISOString(),
  };
  if (input.kind === "timer") {
    raw.durationSec = input.durationSec;
    raw.at = formatLocal(new Date(now.getTime() + (input.durationSec ?? 0) * 1000));
  } else {
    raw.at = input.at;
    if (input.repeat) {
      raw.repeat = input.repeat;
      raw.anchor = input.at;
    }
  }
  return parseReminder(raw);
}

/** 알람 한 항목을 설정된 반복·시각으로 바꾼다 (편집 화면용). 입력이 틀리면 null */
export function updateReminder(
  rem: Reminder,
  patch: { label?: string; at?: string; repeat?: RepeatRule | null },
): Reminder | null {
  const raw: Record<string, unknown> = { ...rem };
  if (patch.label !== undefined) raw.label = patch.label;
  if (patch.at !== undefined) {
    raw.at = patch.at;
    raw.anchor = patch.at;
    raw.snoozedUntil = undefined;
  }
  if (patch.repeat !== undefined) {
    if (patch.repeat === null) {
      raw.repeat = undefined;
      raw.anchor = undefined;
    } else {
      raw.repeat = patch.repeat;
      raw.anchor = patch.at ?? rem.anchor ?? rem.at;
    }
  }
  return parseReminder(raw);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isLocalString(v: unknown): v is string {
  return typeof v === "string" && parseLocal(v) !== null;
}

function parseTarget(v: unknown): ReminderTarget | null {
  if (!isRecord(v)) return null;
  if (v.type === "none") return { type: "none" };
  if ((v.type === "page" || v.type === "quickNote") && typeof v.id === "string" && v.id !== "") {
    return { type: v.type, id: v.id };
  }
  return null;
}

/**
 * 저장 파일의 항목 하나를 검증한다. 필수 값이 틀리면 null(항목을 버린다).
 * 선택 값(반복, 미루기 시각, anchor)이 틀리면 그 값만 뺀다.
 */
export function parseReminder(raw: unknown): Reminder | null {
  if (!isRecord(raw)) return null;
  const { id, kind, label, at, createdAt } = raw;
  if (typeof id !== "string" || id === "") return null;
  if (kind !== "alarm" && kind !== "timer") return null;
  const target = parseTarget(raw.target);
  if (!target) return null;
  if (typeof label !== "string") return null;
  if (typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt))) return null;
  if (!isLocalString(at)) return null;

  const out: Reminder = { id, kind, target, label, at, createdAt };
  if (kind === "timer") {
    const d = raw.durationSec;
    if (typeof d !== "number" || !Number.isInteger(d) || d <= 0) return null;
    out.durationSec = d;
  } else if (
    typeof raw.repeat === "string" &&
    (REPEAT_RULES as readonly string[]).includes(raw.repeat)
  ) {
    out.repeat = raw.repeat as RepeatRule;
    out.anchor = isLocalString(raw.anchor) ? raw.anchor : at;
  }
  if (isLocalString(raw.snoozedUntil)) out.snoozedUntil = raw.snoozedUntil;
  if (raw.done === true) out.done = true;
  return out;
}

/** 파일 전체를 읽는다. 최상위 모양이 틀리면 빈 목록, 틀린 항목과 같은 id는 뺀다 */
export function parseRemindersFile(raw: unknown): Reminder[] {
  if (!isRecord(raw) || raw.schemaVersion !== REMINDERS_SCHEMA_VERSION) return [];
  if (!Array.isArray(raw.reminders)) return [];
  const seen = new Set<string>();
  const out: Reminder[] = [];
  for (const item of raw.reminders) {
    const rem = parseReminder(item);
    if (!rem || seen.has(rem.id)) continue;
    seen.add(rem.id);
    out.push(rem);
  }
  return out;
}

/** 저장할 파일 모양 */
export function toRemindersFile(list: readonly Reminder[]): {
  schemaVersion: number;
  reminders: Reminder[];
} {
  return { schemaVersion: REMINDERS_SCHEMA_VERSION, reminders: [...list] };
}
