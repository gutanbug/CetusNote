/**
 * 살아 있는 계산 줄 (EDIT-38) — 식 하나를 계산한다. 에디터·UI를 모르는 순수 함수.
 *
 * 쓸 수 있는 것
 * - 사칙연산 `+ - * / × ÷`, 거듭제곱 `^`, 괄호, 음수. 숫자는 `12,000` · `1.5` · `3만` · `1억 2천만`
 * - 통화: `12,000원` · `₩12,000` · `$12.5` · `€3` (환율 변환은 하지 않는다. 다른 통화끼리는 계산하지 않는다)
 * - 퍼센트: `20%`, `50,000 + 10%`(10% 더하기), `50,000의 20%` · `20% of 50000`
 * - 시간 길이: `2시간 30분 × 4` → `10시간`, `90분` → `1시간 30분`, `3주`, `2개월`, `1년`
 * - 날짜: `오늘` · `내일` · `어제` · `모레`, `12월 25일`, `2026년 12월 25일`, `2026-12-25`.
 *   `오늘 + 3주`, `3주 후` · `10일 전`, `12월 25일 - 오늘`, `12월 25일까지`(남은 날)
 * - 합계 · 평균: 바로 위 줄들(빈 줄이나 다른 합계 줄까지)의 값을 더한다 — lines.ts가 넘겨준다
 * - 낱말은 이름표로 보고 건너뛴다: `점심 12,000 + 커피 4,500`
 */

export type CurrencyUnit = "원" | "$" | "€";
export type Unit = "" | CurrencyUnit | "%";

export type CalcValue =
  | { kind: "num"; n: number; unit: Unit }
  /** 길이. 초 + 개월(달력 단위라 초로 바꾸지 않는다) */
  | { kind: "dur"; secs: number; months: number }
  /** 날짜. 1970-01-01부터 날 수(달력 날짜만, 시각 없음) */
  | { kind: "date"; day: number }
  /** 단가. `per` 동안 n (예: 10,000원/시간) — 길이를 곱하면 금액이 된다 */
  | { kind: "rate"; n: number; unit: Unit; per: Period };

/** 단가의 기준 길이 */
export type Period = { secs: number; months: number };

export type CalcContext = {
  /** 오늘(날 수) */
  today: number;
  /** 이름 → 값. 위 줄에서 `이름 = 식`으로 정한 것 */
  vars?: ReadonlyMap<string, CalcValue>;
  /** 합계·평균. 없거나 null이면 그 식은 계산하지 않는다 */
  aggregate?: (kind: "sum" | "avg") => CalcValue | null;
};

export type CalcResult = {
  value: CalcValue;
  /** 연산·이름·날짜 등 「계산한」 결과인가 — 숫자 하나만 쓴 줄(`12,000 =`)은 결과를 보여 줄 필요가 없다 */
  computed: boolean;
  /** 합계·평균을 썼는가 (그 위 합계는 여기서 끊는다) */
  usesAggregate: boolean;
};

const DAY = 86_400;

// ── 낱말 ─────────────────────────────────────────────

type Word =
  | { t: "cur"; unit: CurrencyUnit }
  | { t: "dur"; secs: number; months: number; name: string }
  | { t: "month" }
  /** `시간당`의 `당` */
  | { t: "per" }
  /** 시급·주급·월급·연봉 — 뒤 금액을 그 기간의 단가로 */
  | { t: "rateword"; per: Period }
  | { t: "post"; v: "after" | "before" | "until" | "of" }
  | { t: "rel"; offset: number }
  | { t: "agg"; v: "sum" | "avg" };

