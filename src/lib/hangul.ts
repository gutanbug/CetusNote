const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const SYL = 0xac00;
const SYL_END = 0xd7a3;
/** 초성 하나가 맡는 음절 수 (중성 21 × 종성 28) */
const PER_CHO = 588;
/** 중성+초성이 같을 때 종성 수 (받침 없음 포함) */
const PER_JONG = 28;

/** 한글 음절의 초성 (음절이 아니면 그대로) */
export function choseong(ch: string): string {
  const code = ch.charCodeAt(0) - SYL;
  return code >= 0 && code < 11172 ? CHOSEONG[Math.floor(code / PER_CHO)]! : ch;
}

/** 글자마다 초성으로 바꾼다 — 길이가 같아 위치를 그대로 쓸 수 있다 ("문서 3" → "ㅁㅅ 3") */
export function toChoseong(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) out += choseong(s[i]!);
  return out;
}

/** 초성(ㄱ–ㅎ)만으로 된 낱말인지 */
export function isChoseong(s: string): boolean {
  return s.length > 0 && [...s].every((c) => CHOSEONG.includes(c));
}

/** 비교용 정리: 유니코드 NFC + 소문자. 매칭 함수의 본문 입력은 이 결과여야 위치가 맞는다 */
export function foldText(s: string): string {
  return s.normalize("NFC").toLowerCase();
}

/** 글자 범위 [시작, 끝) — UTF-16 위치 (강조 표시용) */
export type Span = [number, number];

export type HangulPattern = {
  /** 검색어 낱말 (정리한 것) */
  word: string;
  /** 글자 그대로 찾는 것과 같다 (초성·입력 중 규칙이 전혀 없음) */
  literal: boolean;
  /** 초성 규칙이 없다 — 글자가 그대로 든 곳을 세 수 있다 (입력 중 음절은 포함) */
  exact: boolean;
  /** 맨 앞에서 맞는지 보는 용도 (`prefix` 옵션일 때는 ^ 고정) */
  re: RegExp;
  /** 본문에서 여러 번 찾는 용도 (전역) */
  g: RegExp;
};

const hex = (cp: number) => `\\u{${cp.toString(16)}}`;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * 검색어 글자 하나를 정규식 조각으로 바꾼다.
 * - 완성형 음절: 그 음절만 (literal)
 * - 초성(ㅎ): 그 초성의 음절 전부 + 초성 글자 자체
 * - 마지막 글자가 받침 없는 음절(입력 중, 회의로): 같은 초성·중성이면 받침이 달라도
 */
type Kind = "literal" | "partial" | "initial";
function tokenSource(ch: string, partialLast: boolean): { src: string; kind: Kind } {
  const cp = ch.codePointAt(0)!;
  if (cp >= SYL && cp <= SYL_END) {
    const off = cp - SYL;
    if (partialLast && off % PER_JONG === 0)
      return { src: `[${hex(cp)}-${hex(cp + PER_JONG - 1)}]`, kind: "partial" };
    return { src: escapeRe(ch), kind: "literal" };
  }
  const k = ch.length === 1 ? CHOSEONG.indexOf(ch) : -1;
  if (k !== -1) {
    const lo = SYL + k * PER_CHO;
    return { src: `[${hex(cp)}${hex(lo)}-${hex(lo + PER_CHO - 1)}]`, kind: "initial" };
  }
  return { src: escapeRe(ch), kind: "literal" };
}

function compileWord(word: string, partialLast: boolean, prefix: boolean): HangulPattern {
  const chars = [...word];
  const kinds = new Set<Kind>();
  const src = chars
    .map((ch, i) => {
      const t = tokenSource(ch, partialLast && i === chars.length - 1);
      kinds.add(t.kind);
      return t.src;
    })
    .join("");
  return {
    word,
    literal: kinds.has("literal") && kinds.size === 1,
    exact: !kinds.has("initial"),
    re: new RegExp(prefix ? `^${src}` : src, "u"),
    g: new RegExp(src, "gu"),
  };
}

/**
 * 검색어를 낱말별 패턴으로 바꾼다. 띄어 쓴 낱말은 따로(AND).
 * 마지막 낱말의 마지막 글자만 "입력 중" 규칙을 쓴다. prefix면 검색어 전체가 맨 앞에서 맞아야 한다.
 */
export function hangulPatterns(query: string, { prefix = false } = {}): HangulPattern[] {
  const q = foldText(query).trim();
  if (!q) return [];
  if (prefix) return [compileWord(q, true, true)];
  const words = q.split(/\s+/);
  return words.map((w, i) => compileWord(w, i === words.length - 1, false));
}

/** 패턴들이 텍스트에서 맞은 모든 범위 (정렬됨). 텍스트는 foldText를 거친 것이어야 한다 */
export function findHangul(text: string, pats: HangulPattern[]): Span[] {
  const out: Span[] = [];
  for (const p of pats)
    for (const m of text.matchAll(p.g)) out.push([m.index!, m.index! + m[0].length]);
  return out.sort((a, b) => a[0] - b[0]);
}

/**
 * 텍스트가 검색어에 맞는지. 낱말이 모두 들어 있어야 하며(AND) 맞은 범위를 돌려준다. 맞지 않으면 null.
 * prefix면 텍스트의 맨 앞에서 검색어 전체가 맞아야 한다 (사이드바 타이핑).
 * 텍스트는 foldText를 거친 것이어야 한다.
 */
export function matchHangul(text: string, query: string, { prefix = false } = {}): Span[] | null {
  const pats = hangulPatterns(query, { prefix });
  if (!pats.length) return null;
  if (prefix) {
    const m = pats[0]!.re.exec(text);
    return m ? [[0, m[0].length]] : null;
  }
  const out: Span[] = [];
  for (const p of pats) {
    let any = false;
    for (const m of text.matchAll(p.g)) {
      any = true;
      out.push([m.index!, m.index! + m[0].length]);
    }
    if (!any) return null;
  }
  return out.sort((a, b) => a[0] - b[0]);
}
