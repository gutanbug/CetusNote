/* i18n-ignore-file — 한국어 시간 표현 해석 */
/**
 * 빠른 입력 문장에서 알림 시각을 알아낸다 (SYS-16, QN-03). 순수 함수, 한국어·영어.
 *
 * 반환: 시각 표현을 뺀 나머지 글(`label`), 알아들은 시각(`when`), 그 표현의 위치(`span`, 칩 강조용).
 * 알아듣지 못하면 `when`과 `span`은 null이고 `label`은 입력 전체다.
 *
 * 시각 규칙
 * - 「N분 뒤」「N시간 M분 후」「N분 타이머」「in 1h」「25 min timer」「25분」(단독)은 타이머(길이 초).
 *   단독 「N분」도 타이머로 본다.
 * - 날짜 말 없이 시각만 있으면 오늘 그 시각. 이미 지났으면 내일.
 * - 오전·오후·am·pm이 없으면: 1~6시는 오후(13~18시)로 본다. 7~12시는 그대로(12시는 정오), 13시 이상은 그대로.
 * - 「오늘」「내일」「모레」「M월 D일」처럼 날짜를 적었으면 그 날짜를 그대로 쓴다(지난 시각이어도 옮기지 않는다).
 * - 요일만 적으면(「금요일 오후 2시」) 오늘 이후 가장 가까운 그 요일. 이미 지났으면 다음 주.
 * - 「다음 주 X요일」과 「next X」는 다음 주(월요일 시작)의 그 요일. 「이번 주 X요일」은 이번 주의 그 요일.
 * - 반복: 「매일」「평일」「매주 X요일」「매월 N일」「every day」「weekdays」「every monday」「monthly on the 1st」.
 *   반환하는 `at`은 첫 울림이다. 다음 울림은 반복 규칙으로 정한다(features/reminders/model.ts).
 * - 날짜 계산은 기기 지역 시간 기준이다. 요일은 월요일 시작으로 센다.
 *
 * 이 파일은 `lib`이라 features를 import하지 않는다. 그래서 지역 날짜 형식과 요일 계산을 여기서 한다.
 */

export type ParsedWhen =
  | { kind: "alarm"; at: string; repeat?: "day" | "weekday" | "week" | "month" }
  | { kind: "timer"; durationSec: number };

export type ReminderParse = {
  label: string;
  when: ParsedWhen | null;
  /** 알아들은 표현의 위치 [시작, 끝) — 입력 문자열 기준 */
  span: [number, number] | null;
};

// ── 한국어 어휘 ──────────────────────────────────────────────

const KO_T =
  "(?:오전|오후)?\\s*\\d{1,2}\\s*시(?!간)(?:\\s*\\d{1,2}\\s*분|\\s*반)?|(?:오전|오후)?\\s*\\d{1,2}:\\d{2}";
const KO_REL_DAY = "(?:오늘|내일|모레)";
const KO_WEEKDAY = "(?:(?:다음|이번)\\s*주\\s*)?[월화수목금토일]요일";
const KO_MONTH_DAY = "\\d{1,2}월\\s*\\d{1,2}일";
const KO_WD_INDEX: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const KO_REL_OFFSET: Record<string, number> = { 오늘: 0, 내일: 1, 모레: 2 };

// ── 영어 어휘 ────────────────────────────────────────────────

/** 영어 시각 본체 (am/pm 선택). 앞의 「at」은 호출하는 쪽에서 뺀다 */
const EN_TIME = "\\d{1,2}(?::\\d{2})?\\s*(?:[ap]\\.?m\\.?)?(?!\\d)";
const EN_WEEKDAY =
  "(monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun)\\b";
const EN_MONTH = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const EN_WD_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tues: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thurs: 4,
  thur: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};
const EN_MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

// ── 시각 해석 ────────────────────────────────────────────────

type Hm = { h: number; m: number };

/** 「오후 3시 반」「14:00」「3시 30분」 → 시·분. 해석할 수 없으면 null */
function parseKoTime(text: string): Hm | null {
  const colon = /(\d{1,2}):(\d{2})/.exec(text);
  let hour: number;
  let minute: number;
  if (colon) {
    hour = Number(colon[1]);
    minute = Number(colon[2]);
  } else {
    const hm = /(\d{1,2})\s*시/.exec(text);
    if (!hm) return null;
    hour = Number(hm[1]);
    minute = /\d{1,2}\s*분/.test(text)
      ? Number(/(\d{1,2})\s*분/.exec(text)![1])
      : /반/.test(text)
        ? 30
        : 0;
    const ap = /(오전|오후)/.exec(text)?.[1];
    const h = resolveHour(hour, ap === "오전" ? "am" : ap === "오후" ? "pm" : null);
    return h === null || minute > 59 ? null : { h, m: minute };
  }
  const ap = /(오전|오후)/.exec(text)?.[1];
  const h = resolveHour(hour, ap === "오전" ? "am" : ap === "오후" ? "pm" : null);
  return h === null || minute > 59 ? null : { h, m: minute };
}