const LEXICON = new Map<string, Word>([
  ["원", { t: "cur", unit: "원" }],
  ["달러", { t: "cur", unit: "$" }],
  ["유로", { t: "cur", unit: "€" }],
  ["초", { t: "dur", secs: 1, months: 0, name: "초" }],
  ["분", { t: "dur", secs: 60, months: 0, name: "분" }],
  ["시간", { t: "dur", secs: 3600, months: 0, name: "시간" }],
  ["일", { t: "dur", secs: DAY, months: 0, name: "일" }],
  ["주", { t: "dur", secs: 7 * DAY, months: 0, name: "주" }],
  ["개월", { t: "dur", secs: 0, months: 1, name: "개월" }],
  ["달", { t: "dur", secs: 0, months: 1, name: "개월" }],
  ["년", { t: "dur", secs: 0, months: 12, name: "년" }],
  ["월", { t: "month" }],
  ["후", { t: "post", v: "after" }],
  ["뒤", { t: "post", v: "after" }],
  ["전", { t: "post", v: "before" }],
  ["까지", { t: "post", v: "until" }],
  ["의", { t: "post", v: "of" }],
  ["of", { t: "post", v: "of" }],
  ["당", { t: "per" }],
  ["시급", { t: "rateword", per: { secs: 3600, months: 0 } }],
  ["일급", { t: "rateword", per: { secs: DAY, months: 0 } }],
  ["주급", { t: "rateword", per: { secs: 7 * DAY, months: 0 } }],
  ["월급", { t: "rateword", per: { secs: 0, months: 1 } }],
  ["연봉", { t: "rateword", per: { secs: 0, months: 12 } }],
  ["오늘", { t: "rel", offset: 0 }],
  ["today", { t: "rel", offset: 0 }],
  ["내일", { t: "rel", offset: 1 }],
  ["tomorrow", { t: "rel", offset: 1 }],
  ["모레", { t: "rel", offset: 2 }],
  ["어제", { t: "rel", offset: -1 }],
  ["yesterday", { t: "rel", offset: -1 }],
  ["합계", { t: "agg", v: "sum" }],
  ["총합", { t: "agg", v: "sum" }],
  ["소계", { t: "agg", v: "sum" }],
  ["sum", { t: "agg", v: "sum" }],
  ["total", { t: "agg", v: "sum" }],
  ["평균", { t: "agg", v: "avg" }],
  ["average", { t: "agg", v: "avg" }],
  ["avg", { t: "agg", v: "avg" }],
]);
const LEXICON_KEYS = [...LEXICON.keys()].sort((a, b) => b.length - a.length);

/** 낱말 끝에 붙어도 되는 조사 — 버린다 (`월세의`, `12월 25일까지는`) */
const PARTICLES = new Set([
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "에",
  "에서",
  "로",
  "으로",
  "과",
  "와",
  "도",
  "만",
  "부터",
  "엔",
  "랑",
  "이랑",
  "간",
  "동안",
  "까진",
  "에는",
]);

/** 낱말을 아는 조각으로 나눈다. 하나라도 모르는 조각이 있으면 이름표(null) */
function segment(word: string): Word[] | null {
  const lower = word.toLowerCase();
  const out: Word[] = [];
  let i = 0;
  while (i < lower.length) {
    const rest = lower.slice(i);
    const key = LEXICON_KEYS.find((k) => rest.startsWith(k));
    if (key) {
      out.push(LEXICON.get(key)!);
      i += key.length;
      continue;
    }
    return out.length && PARTICLES.has(rest) ? out : null;
  }
  return out;
}

/** 단위·날짜 낱말인가 — 이런 낱말은 이름(변수)으로 쓰지 않는다 */
export function isReservedWord(word: string): boolean {
  return segment(word.replace(/\s+/g, "")) !== null;
}

// ── 토큰 ─────────────────────────────────────────────

type Tok =
  | Word
  | { t: "num"; n: number }
  | { t: "isodate"; day: number }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "^" | "(" | ")" | "%" }
  | { t: "curp"; unit: CurrencyUnit }
  | { t: "var"; value: CalcValue };

const OPS: Record<string, Tok> = {
  "+": { t: "op", v: "+" },
  "-": { t: "op", v: "-" },
  "−": { t: "op", v: "-" },
  "–": { t: "op", v: "-" },
  "*": { t: "op", v: "*" },
  "×": { t: "op", v: "*" },
  "/": { t: "op", v: "/" },
  "÷": { t: "op", v: "/" },
  "^": { t: "op", v: "^" },
  "(": { t: "op", v: "(" },
  ")": { t: "op", v: ")" },
  "%": { t: "op", v: "%" },
  "％": { t: "op", v: "%" },
  $: { t: "curp", unit: "$" },
  "€": { t: "curp", unit: "€" },
  "₩": { t: "curp", unit: "원" },
};

