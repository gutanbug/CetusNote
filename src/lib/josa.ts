/**
 * 받침에 따라 붙는 조사 '로 / 으로'를 고른다 (토스트 문구 — SHELL-18).
 * 글자의 소리로 판단한다.
 * - 한글 음절: 받침이 없거나 ㄹ이면 '로', 그 밖의 받침이면 '으로'
 * - 숫자: 마지막 숫자의 한글 읽기 기준. 영·삼·육(받침 ㅇ·ㅁ·ㄱ) → 으로, 나머지 → 로
 *   (일·칠·팔은 ㄹ 받침이라 로, 십·백·천처럼 0으로 끝나는 수는 받침이 있어 으로)
 * - 영문 글자: 글자 이름의 받침 기준 (엘·아르 → 로, 엠·엔·에스·엑스 → 으로 …)
 * - 그 밖(기호·이모지·빈 문자열): '(으)로'
 */
export type RoParticle = "로" | "으로" | "(으)로";

const DIGIT_PARTICLE: Record<string, "로" | "으로"> = {
  "0": "으로", // 영
  "1": "로", // 일
  "2": "로", // 이
  "3": "으로", // 삼
  "4": "로", // 사
  "5": "로", // 오
  "6": "으로", // 육
  "7": "로", // 칠
  "8": "로", // 팔
  "9": "로", // 구
};

const LATIN_PARTICLE: Record<string, "로" | "으로"> = {
  a: "로", // 에이
  b: "로", // 비
  c: "로", // 씨
  d: "로", // 디
  e: "로", // 이
  f: "으로", // 에프
  g: "로", // 지
  h: "으로", // 에이치
  i: "로", // 아이
  j: "로", // 제이
  k: "로", // 케이
  l: "로", // 엘
  m: "으로", // 엠
  n: "으로", // 엔
  o: "로", // 오
  p: "로", // 피
  q: "로", // 큐
  r: "로", // 아르
  s: "으로", // 에스
  t: "로", // 티
  u: "로", // 유
  v: "로", // 브이
  w: "로", // 더블유
  x: "으로", // 엑스
  y: "로", // 와이
  z: "으로", // 제트
};

/** 단어 끝 글자를 보고 '로' 또는 '으로'를 고른다. 판단할 수 없으면 '(으)로' */
export function roParticle(word: string): RoParticle {
  const chars = [...word.trim()];
  const last = chars[chars.length - 1];
  if (!last) return "(으)로";
  const code = last.codePointAt(0)!;
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return jong === 0 || jong === 8 ? "로" : "으로";
  }
  return DIGIT_PARTICLE[last] ?? LATIN_PARTICLE[last.toLowerCase()] ?? "(으)로";
}
