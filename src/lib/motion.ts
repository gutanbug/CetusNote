/**
 * Motion(motion/react)에 넘길 시간·이징을 토큰(tokens.css의 --dur*, --ease)에서 읽는다.
 * 값을 코드에 다시 적지 않는다 — 토큰을 바꾸면 애니메이션도 따라 바뀐다.
 */

const read = (name: string) =>
  typeof document === "undefined"
    ? ""
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** "160ms" | "0.16s" → 초 */
function seconds(name: string): number {
  const v = read(name);
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return v.endsWith("ms") ? n / 1000 : n;
}

/** "cubic-bezier(a, b, c, d)" → [a, b, c, d] */
function bezier(name: string): [number, number, number, number] | "easeOut" {
  const m = /cubic-bezier\(([^)]+)\)/.exec(read(name));
  const nums = m?.[1]?.split(",").map((x) => Number.parseFloat(x));
  return nums?.length === 4 && nums.every(Number.isFinite)
    ? (nums as [number, number, number, number])
    : "easeOut";
}

/** 지금 토큰 값. 렌더 중에 불러도 된다(계산이 가볍다) */
export function motionTokens() {
  return {
    fast: seconds("--dur-fast"),
    base: seconds("--dur"),
    slow: seconds("--dur-slow"),
    ease: bezier("--ease"),
  };
}