const NUM_RE = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|^\.\d+/;
const ISO_RE = /^(\d{4})[-.](\d{1,2})[-.](\d{1,2})(?!\d)/;
const WORD_RE = /^[\p{L}_][\p{L}\p{N}_]*/u;
const LETTER_RE = /[\p{L}_]/u;
const MAGNITUDES: [string, number][] = [
  ["천만", 1e7],
  ["백만", 1e6],
  ["조", 1e12],
  ["억", 1e8],
  ["만", 1e4],
  ["천", 1e3],
];

function magnitudeAt(src: string, i: number): [number, number] | null {
  for (const [w, f] of MAGNITUDES) if (src.startsWith(w, i)) return [f, w.length];
  return null;
}

function tokenize(src: string, vars: [string, CalcValue][]): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const rest = src.slice(i);
    const iso = ISO_RE.exec(rest);
    if (iso) {
      const day = dayOf(+iso[1]!, +iso[2]!, +iso[3]!);
      if (day === null) return null;
      toks.push({ t: "isodate", day });
      i += iso[0].length;
      continue;
    }
    const num = NUM_RE.exec(rest);
    if (num) {
      let n = parseFloat(num[0].replace(/,/g, ""));
      i += num[0].length;
      const mag = magnitudeAt(src, i);
      if (mag) {
        n *= mag[0];
        i += mag[1];
        // 「1억 2천만」 — 뒤에 더 작은 자리가 이어지면 더한다
        let last = mag[0];
        for (;;) {
          const more = /^\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)/.exec(src.slice(i));
          if (!more) break;
          const m2 = magnitudeAt(src, i + more[0].length);
          if (!m2 || m2[0] >= last) break;
          n += parseFloat(more[1]!.replace(/,/g, "")) * m2[0];
          i += more[0].length + m2[1];
          last = m2[0];
        }
      }
      // 숫자에 모르는 낱말이 붙어 있으면(`2층`, `1년이면`) 둘 다 이름표다
      const glued = WORD_RE.exec(src.slice(i));
      if (glued) {
        const parts = segment(glued[0]);
        i += glued[0].length;
        if (parts) toks.push({ t: "num", n }, ...parts);
        continue;
      }
      toks.push({ t: "num", n });
      continue;
    }
    if (LETTER_RE.test(c)) {
      const word = WORD_RE.exec(rest)![0];
      // 이름(변수) — 긴 이름부터. 뒤에 조사·단위가 붙어도 된다(`월세의`)
      const hit = vars.find(([name]) => {
        if (!src.startsWith(name, i)) return false;
        const tail = WORD_RE.exec(src.slice(i + name.length));
        return !tail || segment(tail[0]) !== null || PARTICLES.has(tail[0]);
      });
      if (hit) {
        toks.push({ t: "var", value: hit[1] });
        i += hit[0].length;
        const tail = WORD_RE.exec(src.slice(i));
        if (tail) {
          toks.push(...(segment(tail[0]) ?? []));
          i += tail[0].length;
        }
        continue;
      }
      const parts = segment(word);
      if (parts) toks.push(...parts); // 모르는 낱말은 이름표 — 건너뛴다
      i += word.length;
      continue;
    }
    const op = OPS[c];
    if (op) toks.push(op);
    i++; // 그 밖의 기호(: · , → …)는 건너뛴다
  }
  return toks;
}

// ── 날짜 ─────────────────────────────────────────────

function dayOf(y: number, m: number, d: number): number | null {
  if (m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) return null;
  return Date.UTC(y, m - 1, d) / (DAY * 1000);
}

