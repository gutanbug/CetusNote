import {
  aggregateValues,
  evaluate,
  formatValue,
  isReservedWord,
  todayOf,
  type CalcValue,
} from "./eval";

/** 줄 하나의 계산 결과. 줄 끝에 흐린 글씨로 보인다 */
export type CalcLine = { value: CalcValue; text: string };

const NAME_RE = /^[\p{L}_][\p{L}\p{N}_]*(?: [\p{L}\p{N}_]+)*$/u;

/** `이름 = 식`의 이름이 될 수 있는가 — 낱말(띄어쓰기 허용)만, 단위·날짜 말은 안 된다 */
export function isCalcName(text: string): boolean {
  return text.length <= 40 && NAME_RE.test(text) && !isReservedWord(text);
}

type Parsed = { kind: "query" | "define"; name: string | null; expr: string } | { kind: "plain" };

/**
 * 줄의 형태
 * - `식 =` → 결과를 보여 준다
 * - `이름 = 식` → 이름을 정한다(아래 줄에서 쓴다). `이름 = 식 =`이면 정하고 보여 준다
 * - 그 밖 → 계산하지 않는다(합계가 위 줄 값을 셀 때만 읽는다)
 */
function parseLine(line: string): Parsed {
  const trimmed = line.trim();
  if (!trimmed.includes("=")) return { kind: "plain" };
  const query = trimmed.endsWith("=");
  const body = query ? trimmed.slice(0, -1).trim() : trimmed;
  const eq = body.indexOf("=");
  if (eq >= 0) {
    const left = body.slice(0, eq).trim();
    const right = body.slice(eq + 1).trim();
    if (isCalcName(left) && right && !right.includes("=")) {
      return { kind: query ? "query" : "define", name: left, expr: right };
    }
    // `1 + 1 = 2 + 3 =` 같은 줄은 마지막 식만
    if (!query) return { kind: "plain" };
    const last = body.slice(body.lastIndexOf("=") + 1).trim();
    return last ? { kind: "query", name: null, expr: last } : { kind: "plain" };
  }
  return query && body ? { kind: "query", name: null, expr: body } : { kind: "plain" };
}

/**
 * 문서의 줄(블록)들을 위에서 아래로 계산한다 (EDIT-38). 결과를 보여 줄 줄에만 값이 있다.
 * `=`가 없는 줄은 건너뛰므로 긴 문서에서도 빠르다(합계가 필요할 때만 위 줄을 읽는다).
 */
export function evaluateLines(
  lines: readonly string[],
  now: Date = new Date(),
): (CalcLine | null)[] {
  const today = todayOf(now);
  const vars = new Map<string, CalcValue>();
  const out: (CalcLine | null)[] = new Array<CalcLine | null>(lines.length).fill(null);
  /** 줄의 값(합계용). undefined = 아직 모름 */
  const values: (CalcValue | null | undefined)[] = new Array(lines.length);
  const aggLine: boolean[] = new Array<boolean>(lines.length).fill(false);

  const loose = (j: number): CalcValue | null => {
    if (values[j] !== undefined) return values[j]!;
    // `=` 없는 줄(`점심 12,000`)이나 결과를 이미 넣은 줄(`... = 16,500`)
    const line = lines[j]!;
    const after = line.includes("=") ? line.slice(line.lastIndexOf("=") + 1).trim() : "";
    const r =
      (after ? evaluate(after, { today, vars }) : null) ??
      evaluate(line.includes("=") ? line.slice(0, line.indexOf("=")) : line, { today, vars });
    values[j] = r?.value ?? null;
    return values[j]!;
  };

  /** 바로 위 줄들 — 빈 줄, 값이 없는 줄, 다른 합계 줄에서 멈춘다 */
  const aggregate = (i: number, kind: "sum" | "avg"): CalcValue | null => {
    const items: CalcValue[] = [];
    for (let j = i - 1; j >= 0; j--) {
      if (!lines[j]!.trim() || aggLine[j]) break;
      const v = loose(j);
      if (!v) break;
      items.unshift(v);
    }
    return aggregateValues(items, kind);
  };

  for (let i = 0; i < lines.length; i++) {
    const p = parseLine(lines[i]!);
    if (p.kind === "plain") continue;
    const r = evaluate(p.expr, { today, vars, aggregate: (kind) => aggregate(i, kind) });
    values[i] = r?.value ?? null;
    if (!r) continue;
    aggLine[i] = r.usesAggregate;
    if (p.name) vars.set(p.name, r.value);
    if (p.kind === "query" && (r.computed || p.name))
      out[i] = { value: r.value, text: formatValue(r.value, today) };
  }
  return out;
}