/** 「3pm」「9:00am」「14:00」「at 9」 → 시·분 */
function parseEnTime(text: string): Hm | null {
  const m = /(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?m?\.?/i.exec(text.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const ap = m[3] ? (m[3].toLowerCase() === "a" ? "am" : "pm") : null;
  const h = resolveHour(hour, ap);
  return h === null || minute > 59 ? null : { h, m: minute };
}

/** 오전·오후(am·pm)를 24시간 시각으로. 없으면 1~6시는 오후로 본다 */
function resolveHour(hour: number, ap: "am" | "pm" | null): number | null {
  if (hour < 0 || hour > 23) return null;
  if (ap === "am") {
    if (hour === 0 || hour > 12) return null;
    return hour === 12 ? 0 : hour;
  }
  if (ap === "pm") {
    if (hour === 0 || hour > 12) return null;
    return hour === 12 ? 12 : hour + 12;
  }
  return hour >= 1 && hour <= 6 ? hour + 12 : hour;
}

// ── 날짜 계산 (지역 시간) ─────────────────────────────────────

const MINUTE_S = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

function localAt(y: number, mo: number, d: number, t: Hm): Date {
  return new Date(y, mo, d, t.h, t.m);
}

function fmtLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 이번 주 월요일 00:00 */
function thisMonday(now: Date): Date {
  const offset = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
}

/** 오늘 이후 가장 가까운 그 요일의 `t` 시각. 이미 지났으면 다음 주 */
function nextWeekday(now: Date, wd: number, t: Hm): Date {
  for (let i = 0; i <= 7; i++) {
    const c = localAt(now.getFullYear(), now.getMonth(), now.getDate() + i, t);
    if (c.getDay() === wd && c.getTime() > now.getTime()) return c;
  }
  return localAt(now.getFullYear(), now.getMonth(), now.getDate() + 7, t);
}

/** 「다음 주」「이번 주」의 그 요일 (월요일 시작) */
function weekOfDay(now: Date, wd: number, t: Hm, nextWeek: boolean): Date {
  const mon = thisMonday(now);
  const off = (wd + 6) % 7;
  return localAt(mon.getFullYear(), mon.getMonth(), mon.getDate() + off + (nextWeek ? 7 : 0), t);
}

function dim(y: number, mo: number): number {
  return new Date(y, mo + 1, 0).getDate();
}

// ── 규칙 ─────────────────────────────────────────────────────

type Hit = { when: ParsedWhen; start: number; end: number };
type Rule = { re: RegExp; make: (m: RegExpExecArray, now: Date) => ParsedWhen | null };

const alarm = (d: Date, repeat?: "day" | "weekday" | "week" | "month"): ParsedWhen =>
  repeat ? { kind: "alarm", at: fmtLocal(d), repeat } : { kind: "alarm", at: fmtLocal(d) };

/** 시각만 있을 때: 오늘, 지났으면 내일 */
function todayOrTomorrow(now: Date, t: Hm): Date {
  const c = localAt(now.getFullYear(), now.getMonth(), now.getDate(), t);
  return c.getTime() > now.getTime()
    ? c
    : localAt(now.getFullYear(), now.getMonth(), now.getDate() + 1, t);
}

function durationSecFromHm(h: number, m: number): number {
  return h * 3600 + m * 60;
}

const RULES: Rule[] = [
  // ── 반복 (한국어)
  {
    re: new RegExp(`매일\\s*(${KO_T})`),
    make: (m, now) => {
      const t = parseKoTime(m[1]);
      return t ? alarm(todayOrTomorrow(now, t), "day") : null;
    },
  },
  {
    re: new RegExp(`평일\\s*(${KO_T})`),
    make: (m, now) => {
      const t = parseKoTime(m[1]);
      return t ? alarm(nextWeekdayOrWeekend(now, t), "weekday") : null;
    },
  },
  {
    re: new RegExp(`매주\\s*([월화수목금토일])요일\\s*(${KO_T})`),
    make: (m, now) => {
      const t = parseKoTime(m[2]);
      return t ? alarm(nextWeekday(now, KO_WD_INDEX[m[1]], t), "week") : null;
    },
  },
  {
    re: new RegExp(`매월\\s*(\\d{1,2})일\\s*(${KO_T})`),
    make: (m, now) => {
      const t = parseKoTime(m[2]);
      const d = t ? nextMonthDay(now, Number(m[1]), t) : null;
      return d ? alarm(d, "month") : null;
    },
  },
  // ── 반복 (영어)
  {
    re: new RegExp(`\\b(?:every\\s+day|daily)\\s+(?:at\\s+)?(${EN_TIME})`, "i"),
    make: (m, now) => {
      const t = parseEnTime(m[1]);
      return t ? alarm(todayOrTomorrow(now, t), "day") : null;
    },
  },
  {
    re: new RegExp(`\\b(?:every\\s+weekday|weekdays)\\s+(?:at\\s+)?(${EN_TIME})`, "i"),
    make: (m, now) => {
      const t = parseEnTime(m[1]);
      return t ? alarm(nextWeekdayOrWeekend(now, t), "weekday") : null;
    },
  },
  {
    re: new RegExp(`\\bevery\\s+${EN_WEEKDAY}\\s+(?:at\\s+)?(${EN_TIME})`, "i"),
    make: (m, now) => {
      const t = parseEnTime(m[2]);
      const wd = EN_WD_INDEX[m[1].toLowerCase()];
      return t && wd !== undefined ? alarm(nextWeekday(now, wd, t), "week") : null;
    },
  },
  {
    re: new RegExp(
      `\\b(?:every\\s+month|monthly)\\s+on\\s+the\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:at\\s+)?(${EN_TIME})`,
      "i",
    ),
    make: (m, now) => {
      const t = parseEnTime(m[2]);
      const d = t ? nextMonthDay(now, Number(m[1]), t) : null;
      return d ? alarm(d, "month") : null;
    },
  },
  // ── 날짜·시각 (영어)
  {
    re: new RegExp(`\\b(today|tomorrow)\\s+(?:at\\s+)?(${EN_TIME})`, "i"),
    make: (m, now) => {
      const t = parseEnTime(m[2]);
      if (!t) return null;
      const off = m[1].toLowerCase() === "tomorrow" ? 1 : 0;
      return alarm(localAt(now.getFullYear(), now.getMonth(), now.getDate() + off, t));
    },
  },
  {
    re: new RegExp(`\\b(next|this)\\s+${EN_WEEKDAY}\\s+(?:at\\s+)?(${EN_TIME})`, "i"),
    make: (m, now) => {
      const t = parseEnTime(m[3]);
      const wd = EN_WD_INDEX[m[2].toLowerCase()];
      if (!t || wd === undefined) return null;
      return alarm(weekOfDay(now, wd, t, m[1].toLowerCase() === "next"));
    },
  },
  {
    re: new RegExp(`\\b${EN_WEEKDAY}\\s+(?:at\\s+)?(${EN_TIME})`, "i"),
    make: (m, now) => {
      const t = parseEnTime(m[2]);
      const wd = EN_WD_INDEX[m[1].toLowerCase()];
      return t && wd !== undefined ? alarm(nextWeekday(now, wd, t)) : null;
    },
  },
  {
    re: new RegExp(`\\b${EN_MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:at\\s+)?(${EN_TIME})`, "i"),
    make: (m, now) => {
      const t = parseEnTime(m[3]);
      const mo = EN_MONTH_INDEX[m[1].slice(0, 3).toLowerCase()];
      const day = Number(m[2]);
      if (!t || mo === undefined || day < 1 || day > dim(now.getFullYear(), mo)) return null;
      let d = localAt(now.getFullYear(), mo, day, t);
      if (d.getTime() < now.getTime() - DAY_MS) d = localAt(now.getFullYear() + 1, mo, day, t);
      return alarm(d);
    },
  },
  {
    re: /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)(?!\d)/i,
    make: (m, now) => {
      const t = parseEnTime(m[1]);
      return t ? alarm(todayOrTomorrow(now, t)) : null;
    },
  },
  {
    re: /\b(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)(?!\w)/i,
    make: (m, now) => {
      const t = parseEnTime(m[1]);
      return t ? alarm(todayOrTomorrow(now, t)) : null;
    },
  },
  // ── 날짜·시각 (한국어)
  {
    re: new RegExp(`(?:(${KO_REL_DAY}|${KO_WEEKDAY}|${KO_MONTH_DAY})\\s*)?(${KO_T})`),
    make: (m, now) => {
      const t = parseKoTime(m[2]);
      if (!t) return null;
      const date = m[1];
      if (!date) return alarm(todayOrTomorrow(now, t));
      if (date in KO_REL_OFFSET) {
        const off = KO_REL_OFFSET[date];
        return alarm(localAt(now.getFullYear(), now.getMonth(), now.getDate() + off, t));
      }
      if (date.includes("요일")) {
        const wd = KO_WD_INDEX[date.replace(/^(다음|이번)\s*주\s*/, "").charAt(0)];
        if (date.startsWith("다음")) return alarm(weekOfDay(now, wd, t, true));
        if (date.startsWith("이번")) return alarm(weekOfDay(now, wd, t, false));
        return alarm(nextWeekday(now, wd, t));
      }
      const md = /(\d{1,2})월\s*(\d{1,2})일/.exec(date)!;
      const mo = Number(md[1]) - 1;
      const day = Number(md[2]);
      if (mo < 0 || mo > 11 || day < 1 || day > dim(now.getFullYear(), mo)) return null;
      let d = localAt(now.getFullYear(), mo, day, t);
      if (d.getTime() < now.getTime() - DAY_MS) d = localAt(now.getFullYear() + 1, mo, day, t);
      return alarm(d);
    },
  },
  // ── 타이머 (길이): 시간·분·초가 아닌 긴 표현을 먼저 본다
  {
    re: /(\d{1,2})\s*시간(?:\s*(\d{1,2})\s*분)?\s*(?:뒤|후|타이머)?/,
    make: (m) => {
      const h = Number(m[1]);
      const min = m[2] ? Number(m[2]) : 0;
      return h > 0 || min > 0 ? { kind: "timer", durationSec: durationSecFromHm(h, min) } : null;
    },
  },
  {
    re: /(\d{1,3})\s*분\s*(?:뒤|후|타이머|동안)?/,
    make: (m) => {
      const min = Number(m[1]);
      return min > 0 ? { kind: "timer", durationSec: min * MINUTE_S } : null;
    },
  },
  {
    re: /\bin\s+(\d{1,3})\s*(hours?|hrs?|h|minutes?|mins?|m)\b(?:\s*(?:and\s+)?(\d{1,3})\s*(minutes?|mins?|m)\b)?/i,
    make: (m) => {
      const first = Number(m[1]);
      const unitSec = /^h/i.test(m[2]) ? 3600 : MINUTE_S;
      const extra = m[3] ? Number(m[3]) * MINUTE_S : 0;
      const sec = first * unitSec + extra;
      return sec > 0 ? { kind: "timer", durationSec: sec } : null;
    },
  },
  {
    re: /\b(\d{1,3})\s*(hours?|hrs?|h|minutes?|mins?|m)\s+timer\b/i,
    make: (m) => {
      const n = Number(m[1]);
      const sec = (/^h/i.test(m[2]) ? 3600 : MINUTE_S) * n;
      return sec > 0 ? { kind: "timer", durationSec: sec } : null;
    },
  },
];

/** 평일 반복의 첫 울림: 오늘(평일이면) 또는 다음 평일 */
function nextWeekdayOrWeekend(now: Date, t: Hm): Date {
  for (let i = 0; i <= 7; i++) {
    const c = localAt(now.getFullYear(), now.getMonth(), now.getDate() + i, t);
    const wd = c.getDay();
    if (wd !== 0 && wd !== 6 && c.getTime() > now.getTime()) return c;
  }
  return localAt(now.getFullYear(), now.getMonth(), now.getDate() + 7, t);
}

/** 매월 N일의 첫 울림: 이번 달(지나지 않았으면) 또는 다음 달. 짧은 달은 그 달의 마지막 날 */
function nextMonthDay(now: Date, day: number, t: Hm): Date | null {
  if (day < 1 || day > 31) return null;
  for (let k = 0; k <= 1; k++) {
    const y = now.getFullYear();
    const mo = now.getMonth() + k;
    const d = localAt(y, mo, Math.min(day, dim(y, ((mo % 12) + 12) % 12)), t);
    if (d.getTime() > now.getTime()) return d;
  }
  return null;
}

/** 입력 문장에서 시각 표현 하나를 찾는다. 규칙 순서대로 처음 맞는 것을 쓴다 */
function findWhen(input: string, now: Date): Hit | null {
  for (const rule of RULES) {
    const m = rule.re.exec(input);
    if (!m) continue;
    const when = rule.make(m, now);
    if (when) return { when, start: m.index, end: m.index + m[0].length };
  }
  return null;
}

/** 시각 표현을 뺀 글: 앞뒤 공백을 정리하고, 표현 뒤에 붙은 「에」 같은 조사를 뗀다 */
function cleanLabel(input: string, start: number, end: number): string {
  const rest = `${input.slice(0, start)} ${input.slice(end)}`.replace(/\s+/g, " ").trim();
  return rest
    .replace(/^(에|에는|까지)\s+/, "")
    .replace(/\s+에$/, "")
    .trim();
}

/**
 * 빠른 입력 문장을 해석한다.
 * @param input 사용자가 쓴 문장 (예: 「내일 9시 회의 준비」)
 * @param now 기준 시각 (테스트에서는 고정한다)
 */
export function parseReminderText(input: string, now: Date = new Date()): ReminderParse {
  const text = input.replace(/\s+$/, "");
  const hit = findWhen(text, now);
  if (!hit) return { label: text.trim(), when: null, span: null };
  return {
    label: cleanLabel(text, hit.start, hit.end),
    when: hit.when,
    span: [hit.start, hit.end],
  };
}