function daysIn(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function ymd(day: number): [number, number, number] {
  const d = new Date(day * DAY * 1000);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

/** 이 기기 시간대의 오늘 */
export function todayOf(now: Date): number {
  return dayOf(now.getFullYear(), now.getMonth() + 1, now.getDate())!;
}

function shiftDate(day: number, dur: { secs: number; months: number }, sign: 1 | -1): number {
  let out = day;
  if (dur.months) {
    const months = Math.trunc(dur.months) * sign;
    const [y, m, d] = ymd(out);
    const total = y * 12 + (m - 1) + months;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    out = dayOf(ny, nm, Math.min(d, daysIn(ny, nm)))!;
  }
  return out + Math.trunc(dur.secs / DAY) * sign;
}

// ── 계산 ─────────────────────────────────────────────

class CalcError extends Error {}
const fail = (): never => {
  throw new CalcError();
};

const num = (n: number, unit: Unit = ""): CalcValue => {
  if (!Number.isFinite(n)) fail();
  return { kind: "num", n, unit };
};

function mergeUnit(a: Unit, b: Unit): Unit {
  if (!a) return b;
  if (!b || a === b) return a;
  return fail();
}

/** 금액을 단가로 */
function toRate(v: CalcValue, per: Period): CalcValue {
  if (v.kind !== "num" || v.unit === "%") return fail();
  return { kind: "rate", n: v.n, unit: v.unit, per };
}

/** 길이가 단가 기준의 몇 배인가. 달력 단위(개월)와 초 단위는 섞지 않는다 */
function ratio(d: Period, per: Period): number {
  if (per.months) {
    if (d.secs) fail();
    return d.months / per.months;
  }
  if (d.months) fail();
  return d.secs / per.secs;
}

const samePeriod = (a: Period, b: Period) => a.secs === b.secs && a.months === b.months;

/** 단가 이름(시급·월급 …)이면 그 기준 길이 */
export function ratePeriodOf(name: string): Period | null {
  const w = LEXICON.get(name.trim());
  return w?.t === "rateword" ? w.per : null;
}

function add(a: CalcValue, b: CalcValue, sign: 1 | -1): CalcValue {
  if (a.kind === "rate" && b.kind === "rate" && samePeriod(a.per, b.per))
    return { ...a, n: a.n + sign * b.n, unit: mergeUnit(a.unit, b.unit) };
  if (a.kind === "num" && b.kind === "num") {
    // 50,000 + 10% → 10% 더하기
    if (b.unit === "%" && a.unit !== "%") return num(a.n * (1 + (sign * b.n) / 100), a.unit);
    if (a.unit === "%" && b.unit !== "%" && b.unit !== "") fail();
    return num(a.n + sign * b.n, mergeUnit(a.unit, b.unit));
  }
  if (a.kind === "dur" && b.kind === "dur")
    return { kind: "dur", secs: a.secs + sign * b.secs, months: a.months + sign * b.months };
  if (a.kind === "date" && b.kind === "dur")
    return { kind: "date", day: shiftDate(a.day, b, sign) };
  if (a.kind === "dur" && b.kind === "date" && sign === 1)
    return { kind: "date", day: shiftDate(b.day, a, 1) };
  if (a.kind === "date" && b.kind === "date" && sign === -1)
    return { kind: "dur", secs: (a.day - b.day) * DAY, months: 0 };
  return fail();
}

function scaleDur(d: { secs: number; months: number }, k: number): CalcValue {
  if (!Number.isFinite(k)) fail();
  return { kind: "dur", secs: d.secs * k, months: d.months * k };
}

function mul(a: CalcValue, b: CalcValue): CalcValue {
  // 단가 × 길이 = 금액, 단가 × 수 = 단가
  if (a.kind === "rate" && b.kind === "dur") return num(a.n * ratio(b, a.per), a.unit);
  if (a.kind === "dur" && b.kind === "rate") return num(b.n * ratio(a, b.per), b.unit);
  if (a.kind === "rate" && b.kind === "num" && !b.unit) return { ...a, n: a.n * b.n };
  if (a.kind === "num" && !a.unit && b.kind === "rate") return { ...b, n: b.n * a.n };
  if (a.kind === "num" && b.kind === "num") {
    if (a.unit === "%" && b.unit === "%") fail();
    if (a.unit === "%") return num((b.n * a.n) / 100, b.unit);
    if (b.unit === "%") return num((a.n * b.n) / 100, a.unit);
    if (a.unit && b.unit) fail();
    return num(a.n * b.n, a.unit || b.unit);
  }
  if (a.kind === "dur" && b.kind === "num" && !b.unit) return scaleDur(a, b.n);
  if (a.kind === "num" && !a.unit && b.kind === "dur") return scaleDur(b, a.n);
  return fail();
}

function div(a: CalcValue, b: CalcValue): CalcValue {
  if (a.kind === "rate" && b.kind === "num" && !b.unit) {
    if (b.n === 0) fail();
    return { ...a, n: a.n / b.n };
  }
  if (a.kind === "num" && b.kind === "num") {
    if (b.n === 0) fail();
    if (b.unit === "%") return a.unit === "%" ? num(a.n / b.n) : num(a.n / (b.n / 100), a.unit);
    if (a.unit && a.unit === b.unit) return num(a.n / b.n);
    if (b.unit) fail();
    return num(a.n / b.n, a.unit);
  }
  if (a.kind === "dur" && b.kind === "num" && !b.unit) {
    if (b.n === 0) fail();
    return scaleDur(a, 1 / b.n);
  }
  if (a.kind === "dur" && b.kind === "dur" && !a.months && !b.months) {
    if (b.secs === 0) fail();
    return num(a.secs / b.secs);
  }
  return fail();
}

/** 퍼센트 「의」: 한쪽은 퍼센트여야 한다 */
function percentOf(a: CalcValue, b: CalcValue): CalcValue {
  if (a.kind !== "num" || b.kind !== "num") return fail();
  if (b.unit === "%" && a.unit !== "%") return num((a.n * b.n) / 100, a.unit);
  if (a.unit === "%" && b.unit !== "%") return num((b.n * a.n) / 100, b.unit);
  return fail();
}

type Atom = { v: CalcValue; soft: boolean; computed: boolean };

/** 재귀 하강 파서. 실패하면 CalcError */
class Parser {
  i = 0;
  computed = false;
  usesAggregate = false;
  constructor(
    private toks: Tok[],
    private ctx: CalcContext,
  ) {}

  private peek(k = 0): Tok | undefined {
    return this.toks[this.i + k];
  }
  private isOp(v: string, k = 0): boolean {
    const t = this.peek(k);
    return t?.t === "op" && t.v === v;
  }

  parse(): CalcValue {
    const v = this.expr();
    if (this.i < this.toks.length) fail();
    return v;
  }

  private expr(): CalcValue {
    let v = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const sign = this.isOp("+") ? 1 : -1;
      this.i++;
      this.computed = true;
      v = add(v, this.term(), sign);
    }
    return v;
  }

  private term(): CalcValue {
    let v = this.unary();
    while (this.isOp("*") || this.isOp("/")) {
      const times = this.isOp("*");
      this.i++;
      this.computed = true;
      // `10,000원/시간` — 숫자 없는 단위로 나누면 단가
      const unit = this.peek();
      if (!times && unit?.t === "dur") {
        this.i++;
        v = toRate(v, { secs: unit.secs, months: unit.months });
        continue;
      }
      const r = this.unary();
      v = times ? mul(v, r) : div(v, r);
    }
    return v;
  }

  private unary(): CalcValue {
    if (this.isOp("-")) {
      this.i++;
      const v = this.unary();
      if (v.kind === "num") return num(-v.n, v.unit);
      if (v.kind === "dur") return scaleDur(v, -1);
      return fail();
    }
    if (this.isOp("+")) {
      this.i++;
      return this.unary();
    }
    return this.power();
  }

  private power(): CalcValue {
    const base = this.quantity();
    if (!this.isOp("^")) return base;
    this.i++;
    this.computed = true;
    const exp = this.unary();
    if (base.kind !== "num" || exp.kind !== "num" || base.unit || exp.unit) return fail();
    return num(base.n ** exp.n);
  }

  private startsAtom(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.t === "op") return t.v === "(";
    if (t.t === "dur") return this.peek(1)?.t === "per";
    return ["num", "isodate", "var", "rel", "agg", "curp", "rateword"].includes(t.t);
  }

  /** 값 하나 + 뒤 꾸밈(`%`, `후`, `까지`, `의 20%`). 이어 쓴 값이 있으면 앞의 「오늘」 같은 말은 이름표로 본다 */
  private quantity(): CalcValue {
    let a = this.atom();
    while (a.soft && this.startsAtom()) a = this.atom();
    if (a.computed) this.computed = true;
    let v = a.v;
    for (;;) {
      const t = this.peek();
      if (t?.t !== "post") break;
      this.i++;
      this.computed = true;
      if (t.v === "of") v = percentOf(v, this.quantity());
      else if (t.v === "until") {
        if (v.kind !== "date") fail();
        v = add(v, { kind: "date", day: this.ctx.today }, -1);
      } else {
        if (v.kind !== "dur") fail();
        v = {
          kind: "date",
          day: shiftDate(
            this.ctx.today,
            v as { secs: number; months: number },
            t.v === "after" ? 1 : -1,
          ),
        };
      }
    }
    return v;
  }

  private atom(): Atom {
    const t = this.peek();
    if (!t) return fail();
    this.i++;
    let a: Atom;
    switch (t.t) {
      case "op":
        if (t.v !== "(") fail();
        a = { v: this.expr(), soft: false, computed: false };
        if (this.isOp(")")) this.i++;
        else if (this.i < this.toks.length) fail(); // 줄 끝의 닫는 괄호는 빠져도 된다
        break;
      case "num":
        a = this.literal(t.n);
        break;
      case "curp": {
        const n = this.peek();
        if (n?.t !== "num") fail();
        this.i++;
        a = { v: num((n as { n: number }).n, t.unit), soft: false, computed: false };
        break;
      }
      case "isodate":
        a = { v: { kind: "date", day: t.day }, soft: false, computed: true };
        break;
      case "rel":
        a = { v: { kind: "date", day: this.ctx.today + t.offset }, soft: true, computed: true };
        break;
      case "var":
        a = { v: t.value, soft: false, computed: true };
        break;
      case "rateword":
        // `시급 10,000원` — 뒤 금액을 단가로
        a = { v: toRate(this.atom().v, t.per), soft: false, computed: true };
        break;
      case "dur": {
        // `시간당 10,000원`
        // 숫자 없이 홀로 쓴 단위 낱말(`주 5일이면`의 `주`)은 이름표로 본다
        if (this.peek()?.t !== "per") return this.atom();
        this.i++;
        a = {
          v: toRate(this.atom().v, { secs: t.secs, months: t.months }),
          soft: false,
          computed: true,
        };
        break;
      }
      case "agg": {
        const v = this.ctx.aggregate?.(t.v);
        if (!v) fail();
        this.usesAggregate = true;
        a = { v: v!, soft: false, computed: true };
        break;
      }
      default:
        return fail();
    }
    if (this.isOp("%")) {
      this.i++;
      if (a.v.kind !== "num" || a.v.unit) fail();
      a = { ...a, v: num((a.v as { n: number }).n, "%") };
    }
    return a;
  }

  /** 숫자 뒤: 통화(`원`), 날짜(`12월 25일`, `2026년 12월 25일`), 길이(`2시간 30분`) */
  private literal(n: number): Atom {
    const t = this.peek();
    if (t?.t === "cur") {
      this.i++;
      return { v: num(n, t.unit), soft: false, computed: false };
    }
    // 2026년 12월 25일
    const yearDate =
      t?.t === "dur" && t.name === "년" && this.peek(1)?.t === "num" && this.peek(2)?.t === "month";
    if (yearDate) {
      this.i++;
      const m = (this.toks[this.i++] as { n: number }).n;
      return this.monthDay(n, m);
    }
    if (t?.t === "month") return this.monthDay(dateYear(this.ctx.today), n);
    if (t?.t === "dur") {
      let secs = 0;
      let months = 0;
      let parts = 0;
      let normalizes = false;
      let k = n;
      for (;;) {
        const u = this.peek() as Word & { t: "dur" };
        this.i++;
        secs += k * u.secs;
        months += k * u.months;
        parts++;
        const limit = { 초: 60, 분: 60, 시간: 24, 개월: 12 }[u.name as "초"];
        if (!Number.isInteger(k) || u.name === "주" || (limit && k >= limit)) normalizes = true;
        // 이어지는 「30분」
        if (this.peek()?.t === "num" && this.peek(1)?.t === "dur") {
          k = (this.toks[this.i++] as { n: number }).n;
          continue;
        }
        break;
      }
      return { v: { kind: "dur", secs, months }, soft: false, computed: parts > 1 || normalizes };
    }
    return { v: num(n), soft: false, computed: false };
  }

  private monthDay(year: number, month: number): Atom {
    // 지금 「월」 토큰 위
    this.i++;
    const d = this.peek();
    const u = this.peek(1);
    if (d?.t !== "num" || u?.t !== "dur" || u.name !== "일") return fail();
    this.i += 2;
    const day = dayOf(year, month, (d as { n: number }).n);
    if (day === null) fail();
    return { v: { kind: "date", day: day! }, soft: false, computed: true };
  }
}

function dateYear(day: number): number {
  return ymd(day)[0];
}

/** 식 하나를 계산한다. 계산할 수 없으면 null */
export function evaluate(text: string, ctx: CalcContext): CalcResult | null {
  const vars = ctx.vars ? [...ctx.vars].sort((a, b) => b[0].length - a[0].length) : [];
  const toks = tokenize(text, vars);
  if (!toks?.length) return null;
  const p = new Parser(toks, ctx);
  try {
    const value = p.parse();
    return { value, computed: p.computed, usesAggregate: p.usesAggregate };
  } catch (e) {
    if (e instanceof CalcError) return null;
    throw e;
  }
}

/** 값들의 합계·평균. 더할 수 없는 값이 섞이면 null */
export function aggregateValues(
  items: readonly CalcValue[],
  kind: "sum" | "avg",
): CalcValue | null {
  if (!items.length) return null;
  try {
    const sum = items.slice(1).reduce((acc, v) => add(acc, v, 1), items[0]!);
    return kind === "avg" ? div(sum, num(items.length)) : sum;
  } catch (e) {
    if (e instanceof CalcError) return null;
    throw e;
  }
}

// ── 보여 주기 ─────────────────────────────────────────

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function fmtNumber(n: number, digits: number, minDigits = 0): string {
  const v = Object.is(Math.round(n * 1e10) / 1e10, -0) ? 0 : Math.round(n * 1e10) / 1e10;
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: minDigits,
  }).format(v);
}

function fmtDur(secs: number, months: number): string {
  const neg = secs < 0 || (secs === 0 && months < 0);
  const parts: string[] = [];
  const m = Math.round(Math.abs(months) * 100) / 100;
  if (m) {
    const y = Math.floor(m / 12);
    const mo = Math.round((m - y * 12) * 100) / 100;
    if (y) parts.push(`${fmtNumber(y, 0)}년`);
    if (mo) parts.push(`${fmtNumber(mo, 2)}개월`);
  }
  let s = Math.round(Math.abs(secs));
  const d = Math.floor(s / DAY);
  s -= d * DAY;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const mi = Math.floor(s / 60);
  s -= mi * 60;
  if (d) parts.push(`${fmtNumber(d, 0)}일`);
  if (h) parts.push(`${h}시간`);
  if (mi) parts.push(`${mi}분`);
  if (s) parts.push(`${s}초`);
  if (!parts.length) return "0분";
  return (neg ? "-" : "") + parts.join(" ");
}

const PERIOD_NAMES: [Period, string][] = [
  [{ secs: 1, months: 0 }, "초"],
  [{ secs: 60, months: 0 }, "분"],
  [{ secs: 3600, months: 0 }, "시간"],
  [{ secs: DAY, months: 0 }, "일"],
  [{ secs: 7 * DAY, months: 0 }, "주"],
  [{ secs: 0, months: 1 }, "월"],
  [{ secs: 0, months: 12 }, "년"],
];

function periodName(p: Period): string {
  return PERIOD_NAMES.find(([q]) => samePeriod(p, q))?.[1] ?? fmtDur(p.secs, p.months);
}

/** 결과를 글로. 통화는 원 = 정수, $·€ = 소수 둘째 자리, 그 밖은 넷째 자리까지 */
export function formatValue(v: CalcValue, today: number): string {
  if (v.kind === "date") {
    const [y, m, d] = ymd(v.day);
    const wd = WEEKDAYS[new Date(v.day * DAY * 1000).getUTCDay()];
    const year = y === dateYear(today) ? "" : `${y}년 `;
    return `${year}${m}월 ${d}일 (${wd})`;
  }
  if (v.kind === "dur") return fmtDur(v.secs, v.months);
  if (v.kind === "rate")
    return `${formatValue({ kind: "num", n: v.n, unit: v.unit }, today)}/${periodName(v.per)}`;
  switch (v.unit) {
    case "원":
      return `${fmtNumber(Math.round(v.n), 0)}원`;
    case "$":
    case "€": {
      const s = fmtNumber(Math.abs(v.n), 2, Number.isInteger(Math.round(v.n * 100) / 100) ? 0 : 2);
      return `${v.n < 0 ? "-" : ""}${v.unit}${s}`;
    }
    case "%":
      return `${fmtNumber(v.n, 2)}%`;
    default:
      return fmtNumber(v.n, 4);
  }
}
